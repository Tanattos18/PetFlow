import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { createHash } from "crypto";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AuthContext } from "../decorators/auth.decorator";
import { env } from "../../config/env";
import { PrismaService } from "../../prisma/prisma.module";

interface RequestWithAuth extends Request {
  auth?: AuthContext;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<RequestWithAuth>();

    if (isPublic) {
      return true;
    }

    const token = readCookie(request.headers.cookie, env.AUTH_COOKIE_NAME);
    if (!token) {
      throw new UnauthorizedException("Sessão não encontrada");
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { include: { company: true } } },
    });

    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Sessão inválida ou expirada");
    }

    if (session.user.status !== "ACTIVE" || session.user.company.status !== "ACTIVE") {
      throw new UnauthorizedException("Conta ou empresa inativa");
    }

    request.auth = {
      userId: session.user.id,
      companyId: session.user.companyId,
      role: session.user.role,
      sessionId: session.id,
    };

    return true;
  }
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}
