import { WhatsAppProviderError, classifyHttpStatus } from "./errors";

export interface FetchResponseLike {
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<FetchResponseLike>;

export interface SendTemplateInput {
  phoneNumberId: string;
  to: string;
  templateName: string;
  language: string;
  variables: string[];
}

export interface SendTemplateResult {
  providerMessageId: string;
}

export interface PhoneInfoResult {
  verifiedName: string | null;
  displayPhoneNumber: string | null;
  status: string | null;
}

export interface WhatsAppProvider {
  readonly name: "meta" | "mock";
  sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult>;
  getPhoneNumberInfo(phoneNumberId: string): Promise<PhoneInfoResult>;
}

export interface MetaProviderOptions {
  accessToken: string;
  apiVersion?: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

interface GraphApiError {
  message?: string;
  type?: string;
  code?: number | string;
  error_subcode?: number;
}

function scrub(message: string, secret?: string): string {
  const limited = message.slice(0, 300);
  return secret ? limited.split(secret).join("***") : limited;
}

/**
 * Adapter da WhatsApp Business Cloud API (Meta) — integração oficial via
 * Graph API. Nenhuma credencial vive aqui: o token vem do chamador
 * (variável de ambiente no backend).
 */
export class MetaCloudProvider implements WhatsAppProvider {
  readonly name = "meta" as const;

  private readonly accessToken: string;
  private readonly apiVersion: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: MetaProviderOptions) {
    this.accessToken = options.accessToken;
    this.apiVersion = options.apiVersion ?? "v21.0";
    this.baseUrl = options.baseUrl ?? "https://graph.facebook.com";
    this.fetchImpl =
      options.fetchImpl ?? ((url, init) => globalThis.fetch(url, init) as Promise<FetchResponseLike>);
  }

  async sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult> {
    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.language },
        ...(input.variables.length > 0
          ? {
              components: [
                {
                  type: "body",
                  parameters: input.variables.map((text) => ({ type: "text", text })),
                },
              ],
            }
          : {}),
      },
    };

    const data = await this.request<{
      messages?: Array<{ id?: string }>;
      error?: GraphApiError;
    }>(`/${input.phoneNumberId}/messages`, "POST", payload);

    const providerMessageId = data?.messages?.[0]?.id;
    if (!providerMessageId) {
      throw new WhatsAppProviderError(
        "Resposta do provedor sem identificador de mensagem",
        "PERMANENT",
        "NO_MESSAGE_ID",
      );
    }
    return { providerMessageId };
  }

  async getPhoneNumberInfo(phoneNumberId: string): Promise<PhoneInfoResult> {
    const data = await this.request<{
      verified_name?: string;
      display_phone_number?: string;
      status?: string;
      error?: GraphApiError;
    }>(`/${phoneNumberId}`, "GET", undefined, "fields=verified_name,display_phone_number,status");

    return {
      verifiedName: data?.verified_name ?? null,
      displayPhoneNumber: data?.display_phone_number ?? null,
      status: data?.status ?? null,
    };
  }

  private async request<T>(
    path: string,
    method: "GET" | "POST",
    body?: unknown,
    query?: string,
  ): Promise<T> {
    const url = `${this.baseUrl}/${this.apiVersion}${path}${query ? `?${query}` : ""}`;

    let response: FetchResponseLike;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new WhatsAppProviderError(
        "Falha de rede ao contatar o provedor",
        "TRANSIENT",
        "NETWORK_ERROR",
      );
    }

    let parsed: T | undefined;
    try {
      parsed = (await response.json()) as T;
    } catch {
      if (!response.ok) {
        throw new WhatsAppProviderError(
          `Resposta inválida do provedor (HTTP ${response.status})`,
          classifyHttpStatus(response.status),
          "INVALID_RESPONSE",
          response.status,
        );
      }
      throw new WhatsAppProviderError(
        "Resposta inválida do provedor",
        "PERMANENT",
        "INVALID_RESPONSE",
        response.status,
      );
    }

    const error = (parsed as { error?: GraphApiError } | undefined)?.error;
    if (response.status >= 400 || error) {
      const graphError = error ?? {};
      const message = scrub(
        graphError.message ?? `Erro HTTP ${response.status} do provedor`,
        this.accessToken,
      );
      const code = graphError.code !== undefined ? String(graphError.code) : `HTTP_${response.status}`;
      throw new WhatsAppProviderError(
        message,
        classifyHttpStatus(response.status),
        code,
        response.status,
      );
    }

    return parsed;
  }
}

