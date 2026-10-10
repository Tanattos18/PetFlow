import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.module";
import type {
  CancelTenantSubscriptionInput,
  UpdateTenantSubscriptionInput,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

const DAY_MS = 86_400_000;

const planSelect = {
  id: true,
  name: true,
  description: true,
  priceMonthly: true,
  durationDays: true,
  active: true,
} as const;

type TenantPlanRecord = Prisma.TenantPlanGetPayload<{ select: typeof planSelect }>;

function formatPlan(plan: TenantPlanRecord) {
  return {
    ...plan,
    priceMonthly: plan.priceMonthly.toFixed(2),
  };
}

const subscriptionSelect = {
  id: true,
  companyId: true,
  planId: true,
  status: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  cancelReason: true,
  cancelledAt: true,
  changedByUserId: true,
  createdAt: true,
  updatedAt: true,
  plan: { select: planSelect },
} as const;

type TenantSubscriptionRecord = Prisma.TenantSubscriptionGetPayload<{
  select: typeof subscriptionSelect;
}>;

function formatSubscription(subscription: TenantSubscriptionRecord) {
  return {
    ...subscription,
    plan: formatPlan(subscription.plan),
  };
}

@Injectable()
export class BillingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listPlans() {
    const plans = await this.prisma.tenantPlan.findMany({
      where: { active: true },
      select: planSelect,
      orderBy: { priceMonthly: "asc" },
    });
    return { items: plans.map(formatPlan) };
  }

  private async expireStale(companyId: string) {
    await this.prisma.tenantSubscription.updateMany({
      where: {
        companyId,
        status: "ACTIVE",
        currentPeriodEnd: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    });
  }

  async getSubscription(auth: AuthContext) {
    await this.expireStale(auth.companyId);

    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { companyId: auth.companyId },
      select: subscriptionSelect,
    });

    if (!subscription) {
      throw new NotFoundException("Assinatura não encontrada");
    }

    return formatSubscription(subscription);
  }

  async upsertSubscription(auth: AuthContext, input: UpdateTenantSubscriptionInput) {
    const plan = await this.prisma.tenantPlan.findFirst({
      where: { id: input.planId },
      select: planSelect,
    });
    if (!plan) {
      throw new NotFoundException("Plano não encontrado");
    }
    if (!plan.active) {
      throw new BadRequestException("Plano indisponível");
    }

    const now = new Date();
    const currentPeriodEnd = new Date(now.getTime() + plan.durationDays * DAY_MS);

    const subscription = await this.prisma.tenantSubscription.upsert({
      where: { companyId: auth.companyId },
      create: {
        companyId: auth.companyId,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd,
        changedByUserId: auth.userId,
      },
      update: {
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd,
        cancelReason: null,
        cancelledAt: null,
        changedByUserId: auth.userId,
      },
      select: subscriptionSelect,
    });

    return formatSubscription(subscription);
  }

  async renew(auth: AuthContext) {
    await this.expireStale(auth.companyId);

    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { companyId: auth.companyId },
      select: { ...subscriptionSelect, plan: { select: { durationDays: true } } },
    });
    if (!subscription) {
      throw new NotFoundException("Assinatura não encontrada");
    }
    if (subscription.status === "CANCELLED") {
      throw new ConflictException("Assinatura cancelada não pode ser renovada");
    }

    const now = new Date();
    const currentPeriodStart =
      subscription.currentPeriodEnd.getTime() > now.getTime()
        ? subscription.currentPeriodEnd
        : now;
    const currentPeriodEnd = new Date(
      currentPeriodStart.getTime() + subscription.plan.durationDays * DAY_MS,
    );

    const renewed = await this.prisma.tenantSubscription.update({
      where: { id: subscription.id },
      data: {
        currentPeriodStart,
        currentPeriodEnd,
        status: "ACTIVE",
        changedByUserId: auth.userId,
      },
      select: subscriptionSelect,
    });

    return formatSubscription(renewed);
  }

  async cancel(auth: AuthContext, input: CancelTenantSubscriptionInput) {
    const existing = await this.prisma.tenantSubscription.findUnique({
      where: { companyId: auth.companyId },
    });
    if (!existing) {
      throw new NotFoundException("Assinatura não encontrada");
    }

    const result = await this.prisma.tenantSubscription.updateMany({
      where: { companyId: auth.companyId, status: { not: "CANCELLED" } },
      data: {
        status: "CANCELLED",
        cancelReason: input.reason || null,
        cancelledAt: new Date(),
        changedByUserId: auth.userId,
      },
    });
    if (result.count === 0) {
      throw new ConflictException("Assinatura já cancelada");
    }

    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { companyId: auth.companyId },
      select: subscriptionSelect,
    });
    return formatSubscription(subscription!);
  }
}
