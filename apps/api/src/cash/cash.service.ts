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
  CashSummaryQuery,
  CloseCashSessionInput,
  CreateCashMovementInput,
  ListCashMovementsQuery,
  OpenCashSessionInput,
  ReversalCashMovementInput,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";
import { lockOpenCashSession } from "./cash-session.helpers";

const cashSessionSelect = {
  id: true,
  status: true,
  initialAmount: true,
  openingNotes: true,
  openedAt: true,
  openedBy: { select: { id: true, name: true } },
  closedAt: true,
  closedBy: { select: { id: true, name: true } },
  closingNotes: true,
  countedAmount: true,
  expectedAmount: true,
  difference: true,
} as const;

type CashSessionRecord = Prisma.CashSessionGetPayload<{ select: typeof cashSessionSelect }>;

const cashMovementSelect = {
  id: true,
  type: true,
  origin: true,
  inCash: true,
  amount: true,
  description: true,
  justification: true,
  saleId: true,
  sale: { select: { id: true, receiptCode: true } },
  reversalOfId: true,
  reversalOf: { select: { id: true, description: true, amount: true, type: true } },
  reversedAt: true,
  reversedBy: { select: { id: true, name: true } },
  reversalReason: true,
  cashSessionId: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
} as const;

type CashMovementRecord = Prisma.CashMovementGetPayload<{ select: typeof cashMovementSelect }>;

function formatSession(session: CashSessionRecord) {
  return {
    ...session,
    initialAmount: session.initialAmount.toFixed(2),
    countedAmount: session.countedAmount ? session.countedAmount.toFixed(2) : null,
    expectedAmount: session.expectedAmount ? session.expectedAmount.toFixed(2) : null,
    difference: session.difference ? session.difference.toFixed(2) : null,
  };
}

function formatMovement(movement: CashMovementRecord) {
  return {
    ...movement,
    amount: movement.amount.toFixed(2),
    reversalOf: movement.reversalOf
      ? { ...movement.reversalOf, amount: movement.reversalOf.amount.toFixed(2) }
      : null,
  };
}

function dateRange(query: { from?: string; to?: string }) {
  return {
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
            ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  };
}

