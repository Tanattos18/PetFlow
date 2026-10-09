import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.module";
import type {
  CreatePetInput,
  ListPetsQuery,
  UpdatePetInput,
  UpdateRecordStatusInput,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

const petSelect = {
  id: true,
  clientId: true,
  name: true,
  species: true,
  breed: true,
  sex: true,
  birthDate: true,
  weight: true,
  color: true,
  notes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true, phone: true, mobile: true, email: true } },
} as const;

type PetRecord = Prisma.PetGetPayload<{ select: typeof petSelect }>;

function formatPet(pet: PetRecord) {
  return {
    ...pet,
    weight: pet.weight ? pet.weight.toFixed(2) : null,
    birthDate: pet.birthDate ? pet.birthDate.toISOString().slice(0, 10) : null,
  };
}

@Injectable()
export class PetsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(auth: AuthContext, query: ListPetsQuery) {
    const andConditions: Prisma.PetWhereInput[] = [];

    if (query.search) {
      andConditions.push({
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { breed: { contains: query.search, mode: "insensitive" } },
          { color: { contains: query.search, mode: "insensitive" } },
          { client: { name: { contains: query.search, mode: "insensitive" } } },
        ],
      });
    }
    if (query.clientId) andConditions.push({ clientId: query.clientId });
    if (query.species) andConditions.push({ species: query.species });
    if (query.status) andConditions.push({ status: query.status });

    const where: Prisma.PetWhereInput = {
      companyId: auth.companyId,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.pet.findMany({
        where,
        select: petSelect,
        orderBy: { [query.orderBy]: query.direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.pet.count({ where }),
    ]);

    return {
      items: items.map(formatPet),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(auth: AuthContext, id: string) {
    const pet = await this.prisma.pet.findFirst({
      where: { id, companyId: auth.companyId },
      select: petSelect,
    });

    if (!pet) {
      throw new NotFoundException("Pet não encontrado");
    }

    return formatPet(pet);
  }

  async create(auth: AuthContext, input: CreatePetInput) {
    await this.validateClient(auth, input.clientId);

    const pet = await this.prisma.pet.create({
      data: {
        companyId: auth.companyId,
        clientId: input.clientId,
        name: input.name,
        species: input.species,
        breed: input.breed || null,
        sex: input.sex,
        birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00.000Z`) : null,
        weight: input.weight ? new Prisma.Decimal(input.weight) : null,
        color: input.color || null,
        notes: input.notes || null,
      },
      select: petSelect,
    });

    return formatPet(pet);
  }

  async update(auth: AuthContext, id: string, input: UpdatePetInput) {
    const existing = await this.prisma.pet.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!existing) {
      throw new NotFoundException("Pet não encontrado");
    }

    if (input.clientId !== undefined) {
      await this.validateClient(auth, input.clientId);
    }

    const updated = await this.prisma.pet.update({
      where: { id: existing.id },
      data: {
        ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.species !== undefined ? { species: input.species } : {}),
        ...(input.breed !== undefined ? { breed: input.breed || null } : {}),
        ...(input.sex !== undefined ? { sex: input.sex } : {}),
        ...(input.birthDate !== undefined
          ? {
              birthDate: input.birthDate
                ? new Date(`${input.birthDate}T00:00:00.000Z`)
                : null,
            }
          : {}),
        ...(input.weight !== undefined
          ? { weight: input.weight ? new Prisma.Decimal(input.weight) : null }
          : {}),
        ...(input.color !== undefined ? { color: input.color || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      },
      select: petSelect,
    });

    return formatPet(updated);
  }

  async updateStatus(auth: AuthContext, id: string, input: UpdateRecordStatusInput) {
    const pet = await this.prisma.pet.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!pet) {
      throw new NotFoundException("Pet não encontrado");
    }

    const updated = await this.prisma.pet.update({
      where: { id: pet.id },
      data: { status: input.status },
      select: petSelect,
    });

    return formatPet(updated);
  }

  private async validateClient(auth: AuthContext, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId: auth.companyId },
      select: { id: true, status: true },
    });

    if (!client) {
      throw new BadRequestException("Responsável inválido ou de outra empresa");
    }
    if (client.status !== "ACTIVE") {
      throw new BadRequestException("Responsável está inativo");
    }
  }
}
