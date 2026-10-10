import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Ip,
  NotFoundException,
  Post,
  Get,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type LoginInput,
  type MeResponse,
  type RegisterInput,
  type ResetPasswordInput,
} from "@petflow/shared";
import { Public } from "../common/decorators/public.decorator";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { env } from "../config/env";
import { AuthService } from "./auth.service";
import { LoginRateLimiter } from "./login-rate.limit";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(LoginRateLimiter) private readonly rateLimiter: LoginRateLimiter,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Ip() ip: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const rateKey = `${ip}|${body.email}`;
    this.rateLimiter.check(rateKey);

    const result = await this.authService.login(body, request);
    this.rateLimiter.reset(rateKey);
    this.authService.setSessionCookie(response, result.token);

    return { user: result.user, company: result.company } satisfies MeResponse;
  }

  @Public()
  @Post("register")
  @HttpCode(201)
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Ip() ip: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!env.REGISTRATION_ENABLED) {
      throw new NotFoundException("Recurso indisponível");
    }

    const rateKey = `register|${ip}`;
    this.rateLimiter.check(rateKey);

    const result = await this.authService.register(body, request);
    this.rateLimiter.reset(rateKey);
    this.authService.setSessionCookie(response, result.token);

    return { user: result.user, company: result.company } satisfies MeResponse;
  }

  @Public()
  @Post("reset-password")
  @HttpCode(200)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
    @Ip() ip: string,
  ) {
    if (!env.PASSWORD_RESET_ENABLED) {
      throw new NotFoundException("Recurso indisponível");
    }

    const rateKey = `reset|${ip}|${body.email}`;
    this.rateLimiter.check(rateKey);
    await this.authService.resetPassword(body);
    this.rateLimiter.reset(rateKey);

    return { ok: true };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(
    @Auth() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(auth, response);
    return { ok: true };
  }

  @Get("me")
  async me(@Auth() auth: AuthContext): Promise<MeResponse> {
    return this.authService.me(auth);
  }
}
