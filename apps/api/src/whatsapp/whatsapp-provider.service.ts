import { Injectable } from "@nestjs/common";
import { createWhatsAppProvider, type WhatsAppProvider } from "@petflow/whatsapp";
import { env } from "../config/env";

/**
 * Fornece o adaptador de provedor do WhatsApp para a API.
 * Padrão: mock (nenhuma mensagem real é enviada sem WHATSAPP_PROVIDER=meta
 * e WHATSAPP_ACCESS_TOKEN configurados).
 */
@Injectable()
export class WhatsAppProviderService {
  private override: WhatsAppProvider | null = null;
  private configOverride: {
    provider: "mock" | "meta";
    accessToken?: string;
    apiVersion?: string;
  } | null = null;

  get(): WhatsAppProvider {
    if (this.override) return this.override;
    return createWhatsAppProvider({
      provider: this.configOverride?.provider ?? env.WHATSAPP_PROVIDER,
      accessToken: this.configOverride?.accessToken ?? env.WHATSAPP_ACCESS_TOKEN,
      apiVersion: this.configOverride?.apiVersion ?? env.WHATSAPP_API_VERSION,
    });
  }

  /** Uso em testes: injeta um provedor controlado (mock com falhas etc.). */
  setProvider(provider: WhatsAppProvider | null): void {
    this.override = provider;
  }

  /**
   * Uso em testes: sobrepõe a configuração de credenciais usada ao criar o
   * provedor (ex.: meta sem token para exercitar o caminho de ausência de
   * credenciais sem tocar no .env).
   */
  setProviderConfig(
    config: { provider: "mock" | "meta"; accessToken?: string; apiVersion?: string } | null,
  ): void {
    this.configOverride = config;
  }

  describe(): { provider: "mock" | "meta"; credentialsConfigured: boolean } {
    const provider = this.configOverride?.provider ?? env.WHATSAPP_PROVIDER;
    const accessToken = this.configOverride?.accessToken ?? env.WHATSAPP_ACCESS_TOKEN;
    return {
      provider,
      credentialsConfigured: Boolean(accessToken),
    };
  }
}
