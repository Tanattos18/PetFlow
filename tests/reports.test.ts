import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp, resetDatabase, sessionCookieFrom } from "./helpers/app";
import type { PrismaService } from "../apps/api/src/prisma/prisma.module";

const PASSWORD = "SenhaForte123!";

let app: INestApplication;
let prisma: PrismaService;

let adminACookie: string;
let memberACookie: string;
let adminBCookie: string;

let companyBId: string;
let adminAId: string;
let openSessionAId: string;

const now = new Date();
const today = now.toISOString().slice(0, 10);
const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);

function at(day: string, time: string): Date {
  return new Date(`${day}T${time}Z`);
}

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

async function login(email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/auth/login")
    .send({ email, password: PASSWORD });
  if (response.status !== 200) {
    throw new Error(`Login falhou para ${email}: ${response.status}`);
  }
  return sessionCookieFrom(response);
}

function get(path: string, cookie: string) {
  return request(app.getHttpServer()).get(path).set("Cookie", cookie);
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;

  await resetDatabase(prisma);

  const companyA = await createCompany("relatorios-a");
  const companyB = await createCompany("relatorios-b");
  companyBId = companyB.id;

  const adminA = await createUser({
    companyId: companyA.id,
    name: "Admin A",
    email: "admin@relatorios-a.test",
    role: "ADMIN",
  });
  adminAId = adminA.id;
  await createUser({
    companyId: companyA.id,
    name: "Membro A",
    email: "membro@relatorios-a.test",
  });
  const adminB = await createUser({
    companyId: companyB.id,
    name: "Admin B",
    email: "admin@relatorios-b.test",
    role: "ADMIN",
  });

  adminACookie = await login("admin@relatorios-a.test");
  memberACookie = await login("membro@relatorios-a.test");
  adminBCookie = await login("admin@relatorios-b.test");

  // --- Produtos (empresa A) ---
  await prisma.product.create({
    data: {
      companyId: companyA.id,
      name: "Relatorios Prod Ok",
      sku: "REP-OK",
      salePrice: "50.00",
      stockQuantity: 5,
      minimumStock: 0,
    },
  });
  await prisma.product.create({
    data: {
      companyId: companyA.id,
      name: "Relatorios Prod Low",
      sku: "REP-LOW",
      salePrice: "30.00",
      stockQuantity: 2,
      minimumStock: 5,
    },
  });
  await prisma.product.create({
    data: {
      companyId: companyA.id,
      name: "Relatorios Prod Out",
      sku: "REP-OUT",
      salePrice: "10.00",
      stockQuantity: 0,
      minimumStock: 0,
    },
  });
  await prisma.product.create({
    data: {
      companyId: companyA.id,
      name: "Relatorios Prod Inactive Zero",
      sku: "REP-INAT",
      salePrice: "10.00",
      stockQuantity: 0,
      minimumStock: 0,
      status: "INACTIVE",
    },
  });
  const productB = await prisma.product.create({
    data: {
      companyId: companyB.id,
      name: "Relatorios B Out",
      sku: "REPB-OUT",
      salePrice: "10.00",
      stockQuantity: 0,
      minimumStock: 0,
    },
  });

  // --- Clientes (empresa A: 2 hoje, 1 ontem; empresa B: 1 hoje) ---
  const hackClient = await prisma.client.create({
    data: {
      companyId: companyA.id,
      name: "=HACK Client",
      nameKey: "=hack client",
      createdAt: at(today, "10:00:00.000"),
    },
  });
  await prisma.client.create({
    data: {
      companyId: companyA.id,
      name: "Cliente Relatorio Hoje",
      nameKey: "cliente relatorio hoje",
      createdAt: at(today, "11:00:00.000"),
    },
  });
  await prisma.client.create({
    data: {
      companyId: companyA.id,
      name: "Cliente Relatorio Ontem",
      nameKey: "cliente relatorio ontem",
      createdAt: at(yesterday, "10:00:00.000"),
    },
  });
  const clientB = await prisma.client.create({
    data: {
      companyId: companyB.id,
      name: "Cliente Relatorios B",
      nameKey: "cliente relatorios b",
      createdAt: at(today, "10:00:00.000"),
    },
  });

  // --- Pets (empresa A: 2 DOG + 1 CAT hoje, 1 DOG ontem; B: 1 hoje) ---
  await prisma.pet.create({
    data: {
      companyId: companyA.id,
      clientId: hackClient.id,
      name: "Rex",
      species: "DOG",
      createdAt: at(today, "10:30:00.000"),
    },
  });
  await prisma.pet.create({
    data: {
      companyId: companyA.id,
      clientId: hackClient.id,
      name: "Bolt",
      species: "DOG",
      createdAt: at(today, "12:00:00.000"),
    },
  });
  await prisma.pet.create({
    data: {
      companyId: companyA.id,
      clientId: hackClient.id,
      name: "Mimi",
      species: "CAT",
      createdAt: at(today, "13:00:00.000"),
    },
  });
  await prisma.pet.create({
    data: {
      companyId: companyA.id,
      clientId: hackClient.id,
      name: "Toto",
      species: "DOG",
      createdAt: at(yesterday, "09:00:00.000"),
    },
  });
  await prisma.pet.create({
    data: {
      companyId: companyB.id,
      clientId: clientB.id,
      name: "Pet B",
      species: "CAT",
      createdAt: at(today, "10:30:00.000"),
    },
  });

  // --- Vendas (empresa A) ---
  await prisma.sale.create({
    data: {
      companyId: companyA.id,
      receiptCode: "PF-REPA01",
      status: "COMPLETED",
      subtotal: "100.00",
      discount: "10.00",
      total: "90.00",
      paymentMethod: "CASH",
      createdByUserId: adminAId,
      clientId: hackClient.id,
      createdAt: at(today, "14:00:00.000"),
    },
  });
  await prisma.sale.create({
    data: {
      companyId: companyA.id,
      receiptCode: "PF-REPA02",
      status: "COMPLETED",
      subtotal: "50.00",
      discount: "0.00",
      total: "50.00",
      paymentMethod: "PIX",
      createdByUserId: adminAId,
      createdAt: at(today, "14:05:00.000"),
    },
  });
  await prisma.sale.create({
    data: {
      companyId: companyA.id,
      receiptCode: "PF-REPA03",
      status: "CANCELLED",
      subtotal: "80.00",
      discount: "0.00",
      total: "80.00",
      paymentMethod: "CASH",
      createdByUserId: adminAId,
      createdAt: at(today, "14:10:00.000"),
    },
  });
  await prisma.sale.create({
    data: {
      companyId: companyA.id,
      receiptCode: "PF-REPA04",
      status: "COMPLETED",
      subtotal: "40.00",
      discount: "0.00",
      total: "40.00",
      paymentMethod: "CASH",
      createdByUserId: adminAId,
      createdAt: at(yesterday, "12:00:00.000"),
    },
  });
  await prisma.sale.create({
    data: {
      companyId: companyA.id,
      receiptCode: "PF-REPA05",
      status: "COMPLETED",
      subtotal: "30.00",
      discount: "0.00",
      total: "30.00",
      paymentMethod: "OTHER",
      createdByUserId: adminAId,
      createdAt: at(today, "00:00:00.000"),
    },
  });
  await prisma.sale.create({
    data: {
      companyId: companyA.id,
      receiptCode: "PF-REPA06",
      status: "COMPLETED",
      subtotal: "60.00",
      discount: "0.00",
      total: "60.00",
      paymentMethod: "PIX",
      createdByUserId: adminAId,
      createdAt: at(yesterday, "23:59:59.999"),
    },
  });
  await prisma.sale.create({
    data: {
      companyId: companyB.id,
      receiptCode: "PF-REPB01",
      status: "COMPLETED",
      subtotal: "999.99",
      discount: "0.00",
      total: "999.99",
      paymentMethod: "CARD",
      createdByUserId: adminB.id,
      createdAt: at(today, "15:00:00.000"),
    },
  });

  // --- Movimentações de estoque ---
  const productOk = await prisma.product.findFirstOrThrow({
    where: { companyId: companyA.id, sku: "REP-OK" },
  });
  await prisma.stockMovement.create({
    data: {
      companyId: companyA.id,
      productId: productOk.id,
      type: "IN",
      quantity: "5",
      createdByUserId: adminAId,
      createdAt: at(today, "09:00:00.000"),
    },
  });
  await prisma.stockMovement.create({
    data: {
      companyId: companyA.id,
      productId: productOk.id,
      type: "OUT",
      quantity: "2",
      createdByUserId: adminAId,
      createdAt: at(today, "09:30:00.000"),
    },
  });
  await prisma.stockMovement.create({
    data: {
      companyId: companyA.id,
      productId: productOk.id,
      type: "ADJUST_NEGATIVE",
      quantity: "1",
      createdByUserId: adminAId,
      createdAt: at(today, "09:45:00.000"),
    },
  });
  await prisma.stockMovement.create({
    data: {
      companyId: companyA.id,
      productId: productOk.id,
      type: "IN",
      quantity: "10",
      createdByUserId: adminAId,
      createdAt: at(yesterday, "15:00:00.000"),
    },
  });
  await prisma.stockMovement.create({
    data: {
      companyId: companyB.id,
      productId: productB.id,
      type: "OUT",
      quantity: "1",
      createdByUserId: adminB.id,
      createdAt: at(today, "16:00:00.000"),
    },
  });

  // --- Caixa ---
  const openA = await prisma.cashSession.create({
    data: {
      companyId: companyA.id,
      status: "OPEN",
      initialAmount: "100.00",
      openedByUserId: adminAId,
      openedAt: at(today, "08:00:00.000"),
    },
  });
  openSessionAId = openA.id;
  await prisma.cashSession.create({
    data: {
      companyId: companyA.id,
      status: "CLOSED",
      initialAmount: "50.00",
      openedByUserId: adminAId,
      openedAt: at(yesterday, "09:00:00.000"),
      closedAt: at(today, "18:00:00.000"),
      closedByUserId: adminAId,
      countedAmount: "48.50",
      expectedAmount: "50.00",
      difference: "-1.50",
    },
  });
  await prisma.cashMovement.create({
    data: {
      companyId: companyA.id,
      cashSessionId: openSessionAId,
      type: "IN",
      origin: "MANUAL",
      inCash: true,
      amount: "200.00",
      description: "Reposição de troco",
      createdByUserId: adminAId,
      createdAt: at(today, "08:10:00.000"),
    },
  });
  await prisma.cashMovement.create({
    data: {
      companyId: companyA.id,
      cashSessionId: openSessionAId,
      type: "OUT",
      origin: "MANUAL",
      inCash: true,
      amount: "50.00",
      description: "Saque",
      justification: "Retirada de valor",
      createdByUserId: adminAId,
      createdAt: at(today, "12:00:00.000"),
    },
  });
  await prisma.cashMovement.create({
    data: {
      companyId: companyA.id,
      cashSessionId: openSessionAId,
      type: "OUT",
      origin: "MANUAL",
      inCash: false,
      amount: "30.00",
      description: "Pagamento eletrônico",
      createdByUserId: adminAId,
      createdAt: at(today, "12:30:00.000"),
    },
  });
  await prisma.cashMovement.create({
    data: {
      companyId: companyA.id,
      cashSessionId: openSessionAId,
      type: "OUT",
      origin: "REVERSAL",
      inCash: true,
      amount: "20.00",
      description: "Estorno de entrada",
      createdByUserId: adminAId,
      createdAt: at(today, "17:00:00.000"),
    },
  });
  await prisma.cashSession.create({
    data: {
      companyId: companyB.id,
      status: "OPEN",
      initialAmount: "10.00",
      openedByUserId: adminB.id,
      openedAt: at(today, "08:00:00.000"),
    },
  });

  // --- WhatsApp ---
  await prisma.whatsAppMessage.create({
    data: {
      companyId: companyA.id,
      toPhone: "5511999990001",
      templateNameSnapshot: "ola",
      templateLanguageSnapshot: "pt_BR",
      templateBodySnapshot: "Ola {{1}}",
      status: "DELIVERED",
      createdAt: at(today, "10:00:00.000"),
    },
  });
  await prisma.whatsAppMessage.create({
    data: {
      companyId: companyA.id,
      toPhone: "5511999990002",
      templateNameSnapshot: "ola",
      templateLanguageSnapshot: "pt_BR",
      templateBodySnapshot: "Ola {{1}}",
      status: "ACCEPTED",
      createdAt: at(today, "10:05:00.000"),
    },
  });
  await prisma.whatsAppMessage.create({
    data: {
      companyId: companyA.id,
      toPhone: "5511999990003",
      templateNameSnapshot: "ola",
      templateLanguageSnapshot: "pt_BR",
      templateBodySnapshot: "Ola {{1}}",
      status: "FAILED",
      failureReason: "Recipient not in allowlist",
      createdAt: at(today, "10:10:00.000"),
    },
  });
  await prisma.whatsAppMessage.create({
    data: {
      companyId: companyA.id,
      toPhone: "5511999990004",
      templateNameSnapshot: "ola",
      templateLanguageSnapshot: "pt_BR",
      templateBodySnapshot: "Ola {{1}}",
      status: "PENDING",
      createdAt: at(today, "10:15:00.000"),
    },
  });
  await prisma.whatsAppMessage.create({
    data: {
      companyId: companyA.id,
      toPhone: "5511999990005",
      templateNameSnapshot: "ola",
      templateLanguageSnapshot: "pt_BR",
      templateBodySnapshot: "Ola {{1}}",
      status: "DELIVERED",
      createdAt: at(yesterday, "10:00:00.000"),
    },
  });
});

