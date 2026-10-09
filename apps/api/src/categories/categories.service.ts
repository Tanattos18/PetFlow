import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.module";
import type {
  CreateCategoryInput,
  ListCatalogQuery,
  UpdateCategoryInput,
  UpdateRecordStatusInput,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

const categorySelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class CategoriesService {
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
      this.prisma.category.findMany({
        where,
        select: categorySelect,
        orderBy: { name: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.category.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async get(auth: AuthContext, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, companyId: auth.companyId },
      select: categorySelect,
    });

    if (!category) {
      throw new NotFoundException("Categoria não encontrada");
    }

    return category;
  }

  async create(auth: AuthContext, input: CreateCategoryInput) {
    const nameKey = input.name.toLowerCase();

    const existing = await this.prisma.category.findUnique({
      where: { companyId_nameKey: { companyId: auth.companyId, nameKey } },
    });

    if (existing) {
      throw new ConflictException("Já existe uma categoria com este nome nesta empresa");
    }

    return this.prisma.category.create({
      data: {
        companyId: auth.companyId,
        name: input.name,
        nameKey,
        description: input.description ?? null,
      },
      select: categorySelect,
    });
  }

  async update(auth: AuthContext, id: string, input: UpdateCategoryInput) {
    const category = await this.prisma.category.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!category) {
      throw new NotFoundException("Categoria não encontrada");
    }

    const name = input.name ?? category.name;
    const nameKey = name.toLowerCase();

    if (nameKey !== category.nameKey) {
      const conflict = await this.prisma.category.findUnique({
        where: { companyId_nameKey: { companyId: auth.companyId, nameKey } },
      });
      if (conflict) {
        throw new ConflictException("Já existe uma categoria com este nome nesta empresa");
      }
    }

    return this.prisma.category.update({
      where: { id: category.id },
      data: {
        name,
        nameKey,
        ...(input.description !== undefined
          ? { description: input.description || null }
          : {}),
      },
      select: categorySelect,
    });
  }

  async updateStatus(auth: AuthContext, id: string, input: UpdateRecordStatusInput) {
    const category = await this.prisma.category.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!category) {
      throw new NotFoundException("Categoria não encontrada");
    }

    return this.prisma.category.update({
      where: { id: category.id },
      data: { status: input.status },
      select: categorySelect,
    });
  }
}
