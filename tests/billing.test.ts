import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp, resetDatabase, sessionCookieFrom } from "./helpers/app";
import type { PrismaService } from "../apps/api/src/prisma/prisma.module";

const PASSWORD = "SenhaForte123!";
const DAY_MS = 86_400_000;

let app: INestApplication;
let prisma: PrismaService;

let adminACookie: string;
let memberACookie: string;
let adminBCookie: string;

async function createUser(params: {
  companyId: string;
  name: string;
  email: string;
  role?: "ADMIN" | "MEMBER";
}) {
  return prisma.user.create({
    data: {
      companyId: params.companyId,
      name: params.name,
      email: params.email,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role: params.role ?? "MEMBER",
    },
  });
}

async function login(email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/auth/login")
    .send({ email, password: PASSWORD });
  if (response.status !== 200) {
    throw new Error(`Login falhou para ${email}: ${response.status}`);
  }
  return sessionCookieFrom(response);
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;

  await resetDatabase(prisma);

  const companyA = await prisma.company.create({
    data: { name: "Empresa Billing A", slug: "billing-a" },
  });
  const companyB = await prisma.company.create({
    data: { name: "Empresa Billing B", slug: "billing-b" },
  });

  await createUser({
    companyId: companyA.id,
    name: "Admin Billing",
    email: "admin@billing-a.test",
    role: "ADMIN",
  });
  await createUser({
    companyId: companyA.id,
    name: "Membro Billing",
    email: "membro@billing-a.test",
  });
  await createUser({
    companyId: companyB.id,
    name: "Admin B",
    email: "admin@billing-b.test",
    role: "ADMIN",
  });

  adminACookie = await login("admin@billing-a.test");
  memberACookie = await login("membro@billing-a.test");
  adminBCookie = await login("admin@billing-b.test");
});

afterAll(async () => {
  await app.close();
});

describe("Billing — catálogo de planos do SaaS", () => {
  it("lista planos globais ativos ordenados por preço", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/billing/plans")
      .set("Cookie", memberACookie);

    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeGreaterThanOrEqual(3);
    expect(response.body.items[0].name).toBe("Essencial");
    expect(response.body.items[0].priceMonthly).toBe("79.90");
    expect(
      response.body.items[response.body.items.length - 1].name,
    ).toBe("Completo");
    expect(
      response.body.items.every((p: { active: boolean }) => p.active),
    ).toBe(true);
  });

  it("exige autenticação", async () => {
    const response = await request(app.getHttpServer()).get("/api/billing/plans");
    expect(response.status).toBe(401);
  });
});

describe("Billing — assinatura da empresa", () => {
  it("404 antes de existir assinatura", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/billing/subscription")
      .set("Cookie", adminACookie);
    expect(response.status).toBe(404);
  });

  it("membro não gerencia assinatura (403)", async () => {
    const response = await request(app.getHttpServer())
      .put("/api/billing/subscription")
      .set("Cookie", memberACookie)
      .send({ planId: "tenantplan_essencial" });
    expect(response.status).toBe(403);
  });

  it("admin escolhe o plano e a assinatura nasce ativa com período de 30 dias", async () => {
    const response = await request(app.getHttpServer())
      .put("/api/billing/subscription")
      .set("Cookie", adminACookie)
      .send({ planId: "tenantplan_profissional" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ACTIVE");
    expect(response.body.plan.name).toBe("Profissional");
    expect(response.body.plan.priceMonthly).toBe("149.90");
    expect(response.body.changedByUserId).toBeTruthy();

    const start = new Date(response.body.currentPeriodStart).getTime();
    const end = new Date(response.body.currentPeriodEnd).getTime();
    expect(end - start).toBe(30 * DAY_MS);
  });

  it("trocar de plano reinicia o período e reativa assinatura cancelada", async () => {
    const cancel = await request(app.getHttpServer())
      .post("/api/billing/subscription/cancel")
      .set("Cookie", adminACookie)
      .send({ reason: "Avaliar outro plano" });
    expect(cancel.status).toBe(201);
    expect(cancel.body.status).toBe("CANCELLED");
    expect(cancel.body.cancelReason).toBe("Avaliar outro plano");

    const change = await request(app.getHttpServer())
      .put("/api/billing/subscription")
      .set("Cookie", adminACookie)
      .send({ planId: "tenantplan_essencial" });
    expect(change.status).toBe(200);
    expect(change.body.status).toBe("ACTIVE");
    expect(change.body.plan.name).toBe("Essencial");
    expect(change.body.cancelReason).toBeNull();
  });

  it("rejeita plano inexistente (404) e plano inativo (400)", async () => {
    const unknown = await request(app.getHttpServer())
      .put("/api/billing/subscription")
      .set("Cookie", adminACookie)
      .send({ planId: "plano-inexistente" });
    expect(unknown.status).toBe(404);

    await prisma.tenantPlan.update({
      where: { id: "tenantplan_completo" },
      data: { active: false },
    });

    const inactive = await request(app.getHttpServer())
      .put("/api/billing/subscription")
      .set("Cookie", adminACookie)
      .send({ planId: "tenantplan_completo" });
    expect(inactive.status).toBe(400);

    await prisma.tenantPlan.update({
      where: { id: "tenantplan_completo" },
      data: { active: true },
    });
  });

  it("isola a assinatura por empresa (404 para outra empresa)", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/billing/subscription")
      .set("Cookie", adminBCookie);
    expect(response.status).toBe(404);
  });
});

