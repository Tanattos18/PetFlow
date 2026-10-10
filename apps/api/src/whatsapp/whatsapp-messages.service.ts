import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { toE164 } from "@petflow/whatsapp";
import {
  templateVariableCount,
  type CancelWhatsAppMessageInput,
  type CreateWhatsAppMessageInput,
  type ListWhatsAppMessagesQuery,
} from "@petflow/shared";
import { PrismaService } from "../prisma/prisma.module";
import { env } from "../config/env";
import type { AuthContext } from "../common/decorators/auth.decorator";

const messageSelect = {
  id: true,
  companyId: true,
  clientId: true,
  templateId: true,
  consentId: true,
  toPhone: true,
  variables: true,
  templateNameSnapshot: true,
  templateLanguageSnapshot: true,
  templateBodySnapshot: true,
  status: true,
  origin: true,
  attempts: true,
  maxAttempts: true,
  nextAttemptAt: true,
  lastAttemptAt: true,
  providerMessageId: true,
  failureReason: true,
  failureDetail: true,
  idempotencyKey: true,
  cancelReason: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
  template: { select: { id: true, name: true, approval: true, status: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

type MessageRecord = Prisma.WhatsAppMessageGetPayload<{ select: typeof messageSelect }>;

function formatMessage(message: MessageRecord) {
  return { ...message, variables: (message.variables as string[] | null) ?? [] };
}

@Injectable()
export class WhatsAppMessagesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(auth: AuthContext, query: ListWhatsAppMessagesQuery) {
    const andConditions: Prisma.WhatsAppMessageWhereInput[] = [];

    if (query.search) {
      andConditions.push({
        OR: [
          { toPhone: { contains: query.search } },
          { client: { name: { contains: query.search, mode: "insensitive" } } },
        ],
      });
    }
    if (query.status) andConditions.push({ status: query.status });
    if (query.origin) andConditions.push({ origin: query.origin });
    if (query.clientId) andConditions.push({ clientId: query.clientId });
    if (query.templateId) andConditions.push({ templateId: query.templateId });
    if (query.from || query.to) {
      andConditions.push({
        createdAt: {
          ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
          ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
        },
      });
    }

    const where: Prisma.WhatsAppMessageWhereInput = {
      companyId: auth.companyId,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.whatsAppMessage.findMany({
        where,
        select: messageSelect,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.whatsAppMessage.count({ where }),
    ]);

    return {
      items: items.map(formatMessage),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(auth: AuthContext, id: string) {
    const message = await this.prisma.whatsAppMessage.findFirst({
      where: { id, companyId: auth.companyId },
      select: {
        ...messageSelect,
        attemptsLog: {
          orderBy: { attemptNumber: "asc" },
          select: {
            id: true,
            attemptNumber: true,
            outcome: true,
            providerMessageId: true,
            errorCode: true,
            errorMessage: true,
            httpStatus: true,
            startedAt: true,
            finishedAt: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException("Mensagem não encontrada");
    }

    return formatMessage(message);
  }

  /**
   * Enfileira uma mensagem de template. Toda validação acontece no servidor:
   * configuração ativa, cliente ativo, telefone normalizado para E.164,
   * consentimento OPTED_IN, template aprovado e contagem de variáveis.
   * A entrega em si é feita pelo worker (fila persistente).
   */
  async create(auth: AuthContext, input: CreateWhatsAppMessageInput) {
    const config = await this.prisma.whatsAppConfig.findUnique({
      where: { companyId: auth.companyId },
    });

    if (!config) {
      throw new ConflictException("Integração não configurada");
    }
    if (config.status === "DISCONNECTED") {
      throw new ConflictException("Integração desconectada");
    }
    if (!config.phoneNumberId) {
      throw new BadRequestException("Configure o número de telefone da integração");
    }

    const client = await this.prisma.client.findFirst({
      where: { id: input.clientId, companyId: auth.companyId },
      select: { id: true, status: true, phone: true, mobile: true },
    });

    if (!client) {
      throw new NotFoundException("Cliente não encontrado");
    }
    if (client.status !== "ACTIVE") {
      throw new BadRequestException("Cliente está inativo");
    }

    const to = toE164(client.phone || client.mobile || "", env.WHATSAPP_COUNTRY_CODE);
    if (!to) {
      throw new BadRequestException("Cliente sem telefone válido para WhatsApp");
    }

    const consent = await this.prisma.whatsAppConsent.findFirst({
      where: { clientId: client.id, companyId: auth.companyId },
      select: { id: true, status: true },
    });

    if (!consent) {
      throw new BadRequestException("Cliente sem consentimento registrado para mensagens");
    }
    if (consent.status === "OPTED_OUT") {
      throw new BadRequestException("Cliente realizou descadastro — novos envios bloqueados");
    }

    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: { id: input.templateId, companyId: auth.companyId },
      select: {
        id: true,
        name: true,
        language: true,
        body: true,
        status: true,
        approval: true,
      },
    });

    if (!template) {
      throw new NotFoundException("Template não encontrado");
    }
    if (template.status !== "ACTIVE") {
      throw new BadRequestException("Template está inativo");
    }
    if (template.approval !== "APPROVED") {
      throw new BadRequestException(
        "Template ainda não tem aprovação registrada do provedor",
      );
    }

    const expectedVariables = templateVariableCount(template.body);
    if (input.variables.length !== expectedVariables) {
      throw new BadRequestException(
        expectedVariables === 0
          ? "Este template não aceita variáveis"
          : `Este template exige ${expectedVariables} variável(is)`,
      );
    }

    try {
      const message = await this.prisma.whatsAppMessage.create({
        data: {
          companyId: auth.companyId,
          clientId: client.id,
          templateId: template.id,
          consentId: consent.id,
          toPhone: to,
          variables: input.variables,
          templateNameSnapshot: template.name,
          templateLanguageSnapshot: template.language,
          templateBodySnapshot: template.body,
          idempotencyKey: input.idempotencyKey || null,
          nextAttemptAt: new Date(),
          createdByUserId: auth.userId,
        },
        select: messageSelect,
      });

      return formatMessage(message);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Mensagem duplicada (idempotencyKey já utilizado)");
      }
      throw error;
    }
  }

  async cancel(auth: AuthContext, id: string, input: CancelWhatsAppMessageInput) {
    const message = await this.prisma.whatsAppMessage.findFirst({
      where: { id, companyId: auth.companyId },
      select: { id: true, status: true },
    });

    if (!message) {
      throw new NotFoundException("Mensagem não encontrada");
    }
    if (message.status !== "PENDING") {
      throw new ConflictException(
        "Apenas mensagens pendentes podem ser canceladas (já processadas não são revertidas)",
      );
    }

    const updated = await this.prisma.whatsAppMessage.update({
      where: { id: message.id },
      data: {
        status: "CANCELLED",
        cancelReason: input.reason,
        cancelledByUserId: auth.userId,
        nextAttemptAt: null,
      },
      select: messageSelect,
    });

    return formatMessage(updated);
  }
}
