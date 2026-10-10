import { createHash, createHmac, timingSafeEqual } from "crypto";
import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { isOptOutText } from "@petflow/whatsapp";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.module";
import { env } from "../config/env";

interface GraphStatus {
  id?: string;
  status?: string;
  errors?: Array<{ code?: number; title?: string; message?: string }>;
}

interface GraphInboundMessage {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
}

interface GraphChange {
  field?: string;
  value?: {
    metadata?: { phone_number_id?: string };
    statuses?: GraphStatus[];
    messages?: GraphInboundMessage[];
  };
}

interface GraphEntry {
  id?: string;
  changes?: GraphChange[];
}

interface GraphPayload {
  object?: string;
  entry?: GraphEntry[];
}

type MessageStatus =
  | "PENDING"
  | "PROCESSING"
  | "ACCEPTED"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "CANCELLED";

const STATUS_ADVANCE: Record<
  string,
  { target: MessageStatus; allowedFrom: MessageStatus[] }
> = {
  sent: { target: "SENT", allowedFrom: ["ACCEPTED"] },
  delivered: { target: "DELIVERED", allowedFrom: ["ACCEPTED", "SENT"] },
  read: { target: "READ", allowedFrom: ["ACCEPTED", "SENT", "DELIVERED"] },
  failed: {
    target: "FAILED",
    allowedFrom: [
      "PENDING",
      "PROCESSING",
      "ACCEPTED",
      "SENT",
      "DELIVERED",
      "READ",
    ],
  },
};

export interface WebhookHandleResult {
  received: true;
  duplicate: boolean;
  handled: boolean;
}

@Injectable()
export class WhatsAppWebhookService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  verify(query: Record<string, unknown>): string {
    const mode = typeof query["hub.mode"] === "string" ? query["hub.mode"] : "";
    const token = typeof query["hub.verify_token"] === "string" ? query["hub.verify_token"] : "";
    const challenge = typeof query["hub.challenge"] === "string" ? query["hub.challenge"] : "";

