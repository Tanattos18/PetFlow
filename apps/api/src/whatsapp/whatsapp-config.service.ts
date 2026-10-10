import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WhatsAppProviderError } from "@petflow/whatsapp";
import type {
  UpdateWhatsAppConfigInput,
  UpdateWhatsAppConfigStatusInput,
} from "@petflow/shared";
import { PrismaService } from "../prisma/prisma.module";
import { env } from "../config/env";
import type { AuthContext } from "../common/decorators/auth.decorator";
import { WhatsAppProviderService } from "./whatsapp-provider.service";

@Injectable()
export class WhatsAppConfigService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WhatsAppProviderService) private readonly providerService: WhatsAppProviderService,
  ) {}

  async get(auth: AuthContext) {
    const config = await this.prisma.whatsAppConfig.findUnique({
      where: { companyId: auth.companyId },
    });

    const describe = this.providerService.describe();

    if (!config) {
      return {
        status: "NOT_CONFIGURED" as const,
        phoneNumberId: null,
        wabaId: null,
        displayName: null,
        lastError: null,
        lastHealthAt: null,
        updatedAt: null,
        provider: describe,
        webhook: {
          path: "/api/webhooks/whatsapp",
          verifyConfigured: Boolean(env.WHATSAPP_VERIFY_TOKEN),
          signatureConfigured: Boolean(env.WHATSAPP_APP_SECRET),
        },
      };
    }

    return {
      status: config.status,
      phoneNumberId: config.phoneNumberId,
      wabaId: config.wabaId,
      displayName: config.displayName,
      lastError: config.lastError,
      lastHealthAt: config.lastHealthAt,
      updatedAt: config.updatedAt,
      provider: describe,
      webhook: {
        path: "/api/webhooks/whatsapp",
        verifyConfigured: Boolean(env.WHATSAPP_VERIFY_TOKEN),
        signatureConfigured: Boolean(env.WHATSAPP_APP_SECRET),
      },
    };
  }

  async update(auth: AuthContext, input: UpdateWhatsAppConfigInput) {
    const existing = await this.prisma.whatsAppConfig.findUnique({
      where: { companyId: auth.companyId },
    });

    const data = {
      ...(input.phoneNumberId !== undefined ? { phoneNumberId: input.phoneNumberId || null } : {}),
      ...(input.wabaId !== undefined ? { wabaId: input.wabaId || null } : {}),
      ...(input.displayName !== undefined ? { displayName: input.displayName || null } : {}),
      lastError: null,
      ...(existing && existing.status === "ERROR" ? { status: "CONFIGURED" as const } : {}),
    };

    const config = await this.prisma.whatsAppConfig.upsert({
      where: { companyId: auth.companyId },
      create: {
        companyId: auth.companyId,
        phoneNumberId: input.phoneNumberId || null,
        wabaId: input.wabaId || null,
        displayName: input.displayName || null,
      },
      update: data,
    });

    return config;
  }

  async updateStatus(auth: AuthContext, input: UpdateWhatsAppConfigStatusInput) {
    const config = await this.prisma.whatsAppConfig.findUnique({
      where: { companyId: auth.companyId },
    });

    if (!config) {
      throw new NotFoundException("Integração não configurada");
    }

    return this.prisma.whatsAppConfig.update({
      where: { id: config.id },
      data: {
        status: input.status,
        ...(input.status === "CONFIGURED" ? { lastError: null } : {}),
      },
    });
  }

  /**
   * Teste de saúde: só usa endpoint oficial quando há credenciais no
   * servidor. Credencial ausente → 400 sem tocar no status; resposta
   * inválida do provedor → status ERROR com mensagem segura (o adapter
   * remove tokens antes de expor o texto).
   */
  async health(auth: AuthContext) {
    const config = await this.prisma.whatsAppConfig.findUnique({
      where: { companyId: auth.companyId },
    });

    if (!config) {
      throw new BadRequestException("Configure a integração antes de testar");
    }
    if (!config.phoneNumberId) {
      throw new BadRequestException("Informe o número de telefone (phone number ID) antes do teste");
    }

    let provider;
    try {
      provider = this.providerService.get();
    } catch {
      throw new BadRequestException("Credenciais do provedor não configuradas no servidor");
    }

    try {
      const info = await provider.getPhoneNumberInfo(config.phoneNumberId);
      const updated = await this.prisma.whatsAppConfig.update({
        where: { id: config.id },
        data: {
          status: "ACTIVE",
          lastError: null,
          lastHealthAt: new Date(),
          ...(info.verifiedName && !config.displayName
            ? { displayName: info.verifiedName }
            : {}),
        },
      });
      return {
        ok: true,
        status: updated.status,
        verifiedName: info.verifiedName,
        displayPhoneNumber: info.displayPhoneNumber,
        lastHealthAt: updated.lastHealthAt,
      };
    } catch (error) {
      const message =
        error instanceof WhatsAppProviderError
          ? error.message
          : "Falha inesperada ao contatar o provedor";

      await this.prisma.whatsAppConfig.update({
        where: { id: config.id },
        data: { status: "ERROR", lastError: message, lastHealthAt: new Date() },
      });

      return { ok: false, status: "ERROR" as const, message };
    }
  }
}
