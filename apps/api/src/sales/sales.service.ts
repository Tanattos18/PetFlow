import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, ProductUnit } from "@prisma/client";
import { randomInt } from "node:crypto";
import { PrismaService } from "../prisma/prisma.module";
import type {
  CancelSaleInput,
  CreateSaleInput,
  ListSalesQuery,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";
import { lockOpenCashSession } from "../cash/cash-session.helpers";

const saleSelect = {
  id: true,
  receiptCode: true,
  status: true,
  subtotal: true,
  discount: true,
  total: true,
  paymentMethod: true,
  paymentNote: true,
  createdAt: true,
  cancelledAt: true,
  cancelReason: true,
  createdBy: { select: { id: true, name: true } },
  cancelledBy: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      productSku: true,
      unit: true,
      unitPrice: true,
      quantity: true,
      subtotal: true,
    },
  },
} as const;

type SaleRecord = Prisma.SaleGetPayload<{ select: typeof saleSelect }>;

function formatSale(sale: SaleRecord) {
  return {
    ...sale,
    subtotal: sale.subtotal.toFixed(2),
    discount: sale.discount.toFixed(2),
    total: sale.total.toFixed(2),
    items: sale.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toFixed(2),
      quantity: item.quantity.toFixed(3),
      subtotal: item.subtotal.toFixed(2),
    })),
  };
}

const RECEIPT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateReceiptCode(): string {
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += RECEIPT_ALPHABET[randomInt(RECEIPT_ALPHABET.length)];
  }
  return `PF-${suffix}`;
}

interface LockedProduct {
  id: string;
  name: string;
  sku: string | null;
  unit: ProductUnit;
  status: string;
  salePrice: Prisma.Decimal;
  stockQuantity: Prisma.Decimal;
}

@Injectable()
export class SalesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(auth: AuthContext, input: CreateSaleInput) {
    const quantities = new Map<string, Prisma.Decimal>();
    for (const item of input.items) {
      const current = quantities.get(item.productId) ?? new Prisma.Decimal(0);
      quantities.set(item.productId, current.plus(new Prisma.Decimal(item.quantity)));
    }

    const sortedProductIds = [...quantities.keys()].sort();
    const discount = new Prisma.Decimal(input.discount);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Ordem de lock: sessão de caixa → produtos ordenados (sem deadlock).
        const cashSession = await lockOpenCashSession(
          tx,
          auth.companyId,
          "registrar vendas",
        );

        const products = new Map<string, LockedProduct>();

        for (const productId of sortedProductIds) {
          const rows = await tx.$queryRaw<LockedProduct[]>`
            SELECT id, name, sku, unit, status, "salePrice", "stockQuantity"
            FROM "Product"
            WHERE id = ${productId} AND "companyId" = ${auth.companyId}
            FOR UPDATE`;

          const row = rows[0];
          if (!row) {
            throw new NotFoundException("Produto não encontrado");
          }
          if (row.status !== "ACTIVE") {
            throw new BadRequestException(`Produto "${row.name}" está inativo`);
          }
          products.set(row.id, row);
        }

        let subtotal = new Prisma.Decimal(0);
        const lines: Array<{
          product: LockedProduct;
          quantity: Prisma.Decimal;
          unitPrice: Prisma.Decimal;
          lineSubtotal: Prisma.Decimal;
        }> = [];

        for (const productId of sortedProductIds) {
          const product = products.get(productId);
          if (!product) {
            throw new NotFoundException("Produto não encontrado");
          }

          const quantity = quantities.get(productId) ?? new Prisma.Decimal(0);
          if (product.stockQuantity.lt(quantity)) {
            throw new BadRequestException(
              `Estoque insuficiente para "${product.name}" (disponível: ${product.stockQuantity.toFixed(3)})`,
            );
          }

          const unitPrice = new Prisma.Decimal(product.salePrice);
          const lineSubtotal = unitPrice.times(quantity);
          subtotal = subtotal.plus(lineSubtotal);
          lines.push({ product, quantity, unitPrice, lineSubtotal });
        }

        if (discount.gt(subtotal)) {
          throw new BadRequestException("Desconto não pode ser maior que o subtotal da venda");
        }

        const total = subtotal.minus(discount);
        const receiptCode = generateReceiptCode();