afterAll(async () => {
  await app?.close();
});

describe("GET /api/reports/summary", () => {
  it("exige sessão autenticada", async () => {
    const response = await request(app.getHttpServer()).get("/api/reports/summary");
    expect(response.status).toBe(401);
  });

  it("padrão de 30 dias agrega vendas de hoje e ontem com período UTC", async () => {
    const response = await get("/api/reports/summary", adminACookie);
    expect(response.status).toBe(200);
    const body = response.body;
    expect(body.period.timezone).toBe("UTC");
    expect(body.period.to).toBe(today);
    expect(body.period.from).toBe(
      new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10),
    );
    expect(body.sales.completedCount).toBe(5);
    expect(body.sales.net).toBe("270.00");
    expect(body.sales.gross).toBe("280.00");
    expect(body.sales.discounts).toBe("10.00");
    expect(body.sales.cancelledCount).toBe(1);
    expect(body.sales.cancelledTotal).toBe("80.00");
    expect(body.sales.ticketAverage).toBe("54.00");
  });

  it("janela de um dia é inclusiva nos limites (UTC) e exclui o dia vizinho", async () => {
    const todayResponse = await get(
      `/api/reports/summary?from=${today}&to=${today}`,
      adminACookie,
    );
    expect(todayResponse.status).toBe(200);
    const todayBody = todayResponse.body;
    // inclui venda às 00:00:00.000 do próprio dia
    expect(todayBody.sales.completedCount).toBe(3);
    expect(todayBody.sales.net).toBe("170.00");
    expect(todayBody.sales.gross).toBe("180.00");
    expect(todayBody.sales.discounts).toBe("10.00");
    expect(todayBody.sales.cancelledCount).toBe(1);
    expect(todayBody.sales.cancelledTotal).toBe("80.00");
    // exclui ontem 23:59:59.999
    const yesterdayResponse = await get(
      `/api/reports/summary?from=${yesterday}&to=${yesterday}`,
      adminACookie,
    );
    expect(yesterdayResponse.status).toBe(200);
    const yesterdayBody = yesterdayResponse.body;
    expect(yesterdayBody.sales.completedCount).toBe(2);
    expect(yesterdayBody.sales.net).toBe("100.00");
  });

  it("calcula ticket médio com 2 casas (170/3 = 56.67)", async () => {
    const response = await get(
      `/api/reports/summary?from=${today}&to=${today}`,
      adminACookie,
    );
    expect(response.body.sales.ticketAverage).toBe("56.67");
  });

  it("quando não há vendas, ticket médio é null e totais zeram", async () => {
    const response = await get(
      "/api/reports/summary?from=2020-01-01&to=2020-01-02",
      adminACookie,
    );
    expect(response.status).toBe(200);
    expect(response.body.sales.completedCount).toBe(0);
    expect(response.body.sales.net).toBe("0.00");
    expect(response.body.sales.ticketAverage).toBeNull();
    expect(response.body.salesByDay).toEqual([]);
  });

  it("agrupa vendas por dia em UTC", async () => {
    const response = await get(
      `/api/reports/summary?from=${yesterday}&to=${today}`,
      adminACookie,
    );
    const byDay = response.body.salesByDay as Array<{
      day: string;
      count: number;
      net: string;
    }>;
    expect(byDay).toHaveLength(2);
    expect(byDay[0]).toEqual({ day: yesterday, count: 2, net: "100.00" });
    expect(byDay[1]).toEqual({ day: today, count: 3, net: "170.00" });
  });

  it("separa vendas por forma de pagamento (apenas concluídas)", async () => {
    const response = await get(
      `/api/reports/summary?from=${today}&to=${today}`,
      adminACookie,
    );
    const rows = response.body.salesByPaymentMethod as Array<{
      paymentMethod: string;
      count: number;
      net: string;
    }>;
    const byMethod = Object.fromEntries(
      rows.map((row) => [row.paymentMethod, row]),
    );
    expect(byMethod.CASH).toMatchObject({ count: 1, net: "90.00" });
    expect(byMethod.PIX).toMatchObject({ count: 1, net: "50.00" });
    expect(byMethod.OTHER).toMatchObject({ count: 1, net: "30.00" });
    expect(byMethod.CARD).toBeUndefined();
  });

  it("caixa: saldo esperado da sessão aberta e entradas/saídas do período", async () => {
    const response = await get(
      `/api/reports/summary?from=${today}&to=${today}`,
      adminACookie,
    );
    const cash = response.body.cash;
    expect(cash.openSession).not.toBeNull();
    expect(cash.openSession.expectedBalance).toBe("230.00");
    expect(cash.entriesInCash).toBe("200.00");
    expect(cash.exitsInCash).toBe("70.00");
    expect(cash.entriesTotal).toBe("200.00");
    expect(cash.exitsTotal).toBe("100.00");
  });

  it("estoque: contagens de produtos sem estoque e com estoque baixo", async () => {
    const response = await get("/api/reports/summary", adminACookie);
    expect(response.body.stock.outOfStockCount).toBe(1);
    expect(response.body.stock.lowStockCount).toBe(1);
  });

  it("clientes: novos clientes e pets por período", async () => {
    const todayResponse = await get(
      `/api/reports/summary?from=${today}&to=${today}`,
      adminACookie,
    );
    expect(todayResponse.body.clients).toEqual({ newClients: 2, newPets: 3 });
    const yesterdayResponse = await get(
      `/api/reports/summary?from=${yesterday}&to=${yesterday}`,
      adminACookie,
    );
    expect(yesterdayResponse.body.clients).toEqual({ newClients: 1, newPets: 1 });
  });

  it("whatsapp: aceitas pela API não são contadas como entregues", async () => {
    const response = await get(
      `/api/reports/summary?from=${today}&to=${today}`,
      adminACookie,
    );
    const whatsapp = response.body.whatsapp;
    expect(whatsapp.total).toBe(4);
    expect(whatsapp.delivered).toBe(1);
    expect(whatsapp.accepted).toBe(1);
    expect(whatsapp.failed).toBe(1);
    expect(whatsapp.pending).toBe(1);
    expect(whatsapp.read).toBe(0);
  });

  it("módulo de serviços realizados é explicitamente indisponível", async () => {
    const response = await get("/api/reports/summary", adminACookie);
    expect(response.body.modules.servicesRealized.available).toBe(false);
    expect(response.body.modules.servicesRealized.reason).toContain("Etapa 8");
  });

  it("valida período: data final anterior, intervalo longo e data inválida", async () => {
    const inverted = await get(
      `/api/reports/summary?from=${today}&to=${yesterday}`,
      adminACookie,
    );
    expect(inverted.status).toBe(400);

    const tooLong = await get(
      "/api/reports/summary?from=2024-01-01&to=2026-01-01",
      adminACookie,
    );
    expect(tooLong.status).toBe(400);

    const badFormat = await get("/api/reports/summary?from=01-01-2026", adminACookie);
    expect(badFormat.status).toBe(400);

    const badDate = await get("/api/reports/summary?from=2026-02-30", adminACookie);
    expect(badDate.status).toBe(400);
  });

  it("ignora companyId enviado pelo cliente (escopo vem da sessão)", async () => {
    const response = await get(
      `/api/reports/summary?from=${today}&to=${today}&companyId=${companyBId}`,
      adminACookie,
    );
    expect(response.status).toBe(200);
    expect(response.body.sales.net).toBe("170.00");
    expect(response.body.sales.completedCount).toBe(3);
  });

  it("isolamento multiempresa: dados da empresa B não vazam para A e vice-versa", async () => {
    const summaryA = await get(
      `/api/reports/summary?from=${today}&to=${today}`,
      adminACookie,
    );
    expect(summaryA.body.sales.net).toBe("170.00");
    expect(summaryA.body.whatsapp.total).toBe(4);

    const summaryB = await get(
      `/api/reports/summary?from=${today}&to=${today}`,
      adminBCookie,
    );
    expect(summaryB.status).toBe(200);
    expect(summaryB.body.sales.completedCount).toBe(1);
    expect(summaryB.body.sales.net).toBe("999.99");
    expect(summaryB.body.whatsapp.total).toBe(0);
    expect(summaryB.body.clients).toEqual({ newClients: 1, newPets: 1 });
    expect(summaryB.body.stock.outOfStockCount).toBe(1);
    expect(summaryB.body.stock.lowStockCount).toBe(0);
    expect(summaryB.body.cash.entriesInCash).toBe("0.00");
  });

  it("membro comum pode ler o dashboard", async () => {
    const response = await get("/api/reports/summary", memberACookie);
    expect(response.status).toBe(200);
    expect(response.body.sales.completedCount).toBeGreaterThanOrEqual(5);
  });
});

