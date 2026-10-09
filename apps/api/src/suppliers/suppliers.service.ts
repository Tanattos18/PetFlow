import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.module";
import type {
  CreateSupplierInput,
  ListCatalogQuery,
  UpdateRecordStatusInput,
  UpdateSupplierInput,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

const supplierSelect = {
  id: true,
  name: true,
  document: true,
  email: true,
  phone: true,
  notes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class SuppliersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(auth: AuthContext, query: ListCatalogQuery) {
    const where = {
      companyId: auth.companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        select: supplierSelect,
        orderBy: { name: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async get(auth: AuthContext, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, companyId: auth.companyId },
      select: supplierSelect,
    });

    if (!supplier) {
      throw new NotFoundException("Fornecedor não encontrado");
    }

    return supplier;
  }

  async create(auth: AuthContext, input: CreateSupplierInput) {
    const supplier = await this.prisma.supplier.create({
      data: {
        companyId: auth.companyId,
        name: input.name,
        document: input.document || null,
        email: input.email || null,
        phone: input.phone || null,
        notes: input.notes || null,
      },
      select: supplierSelect,
    });

    return supplier;
  }

  async update(auth: AuthContext, id: string, input: UpdateSupplierInput) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!supplier) {
      throw new NotFoundException("Fornecedor não encontrado");
    }

    return this.prisma.supplier.update({
      where: { id: supplier.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.document !== undefined ? { document: input.document || null } : {}),
        ...(input.email !== undefined ? { email: input.email || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      },
      select: supplierSelect,
    });
  }

  async updateStatus(auth: AuthContext, id: string, input: UpdateRecordStatusInput) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!supplier) {
      throw new NotFoundException("Fornecedor não encontrado");
    }

    return this.prisma.supplier.update({
      where: { id: supplier.id },
      data: { status: input.status },
      select: supplierSelect,
    });
  }
}
