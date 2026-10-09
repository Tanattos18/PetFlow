import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.module";
import type {
  CreateStockAdjustmentInput,
  CreateStockMovementInput,
  ListMovementsQuery,
  StockMovementType,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

const movementSelect = {
  id: true,
  type: true,
  quantity: true,
  notes: true,
  reference: true,
  createdAt: true,
  product: { select: { id: true, name: true, unit: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

function formatMovement(
  movement: Prisma.StockMovementGetPayload<{ select: typeof movementSelect }>,
) {
  return {
    ...movement,
    quantity: movement.quantity.toFixed(3),
  };
}

@Injectable()
export class StockService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async move(auth: AuthContext, input: CreateStockMovementInput, type: "IN" | "OUT") {
    return this.applyMovement(auth, {
      productId: input.productId,
      type,
      quantity: new Prisma.Decimal(input.quantity),
      notes: input.notes ?? null,
      reference: input.reference ?? null,
    });
  }

  async adjust(auth: AuthContext, input: CreateStockAdjustmentInput) {
    return this.applyMovement(auth, {
      productId: input.productId,
      type: input.type,
      quantity: new Prisma.Decimal(input.quantity),
      notes: input.reason,
      reference: null,
    });
  }

  async balance(auth: AuthContext, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId: auth.companyId },
      select: {
        id: true,
        name: true,
        unit: true,
        stockQuantity: true,
        minimumStock: true,
        status: true,
      },
    });

    if (!product) {
      throw new NotFoundException("Produto não encontrado");
    }

    return {
      productId: product.id,
      name: product.name,
      unit: product.unit,
      stockQuantity: product.stockQuantity.toFixed(3),
      minimumStock: product.minimumStock.toFixed(3),
      lowStock: product.minimumStock.gt(0) && product.stockQuantity.lte(product.minimumStock),
      status: product.status,
    };
  }

  async movements(auth: AuthContext, query: ListMovementsQuery) {
    const where = {
      companyId: auth.companyId,
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        select: movementSelect,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      items: items.map(formatMovement),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async lowStock(auth: AuthContext) {
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string }>
    >`
      SELECT id FROM "Product"
      WHERE "companyId" = ${auth.companyId}
        AND "status" = 'ACTIVE'
        AND "minimumStock" > 0
        AND "stockQuantity" <= "minimumStock"
      ORDER BY "stockQuantity" ASC`;

    if (rows.length === 0) {
      return [];
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        stockQuantity: true,
        minimumStock: true,
      },
      orderBy: { stockQuantity: "asc" },
    });

    return products.map((product) => ({
      ...product,
      stockQuantity: product.stockQuantity.toFixed(3),
      minimumStock: product.minimumStock.toFixed(3),
    }));
  }

  private async applyMovement(
    auth: AuthContext,
    params: {
      productId: string;
      type: StockMovementType;
      quantity: Prisma.Decimal;
      notes: string | null;
      reference: string | null;
    },
  ) {
    if (params.quantity.lte(0)) {
      throw new BadRequestException("Quantidade deve ser maior que zero");
    }

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; status: string; "stockQuantity": Prisma.Decimal }>
      >`
        SELECT id, status, "stockQuantity" FROM "Product"
        WHERE id = ${params.productId} AND "companyId" = ${auth.companyId}
        FOR UPDATE`;

      const product = rows[0];
      if (!product) {
        throw new NotFoundException("Produto não encontrado");
      }

      if (product.status !== "ACTIVE") {
        throw new BadRequestException("Produto inativo não permite movimentações");
      }

      const current = new Prisma.Decimal(product.stockQuantity);
      let next: Prisma.Decimal;

      if (params.type === "IN" || params.type === "ADJUST_POSITIVE") {
        next = current.plus(params.quantity);
      } else {
        next = current.minus(params.quantity);
        if (next.isNegative()) {
          throw new BadRequestException(
            params.type === "OUT"
              ? "Estoque insuficiente para esta saída"
              : "Ajuste resultaria em estoque negativo",
          );
        }
      }

      await tx.product.update({
        where: { id: product.id },
        data: { stockQuantity: next },
      });

      const movement = await tx.stockMovement.create({
        data: {
          companyId: auth.companyId,
          productId: product.id,
          type: params.type,
          quantity: params.quantity,
          notes: params.notes,
          reference: params.reference,
          createdByUserId: auth.userId,
        },
        select: {
          ...movementSelect,
          product: { select: { id: true, name: true, unit: true } },
        },
      });

      return {
        movement: formatMovement(movement),
        stockQuantity: next.toFixed(3),
      };
    });
  }
}
