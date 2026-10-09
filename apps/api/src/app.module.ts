import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CategoriesModule } from "./categories/categories.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { ProductsModule } from "./products/products.module";
import { StockModule } from "./stock/stock.module";
import { SalesModule } from "./sales/sales.module";
import { AuthGuard } from "./common/guards/auth.guard";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    SuppliersModule,
    ProductsModule,
    StockModule,
    SalesModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
