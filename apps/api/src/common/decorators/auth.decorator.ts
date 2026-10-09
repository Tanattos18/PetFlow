import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface AuthContext {
  userId: string;
  companyId: string;
  role: "ADMIN" | "MEMBER";
  sessionId: string;
}

export const Auth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.auth as AuthContext;
  },
);
