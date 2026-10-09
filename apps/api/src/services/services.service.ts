import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.module";
import type {
  CreateServiceInput,
  ListServicesQuery,
  UpdateServiceInput,
  UpdateRecordStatusInput,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

function serviceNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

const serviceSelect = {
  id: true,
  name: true,
  description: true,
  durationMinutes: true,
  price: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

type ServiceRecord = Prisma.ServiceGetPayload<{ select: typeof serviceSelect }>;

function formatService(service: ServiceRecord) {
  return {
    ...service,
    price: service.price.toFixed(2),
  };
}

@Injectable()
export class ServicesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(auth: AuthContext, query: ListServicesQuery) {
    const andConditions: Prisma.ServiceWhereInput[] = [];

    if (query.search) {
      andConditions.push({
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { description: { contains: query.search, mode: "insensitive" } },
        ],
      });
    }
    if (query.status) andConditions.push({ status: query.status });

    const where: Prisma.ServiceWhereInput = {
      companyId: auth.companyId,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        select: serviceSelect,
        orderBy: { [query.orderBy]: query.direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.service.count({ where }),
    ]);

    return {
      items: items.map(formatService),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(auth: AuthContext, id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, companyId: auth.companyId },
      select: serviceSelect,
    });

    if (!service) {
      throw new NotFoundException("Serviço não encontrado");
    }

    return formatService(service);
  }

  async create(auth: AuthContext, input: CreateServiceInput) {
    const nameKey = serviceNameKey(input.name);

    await this.assertUniqueName(auth, nameKey);

    const service = await this.prisma.service.create({
      data: {
        companyId: auth.companyId,
        name: input.name,
        nameKey,
        description: input.description || null,
        durationMinutes: input.durationMinutes ?? null,
        price: new Prisma.Decimal(input.price),
      },
      select: serviceSelect,
    });

    return formatService(service);
  }

  async update(auth: AuthContext, id: string, input: UpdateServiceInput) {
    const existing = await this.prisma.service.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!existing) {
      throw new NotFoundException("Serviço não encontrado");
    }

    const name = input.name !== undefined ? input.name : existing.name;
    const nameKey = serviceNameKey(name);

    if (nameKey !== existing.nameKey) {
      await this.assertUniqueName(auth, nameKey);
    }

    const updated = await this.prisma.service.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name, nameKey } : {}),
        ...(input.description !== undefined
          ? { description: input.description || null }
          : {}),
        ...(input.durationMinutes !== undefined
          ? { durationMinutes: input.durationMinutes ?? null }
          : {}),
        ...(input.price !== undefined ? { price: new Prisma.Decimal(input.price) } : {}),
      },
      select: serviceSelect,
    });

    return formatService(updated);
  }

  async updateStatus(auth: AuthContext, id: string, input: UpdateRecordStatusInput) {
    const existing = await this.prisma.service.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!existing) {
      throw new NotFoundException("Serviço não encontrado");
    }

    const updated = await this.prisma.service.update({
      where: { id: existing.id },
      data: { status: input.status },
      select: serviceSelect,
    });

    return formatService(updated);
  }

  private async assertUniqueName(auth: AuthContext, nameKey: string) {
    const duplicate = await this.prisma.service.findUnique({
      where: { companyId_nameKey: { companyId: auth.companyId, nameKey } },
    });

    if (duplicate) {
      throw new ConflictException("Já existe um serviço com este nome nesta empresa");
    }
  }
}