describe("GET /api/reports/sales", () => {
  it("totais separam concluídas e canceladas respeitando forma de pagamento", async () => {
    const response = await get(
      `/api/reports/sales?from=${today}&to=${today}&paymentMethod=CASH`,
      adminACookie,
    );
    expect(response.status).toBe(200);
    expect(response.body.totals.completed).toEqual({
      count: 1,
      gross: "100.00",
      discounts: "10.00",
      net: "90.00",
    });
    expect(response.body.totals.cancelled).toEqual({ count: 1, total: "80.00" });
    expect(response.body.total).toBe(2);
  });

  it("filtro de status afeta apenas a lista, não os totais", async () => {
    const response = await get(
      `/api/reports/sales?from=${today}&to=${today}&status=CANCELLED`,
      adminACookie,
    );
    expect(response.body.totals.completed.count).toBe(3);
    expect(response.body.totals.completed.net).toBe("170.00");
    expect(response.body.total).toBe(1);
    expect(response.body.items[0].receiptCode).toBe("PF-REPA03");
  });

  it("pagina a lista de vendas", async () => {
    const response = await get(
      `/api/reports/sales?from=${today}&to=${today}&page=2&pageSize=3`,
      adminACookie,
    );
    expect(response.body.total).toBe(4);
    expect(response.body.page).toBe(2);
    expect(response.body.pageSize).toBe(3);
    expect(response.body.items).toHaveLength(1);
  });

  it("consistência: totais do relatório batem com o resumo do dashboard", async () => {
    const [summary, sales] = await Promise.all([
      get(`/api/reports/summary?from=${today}&to=${today}`, adminACookie),
      get(`/api/reports/sales?from=${today}&to=${today}`, adminACookie),
    ]);
    expect(sales.body.totals.completed.count).toBe(
      summary.body.sales.completedCount,
    );
    expect(sales.body.totals.completed.net).toBe(summary.body.sales.net);
    expect(sales.body.totals.cancelled.total).toBe(
      summary.body.sales.cancelledTotal,
    );
  });

  it("isolamento: venda de outra empresa não aparece na lista", async () => {
    const response = await get(
      `/api/reports/sales?from=${today}&to=${today}`,
      adminACookie,
    );
    const codes = (response.body.items as Array<{ receiptCode: string }>).map(
      (item) => item.receiptCode,
    );
    expect(codes).toHaveLength(4);
    expect(codes).not.toContain("PF-REPB01");
  });

  it("exporta CSV com cabeçalho, attachment e proteção contra CSV injection", async () => {
    const response = await get(
      `/api/reports/sales?from=${today}&to=${today}&format=csv`,
      adminACookie,
    );
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.headers["content-disposition"]).toContain(
      `petflow_vendas_${today}_${today}.csv`,
    );
    const text = response.text as string;
    expect(text).toContain('"Código"');
    expect(text).toContain("PF-REPA01");
    // nome começando com "=" é neutralizado com apóstrofo
    expect(text).toContain("\"'=HACK Client\"");
    expect(text).not.toMatch(/,"=HACK/);
  });

  it("CSV ignora paginação e exporta até o limite de linhas", async () => {
    const response = await get(
      `/api/reports/sales?from=${today}&to=${today}&page=1&pageSize=1&format=csv`,
      adminACookie,
    );
    const lines = (response.text as string).trim().split("\r\n");
    expect(lines).toHaveLength(5); // cabeçalho + 4 vendas
  });

  it("CSV exige sessão", async () => {
    const response = await request(app.getHttpServer()).get(
      "/api/reports/sales?format=csv",
    );
    expect(response.status).toBe(401);
  });
});