describe("Billing — renovação e expiração", () => {
  it("renovação antecipada estende a partir do fim do período atual", async () => {
    const before = await request(app.getHttpServer())
      .get("/api/billing/subscription")
      .set("Cookie", adminACookie);
    const oldEnd = new Date(before.body.currentPeriodEnd).getTime();

    const renew = await request(app.getHttpServer())
      .post("/api/billing/subscription/renew")
      .set("Cookie", adminACookie);

    expect(renew.status).toBe(201);
    expect(renew.body.status).toBe("ACTIVE");
    expect(new Date(renew.body.currentPeriodEnd).getTime()).toBe(
      oldEnd + 30 * DAY_MS,
    );
  });

  it("expiração lazy marca período vencido e renovação reativa", async () => {
    const company = await prisma.company.findFirstOrThrow({
      where: { slug: "billing-a" },
    });
    await prisma.tenantSubscription.update({
      where: { companyId: company.id },
      data: {
        currentPeriodStart: new Date(Date.now() - 60 * DAY_MS),
        currentPeriodEnd: new Date(Date.now() - DAY_MS),
      },
    });

    const expired = await request(app.getHttpServer())
      .get("/api/billing/subscription")
      .set("Cookie", adminACookie);
    expect(expired.status).toBe(200);
    expect(expired.body.status).toBe("EXPIRED");

    const renew = await request(app.getHttpServer())
      .post("/api/billing/subscription/renew")
      .set("Cookie", adminACookie);
    expect(renew.status).toBe(201);
    expect(renew.body.status).toBe("ACTIVE");
    expect(
      new Date(renew.body.currentPeriodEnd).getTime(),
    ).toBeGreaterThan(Date.now());
  });

  it("cancela a assinatura e impede renovação (409)", async () => {
    const cancel = await request(app.getHttpServer())
      .post("/api/billing/subscription/cancel")
      .set("Cookie", adminACookie)
      .send({});
    expect(cancel.status).toBe(201);
    expect(cancel.body.status).toBe("CANCELLED");

    const renew = await request(app.getHttpServer())
      .post("/api/billing/subscription/renew")
      .set("Cookie", adminACookie);
    expect(renew.status).toBe(409);

    const again = await request(app.getHttpServer())
      .post("/api/billing/subscription/cancel")
      .set("Cookie", adminACookie)
      .send({ reason: "De novo" });
    expect(again.status).toBe(409);
  });

  it("membro não renova nem cancela (403) e exige sessão", async () => {
    const memberRenew = await request(app.getHttpServer())
      .post("/api/billing/subscription/renew")
      .set("Cookie", memberACookie);
    expect(memberRenew.status).toBe(403);

    const anon = await request(app.getHttpServer())
      .get("/api/billing/subscription");
    expect(anon.status).toBe(401);
  });
});
