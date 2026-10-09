import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { env } from "../config/env";

interface Attempt {
  count: number;
  resetAt: number;
}

@Injectable()
export class LoginRateLimiter {
  private readonly attempts = new Map<string, Attempt>();

  check(key: string): void {
    if (env.AUTH_RATE_LIMIT_MAX <= 0) return;

    const now = Date.now();
    const attempt = this.attempts.get(key);

    if (!attempt || attempt.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + env.AUTH_RATE_LIMIT_WINDOW_MS });
      return;
    }

    if (attempt.count >= env.AUTH_RATE_LIMIT_MAX) {
      const seconds = Math.ceil((attempt.resetAt - now) / 1000);
      throw new HttpException(
        {
          message: "Muitas tentativas de login. Tente novamente em alguns minutos.",
          retryAfterSeconds: seconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    attempt.count += 1;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}
