import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";
import type { AuthContext } from "../decorators/auth.decorator";

interface RequestWithAuth extends Request {
  auth?: AuthContext;
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();

    if (!request.auth) {
      throw new ForbiddenException("Permissão administrativa necessária");
    }

    if (request.auth.role !== "ADMIN") {
      throw new ForbiddenException("Permissão administrativa necessária");
    }

    return true;
  }
}
