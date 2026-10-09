import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.module";
import type { CreateUserInput, UpdateUserStatusInput } from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

const BCRYPT_ROUNDS = 12;

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(auth: AuthContext) {
    return this.prisma.user.findMany({
      where: { companyId: auth.companyId },
      select: userSelect,
      orderBy: { createdAt: "asc" },
    });
  }

  async create(auth: AuthContext, input: CreateUserInput) {
    const existing = await this.prisma.user.findUnique({
      where: {
        companyId_email: { companyId: auth.companyId, email: input.email },
      },
    });

    if (existing) {
      throw new ConflictException("Já existe um usuário com este email nesta empresa");
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        companyId: auth.companyId,
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
      },
      select: userSelect,
    });

    return user;
  }

  async updateStatus(auth: AuthContext, userId: string, input: UpdateUserStatusInput) {
    if (userId === auth.userId && input.status === "INACTIVE") {
      throw new ForbiddenException("Você não pode inativar sua própria conta");
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId: auth.companyId },
    });

    if (!user) {
      throw new NotFoundException("Usuário não encontrado");
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: input.status },
      select: userSelect,
    });

    if (input.status === "INACTIVE") {
      await this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return updated;
  }
}
