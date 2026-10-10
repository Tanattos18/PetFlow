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
import { CashModule } from "./cash/cash.module";
import { ClientsModule } from "./clients/clients.module";
import { PetsModule } from "./pets/pets.module";
import { ServicesModule } from "./services/services.module";
import { AppointmentsModule } from "./appointments/appointments.module";
import { SubscriptionsModule } from "./subscriptions/subscriptions.module";
import { BillingModule } from "./billing/billing.module";
import { WhatsAppModule } from "./whatsapp/whatsapp.module";
import { ReportsModule } from "./reports/reports.module";
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
    CashModule,
    ClientsModule,
    PetsModule,
    ServicesModule,
    AppointmentsModule,
    SubscriptionsModule,
    BillingModule,
    WhatsAppModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