describe("GET /api/reports/stock/alerts", () => {
  it("lista produtos sem estoque e com estoque baixo, excluindo inativos", async () => {
    const response = await get("/api/reports/stock/alerts", adminACookie);
    expect(response.status).toBe(200);
    expect(response.body.alerts.total).toBe(2);
    expect(response.body.alerts.outOfStockCount).toBe(1);
    expect(response.body.alerts.lowStockCount).toBe(1);
    const names = (response.body.items as Array<{ name: string }>).map(
      (item) => item.name,
    );
    expect(names).toContain("Relatorios Prod Out");
    expect(names).toContain("Relatorios Prod Low");
    expect(names).not.toContain("Relatorios Prod Inactive Zero");
    expect(names).not.toContain("Relatorios B Out");
  });

  it("pagina alertas", async () => {
    const response = await get(
      "/api/reports/stock/alerts?page=1&pageSize=1",
      adminACookie,
    );
    expect(response.body.total).toBe(2);
    expect(response.body.items).toHaveLength(1);
  });

  it("exporta CSV de alertas", async () => {
    const response = await get("/api/reports/stock/alerts?format=csv", adminACookie);
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.text).toContain("Sem estoque");
  });
});

describe("GET /api/reports/stock/movements", () => {
  it("agrega movimentações por tipo no período", async () => {
    const response = await get(
      `/api/reports/stock/movements?from=${today}&to=${today}`,
      adminACookie,
    );
    expect(response.status).toBe(200);
    expect(response.body.totals.count).toBe(3);
    const byType = Object.fromEntries(
      (response.body.totals.byType as Array<{
        type: string;
        count: number;
        quantity: string;
      }>).map((row) => [row.type, row]),
    );
    expect(byType.IN).toMatchObject({ count: 1, quantity: "5.000" });
    expect(byType.OUT).toMatchObject({ count: 1, quantity: "2.000" });
    expect(byType.ADJUST_NEGATIVE).toMatchObject({ count: 1, quantity: "1.000" });
    expect(byType.ADJUST_POSITIVE).toMatchObject({ count: 0, quantity: "0.000" });
  });

  it("filtra por tipo e período com limites inclusivos", async () => {
    const todayIn = await get(
      `/api/reports/stock/movements?from=${today}&to=${today}&type=IN`,
      adminACookie,
    );
    expect(todayIn.body.total).toBe(1);
    const yesterdayOnly = await get(
      `/api/reports/stock/movements?from=${yesterday}&to=${yesterday}`,
      adminACookie,
    );
    expect(yesterdayOnly.body.total).toBe(1);
    expect(yesterdayOnly.body.items[0].type).toBe("IN");
  });

  it("isolamento: movimentações de outra empresa não entram", async () => {
    const response = await get(
      `/api/reports/stock/movements?from=${today}&to=${today}`,
      adminBCookie,
    );
    expect(response.body.totals.count).toBe(1);
    expect(response.body.items[0].product.name).toBe("Relatorios B Out");
  });

  it("exporta CSV de movimentações", async () => {
    const response = await get(
      `/api/reports/stock/movements?from=${today}&to=${today}&format=csv`,
      adminACookie,
    );
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.text).toContain("Relatorios Prod Ok");
  });
});

