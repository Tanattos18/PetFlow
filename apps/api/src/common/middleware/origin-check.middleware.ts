import { ForbiddenException, Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { allowedOrigins } from "../../config/env";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const origin = req.headers.origin;

    if (origin && UNSAFE_METHODS.has(req.method) && !allowedOrigins.includes(origin)) {
      next(new ForbiddenException("Origem da requisição não permitida"));
      return;
    }

    next();
  }
}