export type MockFailureMode = "none" | "transient" | "permanent";

export interface MockProviderOptions {
  failureMode?: MockFailureMode;
  /** Quantas chamadas (a partir da primeira) devem falhar; undefined = sempre. */
  failureTimes?: number;
}

/**
 * Provedor local para desenvolvimento/testes: não contata a Meta e nunca
 * envia mensagens reais. Permite simular falhas transitórias/permanentes.
 */
export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly name = "mock" as const;
  sendCount = 0;
  infoCount = 0;

  private counter = 0;
  private readonly failureMode: MockFailureMode;
  private readonly failureTimes?: number;

  constructor(options: MockProviderOptions = {}) {
    this.failureMode = options.failureMode ?? "none";
    this.failureTimes = options.failureTimes;
  }

  async sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult> {
    this.sendCount += 1;
    const shouldFail =
      this.failureMode !== "none" &&
      (this.failureTimes === undefined || this.sendCount <= this.failureTimes);

    if (shouldFail) {
      if (this.failureMode === "transient") {
        throw new WhatsAppProviderError(
          "Falha transitória simulada pelo provedor mock",
          "TRANSIENT",
          "MOCK_TRANSIENT",
          503,
        );
      }
      throw new WhatsAppProviderError(
        "Falha permanente simulada pelo provedor mock",
        "PERMANENT",
        "MOCK_PERMANENT",
        400,
      );
    }

    this.counter += 1;
    const suffix = `MOCK${String(this.counter).padStart(6, "0")}${input.to.slice(-4)}`;
    return { providerMessageId: `wamid.${suffix}` };
  }

  async getPhoneNumberInfo(): Promise<PhoneInfoResult> {
    this.infoCount += 1;
    if (this.failureMode === "permanent") {
      throw new WhatsAppProviderError(
        "Credenciais inválidas simuladas pelo provedor mock",
        "PERMANENT",
        "MOCK_UNAUTHORIZED",
        401,
      );
    }
    if (this.failureMode === "transient") {
      throw new WhatsAppProviderError(
        "Falha transitória simulada pelo provedor mock",
        "TRANSIENT",
        "MOCK_TRANSIENT",
        503,
      );
    }
    return {
      verifiedName: "PetFlow Mock",
      displayPhoneNumber: "5511999990000",
      status: "VERIFIED",
    };
  }
}

export interface WhatsAppProviderConfig {
  provider: "mock" | "meta";
  accessToken?: string;
  apiVersion?: string;
  fetchImpl?: FetchLike;
}

/**
 * Cria o provedor conforme a configuração. O padrão (e o único permitido
 * sem credenciais) é o mock — nenhuma mensagem real sai sem token válido.
 */
export function createWhatsAppProvider(config: WhatsAppProviderConfig): WhatsAppProvider {
  if (config.provider === "meta") {
    if (!config.accessToken) {
      throw new Error(
        "Credencial ausente: WHATSAPP_ACCESS_TOKEN é obrigatório com WHATSAPP_PROVIDER=meta",
      );
    }
    return new MetaCloudProvider({
      accessToken: config.accessToken,
      apiVersion: config.apiVersion,
      fetchImpl: config.fetchImpl,
    });
  }
  return new MockWhatsAppProvider();
}