    const expected = env.WHATSAPP_VERIFY_TOKEN;
    if (!expected || mode !== "subscribe" || token !== expected || !challenge) {
      throw new ForbiddenException("Verificação do webhook recusada");
    }
    return challenge;
  }

  async handle(params: {
    rawBody: Buffer;
    body: unknown;
    signature?: string | null;
  }): Promise<WebhookHandleResult> {
    this.assertSignature(params.rawBody, params.signature);

    const eventId = createHash("sha256").update(params.rawBody).digest("hex");
    const payload = (typeof params.body === "object" && params.body !== null
      ? params.body
      : {}) as GraphPayload;

    let event;
    try {
      event = await this.prisma.whatsAppWebhookEvent.create({
        data: {
          eventId,
          payload: payload as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // entrega repetida do provedor: idempotente, nada é reprocessado
        return { received: true, duplicate: true, handled: false };
      }
      throw error;
    }

    const outcome = await this.processPayload(payload);

    await this.prisma.whatsAppWebhookEvent.update({
      where: { id: event.id },
      data: {
        kind: outcome.kind,
        phoneNumberId: outcome.phoneNumberId,
        companyId: outcome.companyId,
        providerMessageId: outcome.providerMessageId,
        handled: outcome.handled,
      },
    });

    return { received: true, duplicate: false, handled: outcome.handled };
  }

  /**
   * Autenticidade: quando WHATSAPP_APP_SECRET existe, exige assinatura
   * X-Hub-Signature-256 válida (HMAC SHA-256 do corpo). Sem o secret em
   * produção o webhook é recusado (nada é aceito sem validação); em
   * desenvolvimento/teste local o processamento segue sem assinatura.
   */
  private assertSignature(rawBody: Buffer, signature?: string | null) {
    const secret = env.WHATSAPP_APP_SECRET;

    if (!secret) {
      if (env.NODE_ENV === "production") {
        throw new ServiceUnavailableException("Webhook secret não configurado no servidor");
      }
      return;
    }

    if (!signature || !signature.startsWith("sha256=")) {
      throw new ForbiddenException("Assinatura do webhook ausente ou inválida");
    }

    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const received = signature.slice("sha256=".length);

    const expectedBuffer = Buffer.from(expected, "hex");
    const receivedBuffer = Buffer.from(received, "hex");
    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new ForbiddenException("Assinatura do webhook ausente ou inválida");
    }
  }

  private async processPayload(payload: GraphPayload): Promise<{
    kind: "STATUS" | "INBOUND" | "OTHER";
    phoneNumberId: string | null;
    companyId: string | null;
    providerMessageId: string | null;
    handled: boolean;
  }> {
    if (payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
      return { kind: "OTHER", phoneNumberId: null, companyId: null, providerMessageId: null, handled: false };
    }

    let kind: "STATUS" | "INBOUND" | "OTHER" = "OTHER";
    let phoneNumberId: string | null = null;
    let companyId: string | null = null;
    let providerMessageId: string | null = null;
    let handled = false;

    for (const entry of payload.entry) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages" || !change.value) continue;

        const metadataPhoneId = change.value.metadata?.phone_number_id ?? null;
        if (metadataPhoneId && !phoneNumberId) phoneNumberId = metadataPhoneId;

        const config = metadataPhoneId
          ? await this.prisma.whatsAppConfig.findFirst({
              where: { phoneNumberId: metadataPhoneId },
              select: { companyId: true },
            })
          : null;
        if (config) companyId = config.companyId;

        for (const status of change.value.statuses ?? []) {
          if (!status.id || !status.status) continue;
          if (providerMessageId === null) providerMessageId = status.id;
          const updated = await this.applyStatus(config?.companyId ?? null, status);
          if (updated) handled = true;
        }
        if ((change.value.statuses ?? []).length > 0 && kind === "OTHER") kind = "STATUS";

        for (const inbound of change.value.messages ?? []) {
          if (kind === "OTHER") kind = "INBOUND";
          if (!config) continue;
          const updated = await this.applyInbound(config.companyId, inbound);
          if (updated) handled = true;
        }
      }
    }

    return { kind, phoneNumberId, companyId, providerMessageId, handled };
  }

  private async applyStatus(companyId: string | null, status: GraphStatus): Promise<boolean> {
    const advance = STATUS_ADVANCE[status.status ?? ""];
    if (!advance) return false;

    const message = await this.prisma.whatsAppMessage.findFirst({
      where: { providerMessageId: status.id },
      select: { id: true, companyId: true },
    });
    if (!message) return false;
    if (companyId && message.companyId !== companyId) return false;

    const failure = status.status === "failed" ? status.errors?.[0] : undefined;

    const result = await this.prisma.whatsAppMessage.updateMany({
      where: { id: message.id, status: { in: advance.allowedFrom } },
      data: {
        status: advance.target,
        ...(advance.target === "FAILED" && failure
          ? {
              failureReason: String(failure.code ?? "PROVIDER_FAILED").slice(0, 60),
              failureDetail: (failure.title ?? failure.message ?? "Falha reportada pelo provedor")
                .slice(0, 300),
            }
          : {}),
      },
    });

    return result.count > 0;
  }

  private async applyInbound(companyId: string, inbound: GraphInboundMessage): Promise<boolean> {
    if (inbound.type !== "text" || !inbound.text?.body || !inbound.from) return false;
    if (!isOptOutText(inbound.text.body)) return false;

    const from = inbound.from.replace(/\D+/g, "");
    if (!from) return false;

    const consent = await this.findConsentByPhone(companyId, from);
    if (!consent || consent.status === "OPTED_OUT") return false;

    await this.prisma.whatsAppConsent.update({
      where: { id: consent.id },
      data: { status: "OPTED_OUT", source: "REPLY", changedAt: new Date() },
    });
    return true;
  }

  private async findConsentByPhone(companyId: string, from: string) {
    const country = env.WHATSAPP_COUNTRY_CODE;
    const variants = new Set<string>([from]);
    if (from.startsWith(country) && from.length > country.length) {
      const local = from.slice(country.length);
      variants.add(local);
      variants.add(`0${local}`);
    } else {
      variants.add(`${country}${from}`);
    }

    const phones = [...variants];

    const byConsent = await this.prisma.whatsAppConsent.findFirst({
      where: { companyId, phone: { in: phones } },
    });
    if (byConsent) return byConsent;

    const client = await this.prisma.client.findFirst({
      where: {
        companyId,
        OR: [{ phone: { in: phones } }, { mobile: { in: phones } }],
      },
      select: { id: true },
    });
    if (!client) return null;

    return this.prisma.whatsAppConsent.findFirst({ where: { clientId: client.id, companyId } });
  }
}