@Injectable()
export class CashService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async open(auth: AuthContext, input: OpenCashSessionInput) {
    return this.prisma.$transaction(async (tx) => {
      // Serializa aberturas/fechamentos simultâneos da mesma empresa.
      await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${auth.companyId} FOR UPDATE`;

      const existing = await tx.cashSession.findFirst({
        where: { companyId: auth.companyId, status: "OPEN" },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException("Já existe um caixa aberto nesta empresa");
      }

      const session = await tx.cashSession.create({
        data: {
          companyId: auth.companyId,
          initialAmount: new Prisma.Decimal(input.initialAmount),
          openingNotes: input.notes ?? null,
          openedByUserId: auth.userId,
        },
        select: cashSessionSelect,
      });

      return formatSession(session);
    });
  }

  async current(auth: AuthContext) {
    const session = await this.prisma.cashSession.findFirst({
      where: { companyId: auth.companyId, status: "OPEN" },
      select: cashSessionSelect,
      orderBy: { openedAt: "desc" },
    });

    if (!session) {
      throw new NotFoundException("Nenhuma sessão de caixa aberta");
    }

    const totals = await this.sessionTotals(this.prisma, session.id);
    const expected = new Prisma.Decimal(session.initialAmount)
      .plus(totals.entriesTotal)
      .minus(totals.exitsTotal);

    return {
      ...formatSession(session),
      ...totals,
      expectedBalance: expected.toFixed(2),
    };
  }

  async sessions(auth: AuthContext) {
    const where = { companyId: auth.companyId };
    const [items, total] = await Promise.all([
      this.prisma.cashSession.findMany({
        where,
        select: cashSessionSelect,
        orderBy: { openedAt: "desc" },
        skip: 0,
        take: 50,
      }),
      this.prisma.cashSession.count({ where }),
    ]);

    const sessions = await Promise.all(
      items.map(async (session) => {
        const totals = await this.sessionTotals(this.prisma, session.id);
        return {
          ...formatSession(session),
          ...totals,
          expectedBalance: session.expectedAmount
            ? session.expectedAmount.toFixed(2)
            : new Prisma.Decimal(session.initialAmount)
                .plus(totals.entriesTotal)
                .minus(totals.exitsTotal)
                .toFixed(2),
        };
      }),
    );

    return { items: sessions, total, page: 1, pageSize: 50 };
  }

  async sessionSummary(auth: AuthContext, sessionId: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { id: sessionId, companyId: auth.companyId },
      select: cashSessionSelect,
    });
    if (!session) {
      throw new NotFoundException("Sessão de caixa não encontrada");
    }

    const totals = await this.sessionTotals(this.prisma, session.id);
    const expected = new Prisma.Decimal(session.initialAmount)
      .plus(totals.entriesTotal)
      .minus(totals.exitsTotal);

    const counted = session.countedAmount;

    return {
      ...formatSession(session),
      ...totals,
      expectedBalance: expected.toFixed(2),
      differenceBalance: counted
        ? counted.minus(expected).toFixed(2)
        : null,
    };
  }

  async close(auth: AuthContext, sessionId: string, input: CloseCashSessionInput) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; status: string; initialAmount: Prisma.Decimal }>
      >`
        SELECT id, status, "initialAmount" FROM "CashSession"
        WHERE id = ${sessionId} AND "companyId" = ${auth.companyId}
        FOR UPDATE`;

      const row = rows[0];
      if (!row) {
        throw new NotFoundException("Sessão de caixa não encontrada");
      }
      if (row.status !== "OPEN") {
        throw new ConflictException("Caixa já fechado");
      }

      const entries = await tx.cashMovement.aggregate({
        where: { cashSessionId: row.id, type: "IN", inCash: true },
        _sum: { amount: true },
      });
      const exits = await tx.cashMovement.aggregate({
        where: { cashSessionId: row.id, type: "OUT", inCash: true },
        _sum: { amount: true },
      });

      const expected = new Prisma.Decimal(row.initialAmount)
        .plus(entries._sum.amount ?? 0)
        .minus(exits._sum.amount ?? 0);
      const counted = new Prisma.Decimal(input.countedAmount);
      const difference = counted.minus(expected);

      const session = await tx.cashSession.update({
        where: { id: row.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedByUserId: auth.userId,
          closingNotes: input.notes ?? null,
          countedAmount: counted,
          expectedAmount: expected,
          difference,
        },
        select: cashSessionSelect,
      });

      const totals = await this.sessionTotals(tx, row.id);

      return {
        ...formatSession(session),
        ...totals,
        expectedBalance: expected.toFixed(2),
        differenceBalance: difference.toFixed(2),
      };
    });
  }

  async createManualMovement(auth: AuthContext, input: CreateCashMovementInput) {
    return this.prisma.$transaction(async (tx) => {
      const session = await lockOpenCashSession(
        tx,
        auth.companyId,
        "registrar movimentações",
      );

      const movement = await tx.cashMovement.create({
        data: {
          companyId: auth.companyId,
          cashSessionId: session.id,
          type: input.type,
          origin: "MANUAL",
          inCash: true,
          amount: new Prisma.Decimal(input.amount),
          description: input.description,
          justification: input.type === "OUT" ? input.justification ?? null : null,
          createdByUserId: auth.userId,
        },
        select: cashMovementSelect,
      });

      return formatMovement(movement);
    });
  }

  async movements(auth: AuthContext, query: ListCashMovementsQuery) {
    const where: Prisma.CashMovementWhereInput = {
      companyId: auth.companyId,
      ...dateRange(query),
      ...(query.sessionId ? { cashSessionId: query.sessionId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.origin ? { origin: query.origin } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.cashMovement.findMany({
        where,
        select: cashMovementSelect,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.cashMovement.count({ where }),
    ]);

    return {
      items: items.map(formatMovement),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async reversal(auth: AuthContext, movementId: string, input: ReversalCashMovementInput) {
    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.cashMovement.findFirst({
        where: { id: movementId, companyId: auth.companyId },
        select: cashMovementSelect,
      });
      if (!movement) {
        throw new NotFoundException("Lançamento não encontrado");
      }
      if (movement.origin !== "MANUAL") {
        throw new BadRequestException(
          "Apenas lançamentos manuais podem ser estornados; para vendas use o cancelamento da venda",
        );
      }
      if (movement.reversedAt) {
        throw new ConflictException("Lançamento já estornado");
      }

      const sessionRows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status FROM "CashSession"
        WHERE id = ${movement.cashSessionId}
        FOR UPDATE`;
      if (sessionRows[0]?.status !== "OPEN") {
        throw new ConflictException(
          "Sessão de caixa fechada: não é possível estornar lançamentos",
        );
      }

      const updated = await tx.cashMovement.updateMany({
        where: { id: movement.id, reversedAt: null },
        data: {
          reversedAt: new Date(),
          reversedByUserId: auth.userId,
          reversalReason: input.reason,
        },
      });
      if (updated.count === 0) {
        throw new ConflictException("Lançamento já estornado");
      }

      const reversal = await tx.cashMovement.create({
        data: {
          companyId: auth.companyId,
          cashSessionId: movement.cashSessionId,
          type: movement.type === "IN" ? "OUT" : "IN",
          origin: "REVERSAL",
          inCash: movement.inCash,
          amount: movement.amount,
          description: `Estorno: ${movement.description}`,
          justification: input.reason,
          reversalOfId: movement.id,
          createdByUserId: auth.userId,
        },
        select: cashMovementSelect,
      });

      return formatMovement(reversal);
    });
  }

  async summary(auth: AuthContext, query: CashSummaryQuery) {
    const base: Prisma.CashMovementWhereInput = {
      companyId: auth.companyId,
      ...dateRange(query),
      ...(query.sessionId ? { cashSessionId: query.sessionId } : {}),
    };

    const sum = (where: Prisma.CashMovementWhereInput) =>
      this.prisma.cashMovement.aggregate({
        where: { ...base, ...where },
        _sum: { amount: true },
      });

    const [sales, manualEntries, manualExits, cancelments, reversalsIn, reversalsOut, totalIn, totalOut] =
      await Promise.all([
        sum({ origin: "SALE" }),
        sum({ origin: "MANUAL", type: "IN" }),
        sum({ origin: "MANUAL", type: "OUT" }),
        sum({ origin: "SALE_CANCELMENT" }),
        sum({ origin: "REVERSAL", type: "IN" }),
        sum({ origin: "REVERSAL", type: "OUT" }),
        sum({ type: "IN" }),
        sum({ type: "OUT" }),
      ]);

    const amount = (value: { _sum: { amount: Prisma.Decimal | null } }) =>
      (value._sum.amount ?? new Prisma.Decimal(0)).toFixed(2);

    const reversalsNet = new Prisma.Decimal(amount(reversalsIn)).minus(
      new Prisma.Decimal(amount(reversalsOut)),
    );

    return {
      from: query.from ?? null,
      to: query.to ?? null,
      sessionId: query.sessionId ?? null,
      salesTotal: amount(sales),
      manualEntriesTotal: amount(manualEntries),
      manualExitsTotal: amount(manualExits),
      cancelmentsTotal: amount(cancelments),
      reversalsInTotal: amount(reversalsIn),
      reversalsOutTotal: amount(reversalsOut),
      reversalsNetTotal: reversalsNet.toFixed(2),
      totalIn: amount(totalIn),
      totalOut: amount(totalOut),
      net: new Prisma.Decimal(amount(totalIn)).minus(new Prisma.Decimal(amount(totalOut))).toFixed(2),
    };
  }

  private async sessionTotals(
    prisma: Prisma.TransactionClient | PrismaService,
    cashSessionId: string,
  ) {
    const [entries, exits, sales, cancelments] = await Promise.all([
      prisma.cashMovement.aggregate({
        where: { cashSessionId, type: "IN", inCash: true },
        _sum: { amount: true },
      }),
      prisma.cashMovement.aggregate({
        where: { cashSessionId, type: "OUT", inCash: true },
        _sum: { amount: true },
      }),
      prisma.cashMovement.aggregate({
        where: { cashSessionId, origin: "SALE" },
        _sum: { amount: true },
      }),
      prisma.cashMovement.aggregate({
        where: { cashSessionId, origin: "SALE_CANCELMENT" },
        _sum: { amount: true },
      }),
    ]);

    const value = (result: { _sum: { amount: Prisma.Decimal | null } }) =>
      (result._sum.amount ?? new Prisma.Decimal(0)).toFixed(2);

    return {
      entriesTotal: value(entries),
      exitsTotal: value(exits),
      salesTotal: value(sales),
      cancelmentsTotal: value(cancelments),
    };
  }
}
