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
  CreateProductInput,
  ListProductsQuery,
  UpdateProductInput,
  UpdateRecordStatusInput,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

const productSelect = {
  id: true,
  name: true,
  description: true,
  sku: true,
  barcode: true,
  unit: true,
  costPrice: true,
  salePrice: true,
  stockQuantity: true,
  minimumStock: true,
  status: true,
  categoryId: true,
  supplierId: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true } },
} as const;

type ProductRecord = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

function formatProduct(product: ProductRecord) {
  return {
    ...product,
    costPrice: product.costPrice.toFixed(2),
    salePrice: product.salePrice.toFixed(2),
    stockQuantity: product.stockQuantity.toFixed(3),
    minimumStock: product.minimumStock.toFixed(3),
    lowStock: product.minimumStock.gt(0) && product.stockQuantity.lte(product.minimumStock),
  };
}

function normalizeCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

@Injectable()
export class ProductsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(auth: AuthContext, query: ListProductsQuery) {
    const andConditions: Prisma.ProductWhereInput[] = [];

    if (query.search) {
      andConditions.push({
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { sku: { contains: query.search, mode: "insensitive" } },
          { barcode: { contains: query.search } },
        ],
      });
    }
    if (query.categoryId) andConditions.push({ categoryId: query.categoryId });
    if (query.supplierId) andConditions.push({ supplierId: query.supplierId });
    if (query.status) andConditions.push({ status: query.status });
    if (query.lowStock) {
      const lowStockRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Product"
        WHERE "companyId" = ${auth.companyId}
          AND "stockQuantity" <= "minimumStock"`;
      andConditions.push({ id: { in: lowStockRows.map((row) => row.id) } });
    }

    const where: Prisma.ProductWhereInput = {
      companyId: auth.companyId,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: productSelect,
        orderBy: { [query.orderBy]: query.direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map(formatProduct),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(auth: AuthContext, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId: auth.companyId },
      select: productSelect,
    });

    if (!product) {
      throw new NotFoundException("Produto não encontrado");
    }

    return formatProduct(product);
  }

  async create(auth: AuthContext, input: CreateProductInput) {
    const sku = input.sku ? input.sku.toUpperCase() : null;
    const barcode = normalizeCode(input.barcode);

    await this.validateRelations(auth, input.categoryId, input.supplierId);
    await this.validateUniqueCodes(auth, undefined, sku, barcode);

    const product = await this.prisma.product.create({
      data: {
        companyId: auth.companyId,
        name: input.name,
        description: input.description || null,
        sku,
        barcode,
        unit: input.unit,
        costPrice: new Prisma.Decimal(input.costPrice),
        salePrice: new Prisma.Decimal(input.salePrice),
        minimumStock: new Prisma.Decimal(input.minimumStock),
        categoryId: input.categoryId || null,
        supplierId: input.supplierId || null,
      },
      select: productSelect,
    });

    return formatProduct(product);
  }

  async update(auth: AuthContext, id: string, input: UpdateProductInput) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!product) {
      throw new NotFoundException("Produto não encontrado");
    }

    const sku = input.sku !== undefined ? (input.sku ? input.sku.toUpperCase() : null) : product.sku;
    const barcode =
      input.barcode !== undefined ? normalizeCode(input.barcode) : product.barcode;

    await this.validateRelations(
      auth,
      input.categoryId !== undefined ? input.categoryId : product.categoryId,
      input.supplierId !== undefined ? input.supplierId : product.supplierId,
    );
    await this.validateUniqueCodes(auth, product.id, sku, barcode);

    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description || null }
          : {}),
        ...(input.sku !== undefined ? { sku } : {}),
        ...(input.barcode !== undefined ? { barcode } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.costPrice !== undefined
          ? { costPrice: new Prisma.Decimal(input.costPrice) }
          : {}),
        ...(input.salePrice !== undefined
          ? { salePrice: new Prisma.Decimal(input.salePrice) }
          : {}),
        ...(input.minimumStock !== undefined
          ? { minimumStock: new Prisma.Decimal(input.minimumStock) }
          : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId || null } : {}),
        ...(input.supplierId !== undefined ? { supplierId: input.supplierId || null } : {}),
      },
      select: productSelect,
    });

    return formatProduct(updated);
  }

  async updateStatus(auth: AuthContext, id: string, input: UpdateRecordStatusInput) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!product) {
      throw new NotFoundException("Produto não encontrado");
    }

    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: { status: input.status },
      select: productSelect,
    });

    return formatProduct(updated);
  }

  private async validateRelations(
    auth: AuthContext,
    categoryId: string | null | undefined,
    supplierId: string | null | undefined,
  ) {
    if (categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: categoryId, companyId: auth.companyId },
      });
      if (!category) {
        throw new BadRequestException("Categoria inválida ou de outra empresa");
      }
    }

    if (supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: supplierId, companyId: auth.companyId },
      });
      if (!supplier) {
        throw new BadRequestException("Fornecedor inválido ou de outra empresa");
      }
    }
  }

  private async validateUniqueCodes(
    auth: AuthContext,
    productId: string | undefined,
    sku: string | null,
    barcode: string | null,
  ) {
    if (sku) {
      const duplicate = await this.prisma.product.findFirst({
        where: { companyId: auth.companyId, sku, ...(productId ? { id: { not: productId } } : {}) },
      });
      if (duplicate) {
        throw new ConflictException("Já existe um produto com este SKU nesta empresa");
      }
    }

    if (barcode) {
      const duplicate = await this.prisma.product.findFirst({
        where: {
          companyId: auth.companyId,
          barcode,
          ...(productId ? { id: { not: productId } } : {}),
        },
      });
      if (duplicate) {
        throw new ConflictException(
          "Já existe um produto com este código de barras nesta empresa",
        );
      }
    }
  }
}
