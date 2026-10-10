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

let companyAId: string;
let companyBId: string;
let planAId: string;
let inactivePlanAId: string;
let planBId: string;
let clientAId: string;
let inactiveClientAId: string;
let subscriptionAId: string;
let cashSessionId: string;

async function createCompany(slug: string) {
  return prisma.company.create({ data: { name: `Empresa ${slug}`, slug } });
}

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

async function createClient(params: {
  companyId: string;
  name: string;
  status?: "ACTIVE" | "INACTIVE";
}) {
  return prisma.client.create({
    data: {
      companyId: params.companyId,
      name: params.name,
      nameKey: params.name.trim().toLowerCase(),
      status: params.status ?? "ACTIVE",
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

  const companyA = await createCompany("assinaturas-a");
  const companyB = await createCompany("assinaturas-b");
  companyAId = companyA.id;
  companyBId = companyB.id;

  await createUser({
    companyId: companyA.id,
    name: "Admin A",
    email: "admin@assinaturas-a.test",
    role: "ADMIN",
  });
  await createUser({
    companyId: companyA.id,
    name: "Membro A",
    email: "membro@assinaturas-a.test",
  });
  await createUser({
    companyId: companyB.id,
    name: "Admin B",
    email: "admin@assinaturas-b.test",
    role: "ADMIN",
  });

  const clientA = await createClient({ companyId: companyA.id, name: "Ana Silva" });
  clientAId = clientA.id;
  const inactiveClient = await createClient({
    companyId: companyA.id,
    name: "Carlos Inativo",
    status: "INACTIVE",
  });
  inactiveClientAId = inactiveClient.id;
  await createClient({ companyId: companyB.id, name: "Bruno B" });

  const planA = await prisma.subscriptionPlan.create({
    data: {
      companyId: companyA.id,
      name: "Plano Banho Mensal",
      nameKey: "plano banho mensal",
      price: "89.90",
      durationDays: 30,
      createdByUserId: (await prisma.user.findFirstOrThrow({
        where: { email: "admin@assinaturas-a.test" },
      })).id,
    },
  });
  planAId = planA.id;

  const inactivePlan = await prisma.subscriptionPlan.create({
    data: {
      companyId: companyA.id,
      name: "Plano Descontinuado",
      nameKey: "plano descontinuado",
      price: "49.90",
      durationDays: 15,
      status: "INACTIVE",
      createdByUserId: (await prisma.user.findFirstOrThrow({
        where: { email: "admin@assinaturas-a.test" },
      })).id,
    },
  });
  inactivePlanAId = inactivePlan.id;

  const planB = await prisma.subscriptionPlan.create({
    data: {
      companyId: companyB.id,
      name: "Plano Banho Empresa B",
      nameKey: "plano banho empresa b",
      price: "79.90",
      durationDays: 30,
      createdByUserId: (await prisma.user.findFirstOrThrow({
        where: { email: "admin@assinaturas-b.test" },
      })).id,
    },
  });
  planBId = planB.id;

  adminACookie = await login("admin@assinaturas-a.test");
  memberACookie = await login("membro@assinaturas-a.test");
  adminBCookie = await login("admin@assinaturas-b.test");
});

afterAll(async () => {
  await app.close();
});

describe("Planos de assinatura — CRUD e permissões", () => {
  it("admin cria plano com preço e duração", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/subscription-plans")
      .set("Cookie", adminACookie)
      .send({
        name: "Plano Tosa Trimestral",
        description: "Uma tosa por mês",
        price: "120.00",
        durationDays: 90,
      });

    expect(response.status).toBe(201);
    expect(response.body.price).toBe("120.00");
    expect(response.body.durationDays).toBe(90);
    expect(response.body.status).toBe("ACTIVE");
  });

  it("membro não cria plano (403) mas pode listar (200)", async () => {
    const create = await request(app.getHttpServer())
      .post("/api/subscription-plans")
      .set("Cookie", memberACookie)
      .send({ name: "Não Pode", price: "10.00", durationDays: 30 });
    expect(create.status).toBe(403);

    const list = await request(app.getHttpServer())
      .get("/api/subscription-plans")
      .set("Cookie", memberACookie);
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBeGreaterThanOrEqual(2);
  });

  it("nome duplicado por empresa é rejeitado; mesmo nome em outra empresa é aceito", async () => {
    const duplicate = await request(app.getHttpServer())
      .post("/api/subscription-plans")
      .set("Cookie", adminACookie)
      .send({ name: "  PLANO banho   MENSAL ", price: "99.00", durationDays: 30 });
    expect(duplicate.status).toBe(409);

    const other = await request(app.getHttpServer())
      .post("/api/subscription-plans")
      .set("Cookie", adminBCookie)
      .send({ name: "Plano Banho Mensal", price: "99.00", durationDays: 30 });
    expect(other.status).toBe(201);
  });

  it("valida preço e duração (400 com issues)", async () => {
    const missingPrice = await request(app.getHttpServer())
      .post("/api/subscription-plans")
      .set("Cookie", adminACookie)
      .send({ name: "Sem Preço", durationDays: 30 });
    expect(missingPrice.status).toBe(400);
    expect(
      missingPrice.body.issues?.some((i: { path: string }) => i.path === "price"),
    ).toBe(true);

    const zeroDays = await request(app.getHttpServer())
      .post("/api/subscription-plans")
      .set("Cookie", adminACookie)
      .send({ name: "Duração Zero", price: "10.00", durationDays: 0 });
    expect(zeroDays.status).toBe(400);

    const tooLong = await request(app.getHttpServer())
      .post("/api/subscription-plans")
      .set("Cookie", adminACookie)
      .send({ name: "Duração Longa", price: "10.00", durationDays: 3651 });
    expect(tooLong.status).toBe(400);
  });

  it("detalha, edita e inativa plano; acesso cruzado é 404", async () => {
    const detail = await request(app.getHttpServer())
      .get(`/api/subscription-plans/${planAId}`)
      .set("Cookie", adminACookie);
    expect(detail.status).toBe(200);
    expect(detail.body.price).toBe("89.90");

    const cross = await request(app.getHttpServer())
      .get(`/api/subscription-plans/${planBId}`)
      .set("Cookie", adminACookie);
    expect(cross.status).toBe(404);

    const editable = await request(app.getHttpServer())
      .post("/api/subscription-plans")
      .set("Cookie", adminACookie)
      .send({ name: "Plano Para Editar", price: "10.00", durationDays: 30 });
    expect(editable.status).toBe(201);

    const update = await request(app.getHttpServer())
      .patch(`/api/subscription-plans/${editable.body.id}`)
      .set("Cookie", adminACookie)
      .send({ price: "94.90", description: "Reajuste anual" });
    expect(update.status).toBe(200);
    expect(update.body.price).toBe("94.90");

    const deactivate = await request(app.getHttpServer())
      .patch(`/api/subscription-plans/${editable.body.id}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.status).toBe("INACTIVE");

    const memberEdit = await request(app.getHttpServer())
      .patch(`/api/subscription-plans/${editable.body.id}`)
      .set("Cookie", memberACookie)
      .send({ price: "1.00" });
    expect(memberEdit.status).toBe(403);
  });

  it("exige autenticação", async () => {
    const response = await request(app.getHttpServer()).get("/api/subscription-plans");
    expect(response.status).toBe(401);
  });
});

describe("Assinaturas — criação, caixa e validações", () => {
  it("admin cria assinatura sem pagamento (201) com período de 30 dias", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/subscriptions")
      .set("Cookie", adminACookie)
      .send({ clientId: clientAId, planId: planAId });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("ACTIVE");
    expect(response.body.renewalCount).toBe(0);
    expect(response.body.lastPaymentAt).toBeNull();
    expect(response.body.plan.name).toBe("Plano Banho Mensal");
    expect(response.body.client.name).toBe("Ana Silva");

    const start = new Date(response.body.startAt).getTime();
    const end = new Date(response.body.endAt).getTime();
    expect(end - start).toBe(30 * DAY_MS);
    subscriptionAId = response.body.id;
  });

  it("rejeita cliente inativo, cliente/plano de outra empresa e plano inativo", async () => {
    const inactiveClient = await request(app.getHttpServer())
      .post("/api/subscriptions")
      .set("Cookie", adminACookie)
      .send({ clientId: inactiveClientAId, planId: planAId });
    expect(inactiveClient.status).toBe(400);

    const unknownClient = await request(app.getHttpServer())
      .post("/api/subscriptions")
      .set("Cookie", adminACookie)
      .send({ clientId: "client-inexistente", planId: planAId });
    expect(unknownClient.status).toBe(404);

    const crossPlan = await request(app.getHttpServer())
      .post("/api/subscriptions")
      .set("Cookie", adminACookie)
      .send({ clientId: clientAId, planId: planBId });
    expect(crossPlan.status).toBe(404);

    const inactivePlan = await request(app.getHttpServer())
      .post("/api/subscriptions")
      .set("Cookie", adminACookie)
      .send({ clientId: clientAId, planId: inactivePlanAId });
    expect(inactivePlan.status).toBe(400);

    const memberCreate = await request(app.getHttpServer())
      .post("/api/subscriptions")
      .set("Cookie", memberACookie)
      .send({ clientId: clientAId, planId: planAId });
    expect(memberCreate.status).toBe(403);
  });

  it("pagamento exige caixa aberto (409) e grava movimento vinculado", async () => {
    const closed = await request(app.getHttpServer())
      .post("/api/subscriptions")
      .set("Cookie", adminACookie)
      .send({ clientId: clientAId, planId: planAId, registerPayment: true });
    expect(closed.status).toBe(409);
    expect(closed.body.message).toContain("Caixa fechado");

    const opened = await request(app.getHttpServer())
      .post("/api/cash/sessions")
      .set("Cookie", adminACookie)
      .send({ initialAmount: "100.00" });
    expect(opened.status).toBe(201);
    cashSessionId = opened.body.id;

    const paid = await request(app.getHttpServer())
      .post("/api/subscriptions")
      .set("Cookie", adminACookie)
      .send({ clientId: clientAId, planId: planAId, registerPayment: true });
    expect(paid.status).toBe(201);
    expect(paid.body.lastPaymentAt).toBeTruthy();
    subscriptionAId = paid.body.id;

    const movement = await prisma.cashMovement.findFirst({
      where: { subscriptionId: paid.body.id },
    });
    expect(movement).not.toBeNull();
    expect(movement!.type).toBe("IN");
    expect(movement!.origin).toBe("MANUAL");
    expect(movement!.amount.toFixed(2)).toBe("89.90");
    expect(movement!.description).toContain("Ana Silva");
    expect(movement!.cashSessionId).toBe(cashSessionId);
  });
});

describe("Assinaturas — lista, detalhe, renovação e expiração", () => {
  it("lista com filtros e isola empresas", async () => {
    const active = await request(app.getHttpServer())
      .get("/api/subscriptions?status=ACTIVE")
      .set("Cookie", adminACookie);
    expect(active.status).toBe(200);
    expect(active.body.items.length).toBeGreaterThanOrEqual(2);
    expect(
      active.body.items.every((s: { status: string }) => s.status === "ACTIVE"),
    ).toBe(true);

    const search = await request(app.getHttpServer())
      .get("/api/subscriptions?search=ana")
      .set("Cookie", adminACookie);
    expect(search.status).toBe(200);
    expect(
      search.body.items.every(
        (s: { client: { name: string } }) =>
          s.client.name.toLowerCase().includes("ana") ||
          s.plan.name.toLowerCase().includes("ana"),
      ),
    ).toBe(true);

    const fromB = await request(app.getHttpServer())
      .get("/api/subscriptions")
      .set("Cookie", adminBCookie);
    expect(fromB.status).toBe(200);
    expect(
      fromB.body.items.every(
        (s: { client: { name: string } }) => s.client.name === "Bruno B",
      ),
    ).toBe(true);
  });

  it("detalha com histórico de pagamentos e isola cross-tenant (404)", async () => {
    const detail = await request(app.getHttpServer())
      .get(`/api/subscriptions/${subscriptionAId}`)
      .set("Cookie", adminACookie);
    expect(detail.status).toBe(200);
    expect(detail.body.payments.length).toBeGreaterThanOrEqual(1);
    expect(detail.body.payments[0].amount).toBe("89.90");

    const cross = await request(app.getHttpServer())
      .get(`/api/subscriptions/${subscriptionAId}`)
      .set("Cookie", adminBCookie);
    expect(cross.status).toBe(404);
  });

  it("renovação estende o período e cria novo movimento no caixa", async () => {
    const before = await request(app.getHttpServer())
      .get(`/api/subscriptions/${subscriptionAId}`)
      .set("Cookie", adminACookie);
    const oldEnd = new Date(before.body.endAt).getTime();

    const renew = await request(app.getHttpServer())
      .post(`/api/subscriptions/${subscriptionAId}/renew`)
      .set("Cookie", adminACookie);
    expect(renew.status).toBe(201);
    expect(renew.body.renewalCount).toBe(1);
    expect(renew.body.status).toBe("ACTIVE");
    expect(new Date(renew.body.endAt).getTime()).toBe(oldEnd + 30 * DAY_MS);

    const movements = await prisma.cashMovement.count({
      where: { subscriptionId: subscriptionAId },
    });
    expect(movements).toBe(2);
  });

  it("renovação falha com caixa fechado (409)", async () => {
    const closed = await request(app.getHttpServer())
      .post(`/api/cash/sessions/${cashSessionId}/close`)
      .set("Cookie", adminACookie)
      .send({ countedAmount: "189.80" });
    expect(closed.status).toBe(201);

    const renew = await request(app.getHttpServer())
      .post(`/api/subscriptions/${subscriptionAId}/renew`)
      .set("Cookie", adminACookie);
    expect(renew.status).toBe(409);
    expect(renew.body.message).toContain("Caixa fechado");
  });

  it("expiração lazy marca assinatura vencida como EXPIRED", async () => {
    await prisma.subscription.create({
      data: {
        companyId: companyAId,
        clientId: clientAId,
        planId: planAId,
        startAt: new Date(Date.now() - 60 * DAY_MS),
        endAt: new Date(Date.now() - DAY_MS),
        createdByUserId: (await prisma.user.findFirstOrThrow({
          where: { email: "admin@assinaturas-a.test" },
        })).id,
      },
    });

    const list = await request(app.getHttpServer())
      .get("/api/subscriptions?status=EXPIRED")
      .set("Cookie", adminACookie);
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBeGreaterThanOrEqual(1);
    expect(
      list.body.items.every((s: { status: string }) => s.status === "EXPIRED"),
    ).toBe(true);
  });
});

describe("Assinaturas — cancelamento", () => {
  it("valida motivo obrigatório (400)", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/subscriptions/${subscriptionAId}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "ab" });
    expect(response.status).toBe(400);
  });

  it("cancela com motivo, impede renovação e duplo cancelamento", async () => {
    const cancel = await request(app.getHttpServer())
      .post(`/api/subscriptions/${subscriptionAId}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "Cliente mudou de cidade" });
    expect(cancel.status).toBe(201);
    expect(cancel.body.status).toBe("CANCELLED");
    expect(cancel.body.cancelReason).toBe("Cliente mudou de cidade");
    expect(cancel.body.cancelledAt).toBeTruthy();

    const renew = await request(app.getHttpServer())
      .post(`/api/subscriptions/${subscriptionAId}/renew`)
      .set("Cookie", adminACookie);
    expect(renew.status).toBe(409);

    const again = await request(app.getHttpServer())
      .post(`/api/subscriptions/${subscriptionAId}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "Tentar cancelar de novo" });
    expect(again.status).toBe(409);
  });

  it("membro não cancela (403) e exige autenticação", async () => {
    const member = await request(app.getHttpServer())
      .post(`/api/subscriptions/${subscriptionAId}/cancel`)
      .set("Cookie", memberACookie)
      .send({ reason: "Membro não pode" });
    expect(member.status).toBe(403);

    const anon = await request(app.getHttpServer())
      .get("/api/subscriptions");
    expect(anon.status).toBe(401);
  });

  it("dados das empresas permanecem isolados", async () => {
    const a = await prisma.subscription.count({ where: { companyId: companyAId } });
    const b = await prisma.subscription.count({ where: { companyId: companyBId } });
    expect(a).toBeGreaterThanOrEqual(3);
    expect(b).toBe(0);

    const plans = await prisma.subscriptionPlan.count({
      where: { companyId: companyAId },
    });
    expect(plans).toBeGreaterThanOrEqual(3);
  });
});
