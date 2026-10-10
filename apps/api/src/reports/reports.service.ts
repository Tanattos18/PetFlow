import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  REPORT_DEFAULT_RANGE_DAYS,
  REPORT_TIMEZONE,
  cashMovementOriginLabels,
  cashMovementTypeLabels,
  paymentMethodLabels,
  petSpeciesLabels,
  productUnitLabels,
  saleStatusLabels,
  stockMovementTypeLabels,
  whatsappMessageStatusLabels,
  type CashReportQuery,
  type ClientsReportQuery,
  type DashboardSummaryQuery,
  type SalesReportQuery,
  type StockAlertsReportQuery,
  type StockMovementsReportQuery,
  type WhatsAppReportQuery,
} from "@petflow/shared";
import { PrismaService } from "../prisma/prisma.module";
import type { AuthContext } from "../common/decorators/auth.decorator";
import { CSV_ROW_LIMIT, buildCsv, csvFilename } from "../common/utils/csv";

export interface CsvResult {
  csv: string;
  filename: string;
}

async function appointmentStatusCounts(
  prisma: PrismaService,
  companyId: string,
  range: { gte: Date; lte: Date },
) {
  const groups = await prisma.appointment.groupBy({
    by: ["status"],
    where: { companyId, startAt: range },
    _count: { _all: true },
  });
  const counts = new Map(groups.map((row) => [row.status, row._count._all]));
  return {
    scheduled: counts.get("SCHEDULED") ?? 0,
    confirmed: counts.get("CONFIRMED") ?? 0,
    completed: counts.get("COMPLETED") ?? 0,
    cancelled: counts.get("CANCELLED") ?? 0,
    noShow: counts.get("NO_SHOW") ?? 0,
  };
}

interface ResolvedPeriod {
  from: string;
  to: string;
  start: Date;
  end: Date;
}

function resolvePeriod(query: { from?: string; to?: string }): ResolvedPeriod {
  const today = new Date().toISOString().slice(0, 10);
  const to = query.to ?? today;
  const toMs = Date.parse(`${to}T00:00:00.000Z`);
  const from =
    query.from ??
    new Date(toMs - (REPORT_DEFAULT_RANGE_DAYS - 1) * 86_400_000)
      .toISOString()
      .slice(0, 10);
  return {
    from,
    to,
    start: new Date(`${from}T00:00:00.000Z`),
    end: new Date(`${to}T23:59:59.999Z`),
  };
}

function periodJson(period: ResolvedPeriod) {
  return { from: period.from, to: period.to, timezone: REPORT_TIMEZONE };
}

function money(value: Prisma.Decimal | null | undefined): string {
  return (value ?? new Prisma.Decimal(0)).toFixed(2);
}