describe("GET /api/reports/cash", () => {
  it("separa dinheiro físico de todas as movimentações e estornos", async () => {
    const response = await get(
      `/api/reports/cash?from=${today}&to=${today}`,
      adminACookie,
    );
    expect(response.status).toBe(200);
    expect(response.body.movements.inCash).toEqual({
      entries: "200.00",
      exits: "70.00",
      net: "130.00",
    });
    expect(response.body.movements.all).toEqual({
      entries: "200.00",
      exits: "100.00",
    });
    expect(response.body.movements.reversals).toEqual({ count: 1, total: "20.00" });
    const origins = (
      response.body.movements.byOrigin as Array<{ origin: string; type: string }>
    ).map((row) => `${row.origin}:${row.type}`);
    expect(origins).toContain("MANUAL:IN");
    expect(origins).toContain("MANUAL:OUT");
    expect(origins).toContain("REVERSAL:OUT");
  });

  it("resume sessões fechadas no período com diferenças", async () => {
    const response = await get(
      `/api/reports/cash?from=${today}&to=${today}`,
      adminACookie,
    );
    const sessions = response.body.sessions;
    expect(sessions.openedCount).toBe(1);
    expect(sessions.closedCount).toBe(1);
    expect(sessions.closedWithDifferenceCount).toBe(1);
    expect(sessions.totalDifference).toBe("-1.50");
    expect(sessions.items[0].countedAmount).toBe("48.50");
    expect(sessions.items[0].expectedAmount).toBe("50.00");
  });

  it("isolamento: caixa da empresa B não recebe lançamentos de A", async () => {
    const response = await get(
      `/api/reports/cash?from=${today}&to=${today}`,
      adminBCookie,
    );
    expect(response.body.movements.inCash.entries).toBe("0.00");
    expect(response.body.movements.all.exits).toBe("0.00");
    expect(response.body.movements.reversals.count).toBe(0);
    expect(response.body.sessions.closedCount).toBe(0);
    expect(response.body.sessions.openedCount).toBe(1);
    expect(response.body.cash ?? undefined).toBeUndefined();
  });
});

