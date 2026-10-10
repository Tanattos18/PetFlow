import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { toE164 } from "@petflow/whatsapp";
import type {
  ListWhatsAppConsentsQuery,
  UpsertWhatsAppConsentInput,
} from "@petflow/shared";
import { PrismaService } from "../prisma/prisma.module";
import { env } from "../config/env";
import type { AuthContext } from "../common/decorators/auth.decorator";

const consentSelect = {
  id: true,
  companyId: true,
  clientId: true,
  status: true,
  source: true,
  phone: true,
  notes: true,
  updatedByUserId: true,
  changedAt: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true, phone: true, mobile: true, status: true } },
} as const;

type ConsentRecord = Prisma.WhatsAppConsentGetPayload<{ select: typeof consentSelect }>;

function formatConsent(consent: ConsentRecord) {
  const { client, ...rest } = consent;
  return { ...rest, client };
}

@Injectable()
export class WhatsAppConsentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(auth: AuthContext, query: ListWhatsAppConsentsQuery) {
    const andConditions: Prisma.WhatsAppConsentWhereInput[] = [];

    if (query.search) {
      andConditions.push({
        client: {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { phone: { contains: query.search } },
            { mobile: { contains: query.search } },
          ],
        },
      });
    }
    if (query.status) andConditions.push({ status: query.status });
    if (query.clientId) andConditions.push({ clientId: query.clientId });

    const where: Prisma.WhatsAppConsentWhereInput = {
      companyId: auth.companyId,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.whatsAppConsent.findMany({
        where,
        select: consentSelect,
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.whatsAppConsent.count({ where }),
    ]);

    return {
      items: items.map(formatConsent),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(auth: AuthContext, clientId: string) {
    const consent = await this.prisma.whatsAppConsent.findFirst({
      where: { clientId, companyId: auth.companyId },
      select: consentSelect,
    });
    return consent ? formatConsent(consent) : null;
  }

  /**
   * Consentimento é registro de compliance: OPTED_IN (pré-requisito para
   * envios proativos) exige ADMIN; descadastro (OPTED_OUT) pode ser
   * registrado por qualquer usuário autenticado — sempre favorecendo a
   * privacidade do cliente.
   */
  async upsert(auth: AuthContext, clientId: string, input: UpsertWhatsAppConsentInput) {
    if (input.status === "OPTED_IN" && auth.role !== "ADMIN") {
      throw new ForbiddenException("Apenas administradores podem registrar consentimento proativo");
    }

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId: auth.companyId },
      select: { id: true, phone: true, mobile: true },
    });

    if (!client) {
      throw new NotFoundException("Cliente não encontrado");
    }

    const phone = toE164(client.phone || client.mobile || "", env.WHATSAPP_COUNTRY_CODE);

    const consent = await this.prisma.whatsAppConsent.upsert({
      where: { clientId: client.id },
      create: {
        companyId: auth.companyId,
        clientId: client.id,
        status: input.status,
        source: input.source,
        phone,
        notes: input.notes || null,
        updatedByUserId: auth.userId,
        changedAt: new Date(),
      },
      update: {
        status: input.status,
        source: input.source,
        phone,
        notes: input.notes || null,
        updatedByUserId: auth.userId,
        changedAt: new Date(),
      },
      select: consentSelect,
    });

    return formatConsent(consent);
  }
}
