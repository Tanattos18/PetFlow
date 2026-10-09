import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { LoginRateLimiter } from "./login-rate.limit";
import { OriginCheckMiddleware } from "../common/middleware/origin-check.middleware";

@Module({
  controllers: [AuthController],
  providers: [AuthService, LoginRateLimiter],
  exports: [AuthService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(OriginCheckMiddleware).forRoutes("auth");
  }
}