describe("GET /api/reports/clients", () => {
  it("conta novos clientes e pets por período com espécies", async () => {
    const response = await get(
      `/api/reports/clients?from=${today}&to=${today}`,
      adminACookie,
    );
    expect(response.status).toBe(200);
    expect(response.body.newClients).toBe(2);
    expect(response.body.newPets).toBe(3);
    const bySpecies = Object.fromEntries(
      (response.body.petsBySpecies as Array<{ species: string; count: number }>).map(
        (row) => [row.species, row.count],
      ),
    );
    expect(bySpecies.DOG).toBe(2);
    expect(bySpecies.CAT).toBe(1);
    expect(response.body.servicesRealized.available).toBe(false);
  });

  it("isolamento: contagens de outra empresa separadas", async () => {
    const response = await get(
      `/api/reports/clients?from=${today}&to=${today}`,
      adminBCookie,
    );
    expect(response.body.newClients).toBe(1);
    expect(response.body.newPets).toBe(1);
  });
});

describe("GET /api/reports/whatsapp", () => {
  it("conta mensagens por status e falhas por motivo", async () => {
    const response = await get(
      `/api/reports/whatsapp?from=${today}&to=${today}`,
      adminACookie,
    );
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(4);
    expect(response.body.states).toEqual({
      pending: 1,
      accepted: 1,
      sent: 0,
      delivered: 1,
      read: 0,
      failed: 1,
      cancelled: 0,
    });
    expect(response.body.failed).toEqual({
      count: 1,
      byReason: [{ reason: "Recipient not in allowlist", count: 1 }],
    });
    const byStatus = Object.fromEntries(
      (response.body.byStatus as Array<{ status: string; count: number }>).map(
        (row) => [row.status, row.count],
      ),
    );
    expect(byStatus.DELIVERED).toBe(1);
    expect(byStatus.ACCEPTED).toBe(1);
    expect(byStatus.FAILED).toBe(1);
    expect(byStatus.PENDING).toBe(1);
  });

  it("filtra por período (ontem fora da janela de hoje)", async () => {
    const response = await get(
      `/api/reports/whatsapp?from=${today}&to=${today}`,
      adminACookie,
    );
    const delivered = (
      response.body.byStatus as Array<{ status: string; count: number }>
    ).find((row) => row.status === "DELIVERED");
    expect(delivered?.count).toBe(1);
    const yesterdayResponse = await get(
      `/api/reports/whatsapp?from=${yesterday}&to=${yesterday}`,
      adminACookie,
    );
    expect(yesterdayResponse.body.total).toBe(1);
    expect(yesterdayResponse.body.states.delivered).toBe(1);
  });

  it("isolamento: mensagens de outra empresa não contam", async () => {
    const response = await get(
      `/api/reports/whatsapp?from=${today}&to=${today}`,
      adminBCookie,
    );
    expect(response.body.total).toBe(0);
    expect(response.body.failed.count).toBe(0);
  });
});

describe("Permissões e segurança dos relatórios", () => {
  const endpoints = [
    "/api/reports/summary",
    `/api/reports/sales?from=${today}&to=${today}`,
    "/api/reports/stock/alerts",
    `/api/reports/stock/movements?from=${today}&to=${today}`,
    `/api/reports/cash?from=${today}&to=${today}`,
    `/api/reports/clients?from=${today}&to=${today}`,
    `/api/reports/whatsapp?from=${today}&to=${today}`,
    `/api/reports/sales?from=${today}&to=${today}&format=csv`,
  ];

  it("todos os endpoints exigem sessão", async () => {
    for (const endpoint of endpoints) {
      const response = await request(app.getHttpServer()).get(endpoint);
      expect(response.status, endpoint).toBe(401);
    }
  });

  it("membro pode ler todos os relatórios", async () => {
    for (const endpoint of endpoints) {
      const response = await get(endpoint, memberACookie);
      expect(response.status, endpoint).toBe(200);
    }
  });
});
