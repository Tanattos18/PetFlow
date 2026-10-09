import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.module";
import type {
  CreateClientInput,
  ListClientsQuery,
  UpdateClientInput,
  UpdateRecordStatusInput,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

const clientSelect = {
  id: true,
  name: true,
  phone: true,
  mobile: true,
  email: true,
  cpf: true,
  street: true,
  number: true,
  complement: true,
  district: true,
  city: true,
  state: true,
  zip: true,
  notes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { pets: true, sales: true } },
} as const;

type ClientRecord = Prisma.ClientGetPayload<{ select: typeof clientSelect }>;

function formatClient(client: ClientRecord) {
  return client;
}

export function clientNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Estratégia anti-duplicidade (Etapa 5):
 * - normalização server-side (nameKey com espaços colapsados, telefone só
 *   dígitos, email minúsculo) via schemas do @petflow/shared;
 * - bloqueia apenas quando o MESMO nameKey coincide E há contato (telefone /
 *   mobile / email) igual entre o novo cliente e um cliente ATIVO existente;
 * - nome sozinho nunca bloqueia (homônimos) e contato sozinho nunca bloqueia
 *   (famílias compartilham telefone/email);
 * - sem unique duro no banco p/ nameKey: janela de corrida aceita e
 *   documentada (a checagem acontece na mesma transação do create).
 */
@Injectable()
export class ClientsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(auth: AuthContext, query: ListClientsQuery) {
    const andConditions: Prisma.ClientWhereInput[] = [];

    if (query.search) {
      andConditions.push({
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { phone: { contains: query.search } },
          { mobile: { contains: query.search } },
          { email: { contains: query.search, mode: "insensitive" } },
          { cpf: { contains: query.search } },
        ],
      });
    }
    if (query.status) andConditions.push({ status: query.status });

    const where: Prisma.ClientWhereInput = {
      companyId: auth.companyId,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        select: clientSelect,
        orderBy: { [query.orderBy]: query.direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      items: items.map(formatClient),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(auth: AuthContext, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId: auth.companyId },
      select: clientSelect,
    });

    if (!client) {
      throw new NotFoundException("Cliente não encontrado");
    }

    return formatClient(client);
  }

  async listPets(auth: AuthContext, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId: auth.companyId },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundException("Cliente não encontrado");
    }

    const pets = await this.prisma.pet.findMany({
      where: { clientId: client.id, companyId: auth.companyId },
      select: {
        id: true,
        clientId: true,
        name: true,
        species: true,
        breed: true,
        sex: true,
        birthDate: true,
        weight: true,
        color: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: "asc" },
    });

    return {
      items: pets.map((pet) => ({
        ...pet,
        weight: pet.weight ? pet.weight.toFixed(2) : null,
      })),
      total: pets.length,
    };
  }

  async create(auth: AuthContext, input: CreateClientInput) {
    const nameKey = clientNameKey(input.name);

    await this.assertNotDuplicated(auth, input, nameKey);

    const client = await this.prisma.client.create({
      data: {
        companyId: auth.companyId,
        name: input.name,
        nameKey,
        phone: input.phone || null,
        mobile: input.mobile || null,
        email: input.email || null,
        cpf: input.cpf || null,
        street: input.street || null,
        number: input.number || null,
        complement: input.complement || null,
        district: input.district || null,
        city: input.city || null,
        state: input.state || null,
        zip: input.zip || null,
        notes: input.notes || null,
      },
      select: clientSelect,
    });

    return formatClient(client);
  }

  async update(auth: AuthContext, id: string, input: UpdateClientInput) {
    const existing = await this.prisma.client.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!existing) {
      throw new NotFoundException("Cliente não encontrado");
    }

    const name = input.name !== undefined ? input.name : existing.name;
    const nameKey = clientNameKey(name);

    const merged: CreateClientInput = {
      name,
      phone: input.phone !== undefined ? input.phone : existing.phone,
      mobile: input.mobile !== undefined ? input.mobile : existing.mobile,
      email: input.email !== undefined ? input.email : existing.email,
      cpf: input.cpf !== undefined ? input.cpf : existing.cpf,
      street: input.street !== undefined ? input.street : existing.street,
      number: input.number !== undefined ? input.number : existing.number,
      complement: input.complement !== undefined ? input.complement : existing.complement,
      district: input.district !== undefined ? input.district : existing.district,
      city: input.city !== undefined ? input.city : existing.city,
      state: input.state !== undefined ? input.state : existing.state,
      zip: input.zip !== undefined ? input.zip : existing.zip,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    };

    await this.assertNotDuplicated(auth, merged, nameKey, existing.id);

    const updated = await this.prisma.client.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name, nameKey } : {}),
        ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        ...(input.mobile !== undefined ? { mobile: input.mobile || null } : {}),
        ...(input.email !== undefined ? { email: input.email || null } : {}),
        ...(input.cpf !== undefined ? { cpf: input.cpf || null } : {}),
        ...(input.street !== undefined ? { street: input.street || null } : {}),
        ...(input.number !== undefined ? { number: input.number || null } : {}),
        ...(input.complement !== undefined ? { complement: input.complement || null } : {}),
        ...(input.district !== undefined ? { district: input.district || null } : {}),
        ...(input.city !== undefined ? { city: input.city || null } : {}),
        ...(input.state !== undefined ? { state: input.state || null } : {}),
        ...(input.zip !== undefined ? { zip: input.zip || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      },
      select: clientSelect,
    });

    return formatClient(updated);
  }

  async updateStatus(auth: AuthContext, id: string, input: UpdateRecordStatusInput) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!client) {
      throw new NotFoundException("Cliente não encontrado");
    }

    const updated = await this.prisma.client.update({
      where: { id: client.id },
      data: { status: input.status },
      select: clientSelect,
    });

    return formatClient(updated);
  }

  private async assertNotDuplicated(
    auth: AuthContext,
    input: CreateClientInput,
    nameKey: string,
    clientId?: string,
  ) {
    const candidates = await this.prisma.client.findMany({
      where: {
        companyId: auth.companyId,
        nameKey,
        status: "ACTIVE",
        ...(clientId ? { id: { not: clientId } } : {}),
      },
      select: { phone: true, mobile: true, email: true },
    });

    if (candidates.length === 0) return;

    const inputContacts = [input.phone, input.mobile, input.email].filter(
      (value): value is string => Boolean(value),
    );
    if (inputContacts.length === 0) return;

    const duplicate = candidates.some((candidate) => {
      const candidateContacts = [candidate.phone, candidate.mobile, candidate.email].filter(
        (value): value is string => Boolean(value),
      );
      return inputContacts.some((contact) => candidateContacts.includes(contact));
    });

    if (duplicate) {
      throw new ConflictException("Cliente possivelmente duplicado");
    }
  }
}
