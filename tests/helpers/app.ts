import { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import type request from "supertest";
import { AppModule } from "../../apps/api/src/app.module";
import { AllExceptionsFilter } from "../../apps/api/src/common/filters/all-exceptions.filter";
import { PrismaService } from "../../apps/api/src/prisma/prisma.module";

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const app = await NestFactory.create(AppModule, { logger: false, rawBody: true });
  app.setGlobalPrefix("api", { exclude: ["health"] });
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();

  const prisma = app.get(PrismaService);
  return { app, prisma };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.whatsAppWebhookEvent.deleteMany();
  await prisma.whatsAppMessageAttempt.deleteMany();
  await prisma.whatsAppMessage.deleteMany();
  await prisma.whatsAppConsent.deleteMany();
  // config referencia template via reminderTemplateId (FK) — apagar antes
  await prisma.whatsAppConfig.deleteMany();
  await prisma.whatsAppTemplate.deleteMany();
  await prisma.cashMovement.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.cashSession.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.product.deleteMany();
  // appointment referencia pet/client/service e users (FK Restrict)
  await prisma.appointment.deleteMany();
  // subscription referencia client/plan/users; cashMovement referencia subscription (SetNull)
  await prisma.subscription.deleteMany();
  await prisma.tenantSubscription.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.pet.deleteMany();
  await prisma.client.deleteMany();
  await prisma.service.deleteMany();
  await prisma.category.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
}

export function sessionCookieFrom(response: request.Response): string {
  const raw = response.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const session = list.find((cookie) => cookie.startsWith("petflow_session="));
  if (!session) {
    throw new Error("Cookie de sessÃ£o nÃ£o retornada na resposta");
  }
  return session.split(";")[0];
}

export function clearCookieHeader(response: request.Response): string {
  const raw = response.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const session = list.find((cookie) => cookie.startsWith("petflow_session="));
  if (!session) {
    throw new Error("Limpeza de cookie nÃ£o retornada na resposta");
  }
  return session.split(";")[0];
}