function decimalString(value: unknown): string {
  return new Prisma.Decimal(String(value)).toFixed(2);
}

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async summary(auth: AuthContext, query: DashboardSummaryQuery) {
    const period = resolvePeriod(query);
    const companyId = auth.companyId;
    const range = { gte: period.start, lte: period.end };

    const [
      completed,
      cancelled,
      byDay,
      byPayment,
      openSession,
      cashGroups,
      stockCounts,
      newClients,
      newPets,
      waGroups,
      apptCounts,
    ] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { companyId, status: "COMPLETED", createdAt: range },
        _count: { _all: true },
        _sum: { subtotal: true, discount: true, total: true },
      }),
      this.prisma.sale.aggregate({
        where: { companyId, status: "CANCELLED", createdAt: range },
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.$queryRaw<Array<{ day: string; count: bigint; net: unknown }>>`
        SELECT to_char("createdAt", 'YYYY-MM-DD') AS day,
               COUNT(*) AS count,
               COALESCE(SUM("total"), 0) AS net
        FROM "Sale"
        WHERE "companyId" = ${companyId}
          AND "status" = 'COMPLETED'
          AND "createdAt" >= ${period.start}
          AND "createdAt" <= ${period.end}
        GROUP BY day
        ORDER BY day`,
      this.prisma.sale.groupBy({
        by: ["paymentMethod"],
        where: { companyId, status: "COMPLETED", createdAt: range },
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.cashSession.findFirst({
        where: { companyId, status: "OPEN" },
        select: { id: true, openedAt: true, initialAmount: true },
      }),
      this.prisma.cashMovement.groupBy({
        by: ["type", "inCash"],
        where: { companyId, createdAt: range },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.$queryRaw<Array<{ out_count: bigint; low_count: bigint }>>`
        SELECT COUNT(*) FILTER (WHERE "stockQuantity" = 0) AS out_count,
               COUNT(*) FILTER (WHERE "minimumStock" > 0
                                 AND "stockQuantity" <= "minimumStock"
                                 AND "stockQuantity" > 0) AS low_count
        FROM "Product"
        WHERE "companyId" = ${companyId}
          AND "status" = 'ACTIVE'`,
      this.prisma.client.count({ where: { companyId, createdAt: range } }),
      this.prisma.pet.count({ where: { companyId, createdAt: range } }),
      this.prisma.whatsAppMessage.groupBy({
        by: ["status"],
        where: { companyId, createdAt: range },
        _count: { _all: true },
      }),
      appointmentStatusCounts(this.prisma, companyId, range),
    ]);

    const net = completed._sum.total ?? new Prisma.Decimal(0);
    const completedCount = completed._count._all;

    const sumCash = (type: "IN" | "OUT", inCash?: boolean) => {
      const rows = cashGroups.filter(
        (row) => row.type === type && (inCash === undefined || row.inCash === inCash),
      );
      return rows.reduce(
        (acc, row) => acc.plus(row._sum.amount ?? new Prisma.Decimal(0)),
        new Prisma.Decimal(0),
      );
    };

    let openSessionJson: {
      id: string;
      openedAt: string;
      initialAmount: string;
      expectedBalance: string;
    } | null = null;
    if (openSession) {
      const sessionMovements = await this.prisma.cashMovement.groupBy({
        by: ["type"],
        where: {
          cashSessionId: openSession.id,
          inCash: true,
          type: { in: ["IN", "OUT"] },
        },
        _sum: { amount: true },
      });
      const sessionSum = (type: "IN" | "OUT") =>
        sessionMovements
          .filter((row) => row.type === type)
          .reduce(
            (acc, row) => acc.plus(row._sum.amount ?? new Prisma.Decimal(0)),
            new Prisma.Decimal(0),
          );
      const expected = openSession.initialAmount
        .plus(sessionSum("IN"))
        .minus(sessionSum("OUT"));
      openSessionJson = {
        id: openSession.id,
        openedAt: openSession.openedAt.toISOString(),
        initialAmount: openSession.initialAmount.toFixed(2),
        expectedBalance: expected.toFixed(2),
      };
    }

    const waCounts = new Map(waGroups.map((row) => [row.status, row._count._all]));
    const waTotal = waGroups.reduce((acc, row) => acc + row._count._all, 0);

    return {
      period: periodJson(period),
      generatedAt: new Date().toISOString(),
      sales: {
        completedCount,
        gross: money(completed._sum.subtotal),
        discounts: money(completed._sum.discount),
        net: money(net),
        cancelledCount: cancelled._count._all,
        cancelledTotal: money(cancelled._sum.total),
        ticketAverage: completedCount > 0 ? net.div(completedCount).toFixed(2) : null,
      },
      salesByDay: byDay.map((row) => ({
        day: row.day,
        count: Number(row.count),
        net: decimalString(row.net),
      })),
      salesByPaymentMethod: byPayment
        .map((row) => ({
          paymentMethod: row.paymentMethod,
          label: paymentMethodLabels[row.paymentMethod],
          count: row._count._all,
          net: money(row._sum.total),
        }))
        .sort((a, b) => new Prisma.Decimal(b.net).cmp(new Prisma.Decimal(a.net))),
      cash: {
        openSession: openSessionJson,
        entriesInCash: money(sumCash("IN", true)),
        exitsInCash: money(sumCash("OUT", true)),
        entriesTotal: money(sumCash("IN")),
        exitsTotal: money(sumCash("OUT")),
      },
      stock: {
        outOfStockCount: Number(stockCounts[0]?.out_count ?? 0),
        lowStockCount: Number(stockCounts[0]?.low_count ?? 0),
      },
      clients: { newClients, newPets },
      services: apptCounts,
      whatsapp: {
        total: waTotal,
        pending: (waCounts.get("PENDING") ?? 0) + (waCounts.get("PROCESSING") ?? 0),
        accepted: waCounts.get("ACCEPTED") ?? 0,
        sent: waCounts.get("SENT") ?? 0,
        delivered: waCounts.get("DELIVERED") ?? 0,
        read: waCounts.get("READ") ?? 0,
        failed: waCounts.get("FAILED") ?? 0,
        cancelled: waCounts.get("CANCELLED") ?? 0,
      },
      modules: {
        servicesRealized: { available: true, reason: null },
      },
    };
  }

  async sales(auth: AuthContext, query: SalesReportQuery): Promise<object | CsvResult> {
    const period = resolvePeriod(query);
    const companyId = auth.companyId;
    const range = { gte: period.start, lte: period.end };
    const baseWhere: Prisma.SaleWhereInput = {
      companyId,
      createdAt: range,
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
    };
    const listWhere: Prisma.SaleWhereInput = {
      ...baseWhere,
      ...(query.status ? { status: query.status } : {}),
    };
    const isCsv = query.format === "csv";
    const skip = isCsv ? 0 : (query.page - 1) * query.pageSize;
    const take = isCsv ? CSV_ROW_LIMIT : query.pageSize;

    const [completed, cancelled, total, items] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { ...baseWhere, status: "COMPLETED" },
        _count: { _all: true },
        _sum: { subtotal: true, discount: true, total: true },
      }),
      this.prisma.sale.aggregate({
        where: { ...baseWhere, status: "CANCELLED" },
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.sale.count({ where: listWhere }),
      this.prisma.sale.findMany({
        where: listWhere,
        include: {
          client: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);

    const rows = items.map((sale) => ({
      id: sale.id,
      receiptCode: sale.receiptCode,
      createdAt: sale.createdAt.toISOString(),
      status: sale.status,
      paymentMethod: sale.paymentMethod,
      subtotal: sale.subtotal.toFixed(2),
      discount: sale.discount.toFixed(2),
      total: sale.total.toFixed(2),
      client: sale.client?.name ?? null,
      createdBy: sale.createdBy.name,
    }));

    const data = {
      period: periodJson(period),
      generatedAt: new Date().toISOString(),
      totals: {
        completed: {
          count: completed._count._all,
          gross: money(completed._sum.subtotal),
          discounts: money(completed._sum.discount),
          net: money(completed._sum.total),
        },
        cancelled: {
          count: cancelled._count._all,
          total: money(cancelled._sum.total),
        },
      },
      items: rows,
      total,
      page: isCsv ? 1 : query.page,
      pageSize: isCsv ? rows.length : query.pageSize,
    };

    if (!isCsv) return data;

    return {
      csv: buildCsv(
        [
          "Código",
          "Data (UTC)",
          "Status",
          "Forma de pagamento",
          "Subtotal",
          "Desconto",
          "Total",
          "Cliente",
          "Responsável",
        ],
        rows.map((row) => [
          row.receiptCode,
          row.createdAt,
          saleStatusLabels[row.status],
          paymentMethodLabels[row.paymentMethod],
          row.subtotal,
          row.discount,
          row.total,
          row.client ?? "",
          row.createdBy,
        ]),
      ),
      filename: csvFilename("petflow_vendas", period.from, period.to),
    };
  }

  async stockAlerts(
    auth: AuthContext,
    query: StockAlertsReportQuery,
  ): Promise<object | CsvResult> {
    const companyId = auth.companyId;
    const rows = await this.prisma.$queryRaw<Array<{ id: string; is_out: boolean }>>`
      SELECT id, ("stockQuantity" = 0) AS is_out
      FROM "Product"
      WHERE "companyId" = ${companyId}
        AND "status" = 'ACTIVE'
        AND (
          "stockQuantity" = 0
          OR ("minimumStock" > 0 AND "stockQuantity" <= "minimumStock")
        )
      ORDER BY "stockQuantity" ASC, "name" ASC`;

    const outOfStockCount = rows.filter((row) => row.is_out).length;
    const pageRows =
      query.format === "csv"
        ? rows.slice(0, CSV_ROW_LIMIT)
        : rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);

    const products =
      pageRows.length > 0
        ? await this.prisma.product.findMany({
            where: { id: { in: pageRows.map((row) => row.id) } },
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
              stockQuantity: true,
              minimumStock: true,
            },
          })
        : [];

    const isOut = new Map(pageRows.map((row) => [row.id, row.is_out]));
    products.sort((a, b) => {
      const byStock = a.stockQuantity.cmp(b.stockQuantity);
      return byStock !== 0 ? byStock : a.name.localeCompare(b.name);
    });

    const items = products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      unitLabel: productUnitLabels[product.unit],
      stockQuantity: product.stockQuantity.toFixed(3),
      minimumStock: product.minimumStock.toFixed(3),
      alert: isOut.get(product.id) ? ("OUT_OF_STOCK" as const) : ("LOW_STOCK" as const),
    }));

    const data = {
      generatedAt: new Date().toISOString(),
      alerts: {
        total: rows.length,
        outOfStockCount,
        lowStockCount: rows.length - outOfStockCount,
      },
      items,
      total: rows.length,
      page: query.format === "csv" ? 1 : query.page,
      pageSize: query.format === "csv" ? items.length : query.pageSize,
    };

    if (query.format !== "csv") return data;

    return {
      csv: buildCsv(
        ["Produto", "SKU", "Unidade", "Estoque", "Estoque mínimo", "Situação"],
        items.map((item) => [
          item.name,
          item.sku ?? "",
          item.unitLabel,
          item.stockQuantity,
          item.minimumStock,
          item.alert === "OUT_OF_STOCK" ? "Sem estoque" : "Estoque baixo",
        ]),
      ),
      filename: `petflow_estoque_alertas_${new Date().toISOString().slice(0, 10)}.csv`,
    };
  }

  async stockMovements(
    auth: AuthContext,
    query: StockMovementsReportQuery,
  ): Promise<object | CsvResult> {
    const period = resolvePeriod(query);
    const companyId = auth.companyId;
    const range = { gte: period.start, lte: period.end };
    const where: Prisma.StockMovementWhereInput = {
      companyId,
      createdAt: range,
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.type ? { type: query.type } : {}),
    };
    const isCsv = query.format === "csv";
    const skip = isCsv ? 0 : (query.page - 1) * query.pageSize;
    const take = isCsv ? CSV_ROW_LIMIT : query.pageSize;

    const [groups, total, items] = await Promise.all([
      this.prisma.stockMovement.groupBy({
        by: ["type"],
        where,
        _count: { _all: true },
        _sum: { quantity: true },
      }),
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);

    const groupMap = new Map(
      groups.map((row) => [
        row.type,
        { count: row._count._all, quantity: row._sum.quantity ?? new Prisma.Decimal(0) },
      ]),
    );
    const byType = Object.keys(stockMovementTypeLabels).map((type) => {
      const key = type as keyof typeof stockMovementTypeLabels;
      const entry = groupMap.get(key);
      return {
        type: key,
        label: stockMovementTypeLabels[key],
        count: entry?.count ?? 0,
        quantity: (entry?.quantity ?? new Prisma.Decimal(0)).toFixed(3),
      };
    });

    const rows = items.map((movement) => ({
      id: movement.id,
      createdAt: movement.createdAt.toISOString(),
      type: movement.type,
      typeLabel: stockMovementTypeLabels[movement.type],
      quantity: movement.quantity.toFixed(3),
      reference: movement.reference,
      notes: movement.notes,
      product: { name: movement.product.name, sku: movement.product.sku },
      createdBy: movement.createdBy.name,
    }));

    const data = {
      period: periodJson(period),
      generatedAt: new Date().toISOString(),
      totals: { count: total, byType },
      items: rows,
      total,
      page: isCsv ? 1 : query.page,
      pageSize: isCsv ? rows.length : query.pageSize,
    };

    if (!isCsv) return data;

    return {
      csv: buildCsv(
        ["Data (UTC)", "Produto", "SKU", "Tipo", "Quantidade", "Referência", "Observações", "Responsável"],
        rows.map((row) => [
          row.createdAt,
          row.product.name,
          row.product.sku ?? "",
          row.typeLabel,
          row.quantity,
          row.reference ?? "",
          row.notes ?? "",
          row.createdBy,
        ]),
      ),
      filename: csvFilename("petflow_estoque_movimentos", period.from, period.to),
    };
  }

  async cash(auth: AuthContext, query: CashReportQuery) {
    const period = resolvePeriod(query);
    const companyId = auth.companyId;
    const range = { gte: period.start, lte: period.end };

    const [byTypeInCash, byOrigin, reversals, openedCount, closedSessions] =
      await Promise.all([
        this.prisma.cashMovement.groupBy({
          by: ["type", "inCash"],
          where: { companyId, createdAt: range },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        this.prisma.cashMovement.groupBy({
          by: ["origin", "type"],
          where: { companyId, createdAt: range },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        this.prisma.cashMovement.aggregate({
          where: { companyId, createdAt: range, origin: "REVERSAL" },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        this.prisma.cashSession.count({ where: { companyId, openedAt: range } }),
        this.prisma.cashSession.findMany({
          where: { companyId, closedAt: range },
          select: {
            id: true,
            status: true,
            openedAt: true,
            closedAt: true,
            initialAmount: true,
            countedAmount: true,
            expectedAmount: true,
            difference: true,
          },
          orderBy: { closedAt: "desc" },
          take: 100,
        }),
      ]);

    const sumBy = (type: "IN" | "OUT", inCash?: boolean) =>
      byTypeInCash
        .filter((row) => row.type === type && (inCash === undefined || row.inCash === inCash))
        .reduce(
          (acc, row) => acc.plus(row._sum.amount ?? new Prisma.Decimal(0)),
          new Prisma.Decimal(0),
        );

    const entriesInCash = sumBy("IN", true);
    const exitsInCash = sumBy("OUT", true);
    const entriesAll = sumBy("IN");
    const exitsAll = sumBy("OUT");

    const closedWithDifference = closedSessions.filter(
      (session) => session.difference !== null && !session.difference.isZero(),
    );
    const totalDifference = closedSessions.reduce(
      (acc, session) => acc.plus(session.difference ?? new Prisma.Decimal(0)),
      new Prisma.Decimal(0),
    );

    return {
      period: periodJson(period),
      generatedAt: new Date().toISOString(),
      movements: {
        inCash: {
          entries: entriesInCash.toFixed(2),
          exits: exitsInCash.toFixed(2),
          net: entriesInCash.minus(exitsInCash).toFixed(2),
        },
        all: {
          entries: entriesAll.toFixed(2),
          exits: exitsAll.toFixed(2),
        },
        byOrigin: byOrigin
          .map((row) => ({
            origin: row.origin,
            originLabel: cashMovementOriginLabels[row.origin],
            type: row.type,
            typeLabel: cashMovementTypeLabels[row.type],
            count: row._count._all,
            total: money(row._sum.amount),
          }))
          .sort((a, b) => a.origin.localeCompare(b.origin) || a.type.localeCompare(b.type)),
        reversals: {
          count: reversals._count._all,
          total: money(reversals._sum.amount),
        },
      },
      sessions: {
        openedCount,
        closedCount: closedSessions.length,
        closedWithDifferenceCount: closedWithDifference.length,
        totalDifference: totalDifference.toFixed(2),
        items: closedSessions.map((session) => ({
          id: session.id,
          status: session.status,
          openedAt: session.openedAt.toISOString(),
          closedAt: session.closedAt?.toISOString() ?? null,
          initialAmount: session.initialAmount.toFixed(2),
          countedAmount: session.countedAmount?.toFixed(2) ?? null,
          expectedAmount: session.expectedAmount?.toFixed(2) ?? null,
          difference: session.difference?.toFixed(2) ?? null,
        })),
      },
    };
  }

  async clients(auth: AuthContext, query: ClientsReportQuery) {
    const period = resolvePeriod(query);
    const companyId = auth.companyId;
    const range = { gte: period.start, lte: period.end };

    const [newClients, newPets, bySpecies, apptCounts] = await Promise.all([
      this.prisma.client.count({ where: { companyId, createdAt: range } }),
      this.prisma.pet.count({ where: { companyId, createdAt: range } }),
      this.prisma.pet.groupBy({
        by: ["species"],
        where: { companyId, createdAt: range },
        _count: { _all: true },
      }),
      appointmentStatusCounts(this.prisma, companyId, range),
    ]);

    return {
      period: periodJson(period),
      generatedAt: new Date().toISOString(),
      newClients,
      newPets,
      petsBySpecies: bySpecies
        .map((row) => ({
          species: row.species,
          label: petSpeciesLabels[row.species],
          count: row._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      services: apptCounts,
    };
  }

  async whatsapp(auth: AuthContext, query: WhatsAppReportQuery) {
    const period = resolvePeriod(query);
    const companyId = auth.companyId;
    const range = { gte: period.start, lte: period.end };

    const [groups, failedReasons] = await Promise.all([
      this.prisma.whatsAppMessage.groupBy({
        by: ["status"],
        where: { companyId, createdAt: range },
        _count: { _all: true },
      }),
      this.prisma.whatsAppMessage.groupBy({
        by: ["failureReason"],
        where: { companyId, createdAt: range, status: "FAILED" },
        _count: { _all: true },
      }),
    ]);

    const counts = new Map(groups.map((row) => [row.status, row._count._all]));
    const total = groups.reduce((acc, row) => acc + row._count._all, 0);

    const byStatus = (
      Object.keys(whatsappMessageStatusLabels) as Array<
        keyof typeof whatsappMessageStatusLabels
      >
    ).map((status) => ({
      status,
      label: whatsappMessageStatusLabels[status],
      count: counts.get(status) ?? 0,
    }));

    return {
      period: periodJson(period),
      generatedAt: new Date().toISOString(),
      total,
      byStatus,
      states: {
        pending: (counts.get("PENDING") ?? 0) + (counts.get("PROCESSING") ?? 0),
        accepted: counts.get("ACCEPTED") ?? 0,
        sent: counts.get("SENT") ?? 0,
        delivered: counts.get("DELIVERED") ?? 0,
        read: counts.get("READ") ?? 0,
        failed: counts.get("FAILED") ?? 0,
        cancelled: counts.get("CANCELLED") ?? 0,
      },
      failed: {
        count: failedReasons.reduce((acc, row) => acc + row._count._all, 0),
        byReason: failedReasons
          .map((row) => ({
            reason: row.failureReason ?? "Não informado",
            count: row._count._all,
          }))
          .sort((a, b) => b.count - a.count),
      },
    };
  }
}
