import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.module";
import type {
  ListSubscriptionPlansQuery,
  CreateSubscriptionPlanInput,
  UpdateSubscriptionPlanInput,
  UpdateRecordStatusInput,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

function planNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

const planSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  durationDays: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PlanRecord = Prisma.SubscriptionPlanGetPayload<{ select: typeof planSelect }>;

function formatPlan(plan: PlanRecord) {
  return {
    ...plan,
    price: plan.price.toFixed(2),
  };
}

@Injectable()
export class SubscriptionPlansService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(auth: AuthContext, query: ListSubscriptionPlansQuery) {
    const andConditions: Prisma.SubscriptionPlanWhereInput[] = [];

    if (query.search) {
      andConditions.push({
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { description: { contains: query.search, mode: "insensitive" } },
        ],
      });
    }
    if (query.status) andConditions.push({ status: query.status });

    const where: Prisma.SubscriptionPlanWhereInput = {
      companyId: auth.companyId,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.subscriptionPlan.findMany({
        where,
        select: planSelect,
        orderBy: { [query.orderBy]: query.direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.subscriptionPlan.count({ where }),
    ]);

    return {
      items: items.map(formatPlan),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(auth: AuthContext, id: string) {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { id, companyId: auth.companyId },
      select: planSelect,
    });

    if (!plan) {
      throw new NotFoundException("Plano de assinatura não encontrado");
    }

    return formatPlan(plan);
  }

  async create(auth: AuthContext, input: CreateSubscriptionPlanInput) {
    const nameKey = planNameKey(input.name);
    await this.assertUniqueName(auth, nameKey);

    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        companyId: auth.companyId,
        name: input.name,
        nameKey,
        description: input.description || null,
        price: new Prisma.Decimal(input.price),
        durationDays: input.durationDays,
        createdByUserId: auth.userId,
      },
      select: planSelect,
    });

    return formatPlan(plan);
  }

  async update(auth: AuthContext, id: string, input: UpdateSubscriptionPlanInput) {
    const existing = await this.prisma.subscriptionPlan.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!existing) {
      throw new NotFoundException("Plano de assinatura não encontrado");
    }

    const name = input.name !== undefined ? input.name : existing.name;
    const nameKey = planNameKey(name);

    if (nameKey !== existing.nameKey) {
      await this.assertUniqueName(auth, nameKey);
    }

    const updated = await this.prisma.subscriptionPlan.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name, nameKey } : {}),
        ...(input.description !== undefined
          ? { description: input.description || null }
          : {}),
        ...(input.price !== undefined
          ? { price: new Prisma.Decimal(input.price) }
          : {}),
        ...(input.durationDays !== undefined
          ? { durationDays: input.durationDays }
          : {}),
      },
      select: planSelect,
    });

    return formatPlan(updated);
  }

  async updateStatus(auth: AuthContext, id: string, input: UpdateRecordStatusInput) {
    const existing = await this.prisma.subscriptionPlan.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!existing) {
      throw new NotFoundException("Plano de assinatura não encontrado");
    }

    const updated = await this.prisma.subscriptionPlan.update({
      where: { id: existing.id },
      data: { status: input.status },
      select: planSelect,
    });

    return formatPlan(updated);
  }

  private async assertUniqueName(auth: AuthContext, nameKey: string) {
    const duplicate = await this.prisma.subscriptionPlan.findUnique({
      where: { companyId_nameKey: { companyId: auth.companyId, nameKey } },
    });

    if (duplicate) {
      throw new ConflictException(
        "Já existe um plano de assinatura com este nome nesta empresa",
      );
    }
  }
}
