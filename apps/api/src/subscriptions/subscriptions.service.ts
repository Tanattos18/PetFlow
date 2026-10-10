import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.module";
import { lockOpenCashSession } from "../cash/cash-session.helpers";
import type {
  CancelSubscriptionInput,
  CreateSubscriptionInput,
  ListSubscriptionsQuery,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

const DAY_MS = 86_400_000;

const subscriptionSelect = {
  id: true,
  clientId: true,
  planId: true,
  startAt: true,
  endAt: true,
  status: true,
  cancelReason: true,
  cancelledAt: true,
  createdByUserId: true,
  renewalCount: true,
  lastPaymentAt: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true, phone: true, mobile: true } },
  plan: {
    select: {
      id: true,
      name: true,
      price: true,
      durationDays: true,
      status: true,
    },
  },
} as const;

type SubscriptionRecord = Prisma.SubscriptionGetPayload<{
  select: typeof subscriptionSelect;
}>;

function formatSubscription(subscription: SubscriptionRecord) {
  return {
    ...subscription,
    plan: {
      ...subscription.plan,
      price: subscription.plan.price.toFixed(2),
    },
  };
}

function formatPayment(payment: {
  id: string;
  amount: Prisma.Decimal;
  description: string;
  createdAt: Date;
  cashSessionId: string;
}) {
  return {
    id: payment.id,
    amount: payment.amount.toFixed(2),
    description: payment.description,
    cashSessionId: payment.cashSessionId,
    createdAt: payment.createdAt,
  };
}

@Injectable()
export class SubscriptionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async expireStale(companyId: string) {
    await this.prisma.subscription.updateMany({
      where: { companyId, status: "ACTIVE", endAt: { lt: new Date() } },
      data: { status: "EXPIRED" },
    });
  }

  async list(auth: AuthContext, query: ListSubscriptionsQuery) {
    await this.expireStale(auth.companyId);

    const andConditions: Prisma.SubscriptionWhereInput[] = [];
    if (query.status) andConditions.push({ status: query.status });
    if (query.clientId) andConditions.push({ clientId: query.clientId });
    if (query.search) {
      andConditions.push({
        OR: [
          { client: { name: { contains: query.search, mode: "insensitive" } } },
          { plan: { name: { contains: query.search, mode: "insensitive" } } },
        ],
      });
    }

    const where: Prisma.SubscriptionWhereInput = {
      companyId: auth.companyId,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        select: subscriptionSelect,
        orderBy: { [query.orderBy]: query.direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      items: items.map(formatSubscription),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(auth: AuthContext, id: string) {
    await this.expireStale(auth.companyId);

    const subscription = await this.prisma.subscription.findFirst({
      where: { id, companyId: auth.companyId },
      select: subscriptionSelect,
    });

    if (!subscription) {
      throw new NotFoundException("Assinatura não encontrada");
    }

    const payments = await this.prisma.cashMovement.findMany({
      where: { subscriptionId: subscription.id, companyId: auth.companyId },
      select: {
        id: true,
        amount: true,
        description: true,
        cashSessionId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      ...formatSubscription(subscription),
      payments: payments.map(formatPayment),
    };
  }

  async create(auth: AuthContext, input: CreateSubscriptionInput) {
    const client = await this.prisma.client.findFirst({
      where: { id: input.clientId, companyId: auth.companyId },
      select: { id: true, name: true, status: true },
    });
    if (!client) {
      throw new NotFoundException("Cliente não encontrado");
    }
    if (client.status !== "ACTIVE") {
      throw new BadRequestException("Cliente inativo");
    }

    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { id: input.planId, companyId: auth.companyId },
      select: { id: true, name: true, price: true, durationDays: true, status: true },
    });
    if (!plan) {
      throw new NotFoundException("Plano de assinatura não encontrado");
    }
    if (plan.status !== "ACTIVE") {
      throw new BadRequestException("Plano de assinatura inativo");
    }

    const startAt = input.startAt ? new Date(input.startAt) : new Date();
    const endAt = new Date(startAt.getTime() + plan.durationDays * DAY_MS);

    if (input.registerPayment) {
      return this.prisma.$transaction(async (tx) => {
        const session = await lockOpenCashSession(
          tx,
          auth.companyId,
          "registrar pagamento de assinatura",
        );

        const created = await tx.subscription.create({
          data: {
            companyId: auth.companyId,
            clientId: client.id,
            planId: plan.id,
            startAt,
            endAt,
            lastPaymentAt: new Date(),
            createdByUserId: auth.userId,
          },
          select: subscriptionSelect,
        });

        await tx.cashMovement.create({
          data: {
            companyId: auth.companyId,
            cashSessionId: session.id,
            type: "IN",
            origin: "MANUAL",
            inCash: true,
            amount: plan.price,
            description: `Pagamento de assinatura: ${client.name} — ${plan.name}`,
            subscriptionId: created.id,
            createdByUserId: auth.userId,
          },
        });

        return formatSubscription(created);
      });
    }

    const created = await this.prisma.subscription.create({
      data: {
        companyId: auth.companyId,
        clientId: client.id,
        planId: plan.id,
        startAt,
        endAt,
        createdByUserId: auth.userId,
      },
      select: subscriptionSelect,
    });

    return formatSubscription(created);
  }

  async renew(auth: AuthContext, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const session = await lockOpenCashSession(
        tx,
        auth.companyId,
        "renovar assinatura",
      );

      const subscription = await tx.subscription.findFirst({
        where: { id, companyId: auth.companyId },
        include: {
          plan: { select: { name: true, durationDays: true, price: true } },
          client: { select: { name: true } },
        },
      });
      if (!subscription) {
        throw new NotFoundException("Assinatura não encontrada");
      }
      if (subscription.status === "CANCELLED") {
        throw new ConflictException("Assinatura cancelada não pode ser renovada");
      }

      const now = new Date();
      const startAt =
        subscription.endAt.getTime() > now.getTime() ? subscription.endAt : now;
      const endAt = new Date(startAt.getTime() + subscription.plan.durationDays * DAY_MS);

      const updated = await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          startAt,
          endAt,
          status: "ACTIVE",
          renewalCount: { increment: 1 },
          lastPaymentAt: now,
        },
        select: subscriptionSelect,
      });

      await tx.cashMovement.create({
        data: {
          companyId: auth.companyId,
          cashSessionId: session.id,
          type: "IN",
          origin: "MANUAL",
          inCash: true,
          amount: subscription.plan.price,
          description: `Renovação de assinatura: ${subscription.client.name} — ${subscription.plan.name}`,
          subscriptionId: subscription.id,
          createdByUserId: auth.userId,
        },
      });

      return formatSubscription(updated);
    });
  }

  async cancel(auth: AuthContext, id: string, input: CancelSubscriptionInput) {
    await this.expireStale(auth.companyId);

    const existing = await this.prisma.subscription.findFirst({
      where: { id, companyId: auth.companyId },
    });
    if (!existing) {
      throw new NotFoundException("Assinatura não encontrada");
    }

    const result = await this.prisma.subscription.updateMany({
      where: { id: existing.id, status: { in: ["ACTIVE", "EXPIRED"] } },
      data: {
        status: "CANCELLED",
        cancelReason: input.reason,
        cancelledAt: new Date(),
        cancelledByUserId: auth.userId,
      },
    });
    if (result.count === 0) {
      throw new ConflictException("Assinatura já cancelada");
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { id: existing.id },
      select: subscriptionSelect,
    });
    return formatSubscription(subscription!);
  }
}