        const sale = await tx.sale.create({
          data: {
            companyId: auth.companyId,
            receiptCode,
            clientRequestId: input.clientRequestId ?? null,
            subtotal,
            discount,
            total,
            paymentMethod: input.paymentMethod,
            paymentNote: input.paymentNote ?? null,
            createdByUserId: auth.userId,
            cashSessionId: cashSession.id,
            items: {
              create: lines.map((line) => ({
                productId: line.product.id,
                productName: line.product.name,
                productSku: line.product.sku,
                unit: line.product.unit,
                unitPrice: line.unitPrice,
                quantity: line.quantity,
                subtotal: line.lineSubtotal,
              })),
            },
          },
          select: saleSelect,
        });

        for (const line of lines) {
          await tx.product.update({
            where: { id: line.product.id },
            data: { stockQuantity: { decrement: line.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              companyId: auth.companyId,
              productId: line.product.id,
              type: "OUT",
              quantity: line.quantity,
              notes: `Venda ${receiptCode}`,
              reference: receiptCode,
              createdByUserId: auth.userId,
            },
          });
        }

        // Lançamento financeiro único da venda (unicidade garantida pelo
        // unique (origin, saleId) além da transação atômica).
        await tx.cashMovement.create({
          data: {
            companyId: auth.companyId,
            cashSessionId: cashSession.id,
            type: "IN",
            origin: "SALE",
            inCash: input.paymentMethod === "CASH",
            amount: total,
            description: `Venda ${receiptCode}`,
            saleId: sale.id,
            createdByUserId: auth.userId,
          },
        });

        return formatSale(sale);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Venda já registrada para este identificador (possível reenvio)",
        );
      }
      throw error;
    }
  }

  async list(auth: AuthContext, query: ListSalesQuery) {
    const where: Prisma.SaleWhereInput = {
      companyId: auth.companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { receiptCode: { contains: query.search, mode: "insensitive" } }
        : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from
                ? { gte: new Date(`${query.from}T00:00:00.000Z`) }
                : {}),
              ...(query.to
                ? { lte: new Date(`${query.to}T23:59:59.999Z`) }
                : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        select: saleSelect,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      items: items.map(formatSale),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async detail(auth: AuthContext, saleId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, companyId: auth.companyId },
      select: saleSelect,
    });

    if (!sale) {
      throw new NotFoundException("Venda não encontrada");
    }

    return formatSale(sale);
  }

  async cancel(auth: AuthContext, saleId: string, input: CancelSaleInput) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, companyId: auth.companyId },
        select: {
          id: true,
          receiptCode: true,
          status: true,
          total: true,
          paymentMethod: true,
          items: { select: { productId: true, quantity: true } },
        },
      });

      if (!sale) {
        throw new NotFoundException("Venda não encontrada");
      }
      if (sale.status === "CANCELLED") {
        throw new ConflictException("Venda já cancelada");
      }

      const cashSession = await lockOpenCashSession(
        tx,
        auth.companyId,
        "cancelar vendas",
      );

      const sortedProductIds = [...new Set(sale.items.map((item) => item.productId))].sort();

      for (const productId of sortedProductIds) {
        await tx.$queryRaw`
          SELECT id FROM "Product"
          WHERE id = ${productId} AND "companyId" = ${auth.companyId}
          FOR UPDATE`;
      }

      const updated = await tx.sale.updateMany({
        where: { id: sale.id, status: "COMPLETED" },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledByUserId: auth.userId,
          cancelReason: input.reason,
        },
      });

      if (updated.count === 0) {
        throw new ConflictException("Venda já cancelada");
      }

      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            companyId: auth.companyId,
            productId: item.productId,
            type: "IN",
            quantity: item.quantity,
            notes: `Cancelamento da venda ${sale.receiptCode}: ${input.reason}`,
            reference: sale.receiptCode,
            createdByUserId: auth.userId,
          },
        });
      }

      // Reversão financeira única do cancelamento na sessão aberta atual.
      await tx.cashMovement.create({
        data: {
          companyId: auth.companyId,
          cashSessionId: cashSession.id,
          type: "OUT",
          origin: "SALE_CANCELMENT",
          inCash: sale.paymentMethod === "CASH",
          amount: sale.total,
          description: `Cancelamento da venda ${sale.receiptCode}`,
          saleId: sale.id,
          createdByUserId: auth.userId,
        },
      });

      const cancelled = await tx.sale.findFirstOrThrow({
        where: { id: sale.id },
        select: saleSelect,
      });

      return formatSale(cancelled);
    });
  }
}
