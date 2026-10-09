import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.module";
import { env } from "../config/env";
import type { LoginInput } from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async login(input: LoginInput, request: Request) {
    const email = input.email;

    const candidates = await this.prisma.user.findMany({
      where: { email, status: "ACTIVE", company: { status: "ACTIVE" } },
      include: { company: true },
    });

    if (candidates.length === 0) {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    if (candidates.length > 1) {
      throw new UnauthorizedException(
        "Este email está associado a mais de uma conta. Contate o suporte.",
      );
    }

    const user = candidates[0];
    const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = new Date();

    await this.prisma.session.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(now.getTime() + env.AUTH_SESSION_TTL_HOURS * 3600_000),
        ip: request.ip ?? null,
        userAgent: (request.headers["user-agent"] ?? null)?.slice(0, 300) ?? null,
      },
    });

    await this.prisma.session.deleteMany({
      where: {
        userId: user.id,
        expiresAt: { lt: new Date(Date.now() - 30 * 24 * 3600_000) },
      },
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        slug: user.company.slug,
      },
    };
  }

  setSessionCookie(
    res: {
      cookie: (name: string, value: string, options: object) => void;
    },
    token: string,
  ) {
    res.cookie(env.AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.AUTH_COOKIE_SECURE,
      path: "/",
      maxAge: env.AUTH_SESSION_TTL_HOURS * 3600_000,
    });
  }

  async logout(
    auth: AuthContext,
    res: { clearCookie: (name: string, options: object) => void },
  ) {
    await this.prisma.session.updateMany({
      where: { id: auth.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    res.clearCookie(env.AUTH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.AUTH_COOKIE_SECURE,
      path: "/",
    });
  }

  async me(auth: AuthContext) {
    const user = await this.prisma.user.findFirst({
      where: { id: auth.userId, companyId: auth.companyId },
      include: { company: true },
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Sessão inválida ou expirada");
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        slug: user.company.slug,
      },
    };
  }
}
