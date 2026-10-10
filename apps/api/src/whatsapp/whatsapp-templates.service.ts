import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  templateVariableCount,
  type CreateWhatsAppTemplateInput,
  type ListWhatsAppTemplatesQuery,
  type UpdateWhatsAppTemplateInput,
} from "@petflow/shared";
import { PrismaService } from "../prisma/prisma.module";
import type { AuthContext } from "../common/decorators/auth.decorator";
import { clientNameKey } from "../clients/clients.service";

const templateSelect = {
  id: true,
  companyId: true,
  name: true,
  language: true,
  category: true,
  approval: true,
  body: true,
  providerReference: true,
  status: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class WhatsAppTemplatesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(auth: AuthContext, query: ListWhatsAppTemplatesQuery) {
    const andConditions: Prisma.WhatsAppTemplateWhereInput[] = [];

    if (query.search) {
      andConditions.push({
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { body: { contains: query.search, mode: "insensitive" } },
        ],
      });
    }
    if (query.status) andConditions.push({ status: query.status });
    if (query.approval) andConditions.push({ approval: query.approval });

    const where: Prisma.WhatsAppTemplateWhereInput = {
      companyId: auth.companyId,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.whatsAppTemplate.findMany({
        where,
        select: templateSelect,
        orderBy: { [query.orderBy]: query.direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.whatsAppTemplate.count({ where }),
    ]);

    return {
      items: items.map((template) => ({
        ...template,
        variableCount: templateVariableCount(template.body),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(auth: AuthContext, id: string) {
    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: { id, companyId: auth.companyId },
      select: templateSelect,
    });

    if (!template) {
      throw new NotFoundException("Template não encontrado");
    }

    return { ...template, variableCount: templateVariableCount(template.body) };
  }

  async create(auth: AuthContext, input: CreateWhatsAppTemplateInput) {
    const nameKey = clientNameKey(input.name);
    await this.assertNotDuplicated(auth, nameKey);

    const template = await this.prisma.whatsAppTemplate.create({
      data: {
        companyId: auth.companyId,
        name: input.name,
        nameKey,
        language: input.language,
        category: input.category,
        body: input.body,
        providerReference: input.providerReference || null,
        createdByUserId: auth.userId,
        // aprovação só muda por ação explícita do administrador (registra o
        // que a Meta confirmou); criação nunca assume template aprovado
        approval: "PENDING_APPROVAL",
      },
      select: templateSelect,
    });

    return { ...template, variableCount: templateVariableCount(template.body) };
  }

  async update(auth: AuthContext, id: string, input: UpdateWhatsAppTemplateInput) {
    const existing = await this.prisma.whatsAppTemplate.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!existing) {
      throw new NotFoundException("Template não encontrado");
    }

    const name = input.name !== undefined ? input.name : existing.name;
    const nameKey = clientNameKey(name);
    await this.assertNotDuplicated(auth, nameKey, existing.id);

    const updated = await this.prisma.whatsAppTemplate.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name, nameKey } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.providerReference !== undefined
          ? { providerReference: input.providerReference || null }
          : {}),
        ...(input.approval !== undefined ? { approval: input.approval } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      select: templateSelect,
    });

    return { ...updated, variableCount: templateVariableCount(updated.body) };
  }

  private async assertNotDuplicated(auth: AuthContext, nameKey: string, excludeId?: string) {
    const existing = await this.prisma.whatsAppTemplate.findFirst({
      where: {
        companyId: auth.companyId,
        nameKey,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException("Já existe um template com este nome nesta empresa");
    }
  }
}
