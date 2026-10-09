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

let companyAId: string;
let productId: string;
let cashSessionId: string;
let entryMovementId: string;
let saleCashId: string;
let salePixId: string;

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

async function getStock(): Promise<string> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  return product?.stockQuantity.toFixed(3) ?? "";
}

async function currentSession(cookie: string) {
  const response = await request(app.getHttpServer())
    .get("/api/cash/sessions/current")
    .set("Cookie", cookie);
  return response;
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;

  await resetDatabase(prisma);

  const companyA = await createCompany("caixa-a");
  const companyB = await createCompany("caixa-b");
  companyAId = companyA.id;

  await createUser({ companyId: companyA.id, name: "Admin Caixa", email: "admin@caixa-a.test", role: "ADMIN" });
  await createUser({ companyId: companyA.id, name: "Membro Caixa", email: "membro@caixa-a.test" });
  await createUser({ companyId: companyB.id, name: "Admin B Caixa", email: "admin@caixa-b.test", role: "ADMIN" });

  const product = await prisma.product.create({
    data: {
      companyId: companyA.id,
      name: "Ração Caixa 10kg",
      sku: "RAC-CX",
      salePrice: "50.00",
      stockQuantity: 10,
    },
  });
  productId = product.id;

  adminACookie = await login("admin@caixa-a.test");
  memberACookie = await login("membro@caixa-a.test");
  adminBCookie = await login("admin@caixa-b.test");
});

afterAll(async () => {
  await app.close();
});

describe("Abertura do caixa", () => {
  it("admin abre a sessão com valor inicial de troco", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/cash/sessions")
      .set("Cookie", adminACookie)
      .send({ initialAmount: "200.00", notes: "Início do turno" });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("OPEN");
    expect(response.body.initialAmount).toBe("200.00");
    expect(response.body.openedBy.name).toBe("Admin Caixa");
    expect(response.body.openedAt).toBeTruthy();
    cashSessionId = response.body.id;
  });

  it("impede segunda sessão simultânea (409)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/cash/sessions")
      .set("Cookie", adminACookie)
      .send({ initialAmount: "50.00" });

    expect(response.status).toBe(409);
  });

  it("membro comum não pode abrir caixa (403)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/cash/sessions")
      .set("Cookie", memberACookie)
      .send({ initialAmount: "10.00" });

    expect(response.status).toBe(403);
  });

  it("consulta a sessão aberta com saldo esperado inicial", async () => {
    const response = await currentSession(adminACookie);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(cashSessionId);
    expect(response.body.status).toBe("OPEN");
    expect(response.body.expectedBalance).toBe("200.00");
    expect(response.body.entriesTotal).toBe("0.00");
    expect(response.body.exitsTotal).toBe("0.00");
  });
});

describe("Movimentações manuais", () => {
  it("registra entrada manual de dinheiro", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/cash/movements")
      .set("Cookie", adminACookie)
      .send({ type: "IN", amount: "50.00", description: "Recebimento avulso" });

    expect(response.status).toBe(201);
    expect(response.body.origin).toBe("MANUAL");
    expect(response.body.type).toBe("IN");
    expect(response.body.inCash).toBe(true);
    expect(response.body.amount).toBe("50.00");
    expect(response.body.createdBy.name).toBe("Admin Caixa");
    entryMovementId = response.body.id;
  });

  it("registra saída manual com justificativa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/cash/movements")
      .set("Cookie", adminACookie)
      .send({
        type: "OUT",
        amount: "30.00",
        description: "Pagamento de entrega",
        justification: "Frete de mercadoria recebida",
      });

    expect(response.status).toBe(201);
    expect(response.body.type).toBe("OUT");
    expect(response.body.justification).toBe("Frete de mercadoria recebida");
  });

  it("saída sem justificativa é rejeitada", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/cash/movements")
      .set("Cookie", adminACookie)
      .send({ type: "OUT", amount: "10.00", description: "Sem motivo" });

    expect(response.status).toBe(400);
    expect(
      response.body.issues?.some((issue: { path: string }) => issue.path === "justification"),
    ).toBe(true);
  });

  it("valor zero é rejeitado", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/cash/movements")
      .set("Cookie", adminACookie)
      .send({ type: "IN", amount: "0.00", description: "Zero" });

    expect(response.status).toBe(400);
  });

  it("valor negativo é rejeitado", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/cash/movements")
      .set("Cookie", adminACookie)
      .send({ type: "IN", amount: "-10.00", description: "Negativo" });

    expect(response.status).toBe(400);
  });

  it("membro comum não pode movimentar o caixa (403)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/cash/movements")
      .set("Cookie", memberACookie)
      .send({ type: "IN", amount: "10.00", description: "Tentativa de membro" });

    expect(response.status).toBe(403);
  });
});

describe("Integração com vendas", () => {
  it("venda em dinheiro gera lançamento que compõe o caixa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", memberACookie)
      .send({
        items: [{ productId, quantity: "2" }],
        discount: "0",
        paymentMethod: "CASH",
        clientRequestId: "cash-req-0001",
      });

    expect(response.status).toBe(201);
    expect(response.body.total).toBe("100.00");
    saleCashId = response.body.id;

    const movement = await prisma.cashMovement.findUnique({
      where: { origin_saleId: { origin: "SALE", saleId: saleCashId } },
    });
    expect(movement).not.toBeNull();
    expect(movement?.type).toBe("IN");
    expect(movement?.inCash).toBe(true);
    expect(movement?.amount.toFixed(2)).toBe("100.00");
    expect(movement?.cashSessionId).toBe(cashSessionId);

    const current = await currentSession(adminACookie);
    expect(current.body.salesTotal).toBe("100.00");
    // 200 (inicial) + 50 (entrada) - 30 (saída) + 100 (venda em dinheiro).
    expect(current.body.expectedBalance).toBe("320.00");
  });

  it("venda no Pix gera lançamento fora do saldo do caixa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", memberACookie)
      .send({
        items: [{ productId, quantity: "1" }],
        discount: "0",
        paymentMethod: "PIX",
        clientRequestId: "cash-req-0002",
      });

    expect(response.status).toBe(201);
    expect(response.body.total).toBe("50.00");
    salePixId = response.body.id;

    const movement = await prisma.cashMovement.findUnique({
      where: { origin_saleId: { origin: "SALE", saleId: salePixId } },
    });
    expect(movement?.inCash).toBe(false);

    const current = await currentSession(adminACookie);
    expect(current.body.salesTotal).toBe("150.00");
    // Pix não altera o saldo físico do caixa.
    expect(current.body.expectedBalance).toBe("320.00");
  });

  it("cancelamento gera reversão financeira única", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/sales/${salePixId}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "Cliente desistiu no Pix" });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("CANCELLED");

    const cancelments = await prisma.cashMovement.count({
      where: { origin: "SALE_CANCELMENT", saleId: salePixId },
    });
    expect(cancelments).toBe(1);

    const movement = await prisma.cashMovement.findFirst({
      where: { origin: "SALE_CANCELMENT", saleId: salePixId },
    });
    expect(movement?.type).toBe("OUT");
    expect(movement?.inCash).toBe(false);
    expect(movement?.amount.toFixed(2)).toBe("50.00");

    // Recancelamento continua bloqueado e não duplica lançamento.
    const again = await request(app.getHttpServer())
      .post(`/api/sales/${salePixId}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "Tenta cancelar de novo" });
    expect(again.status).toBe(409);

    const countAfter = await prisma.cashMovement.count({
      where: { origin: "SALE_CANCELMENT", saleId: salePixId },
    });
    expect(countAfter).toBe(1);
  });
});

describe("Estorno auditável", () => {
  it("membro comum não pode estornar (403)", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/cash/movements/${entryMovementId}/reversal`)
      .set("Cookie", memberACookie)
      .send({ reason: "Sem permissão para estorno" });

    expect(response.status).toBe(403);
  });

  it("motivo curto é rejeitado", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/cash/movements/${entryMovementId}/reversal`)
      .set("Cookie", adminACookie)
      .send({ reason: "ok" });

    expect(response.status).toBe(400);
  });

  it("estorno cria lançamento compensatório e marca o original", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/cash/movements/${entryMovementId}/reversal`)
      .set("Cookie", adminACookie)
      .send({ reason: "Lançamento registrado por engano" });

    expect(response.status).toBe(201);
    expect(response.body.origin).toBe("REVERSAL");
    expect(response.body.type).toBe("OUT");
    expect(response.body.amount).toBe("50.00");
    expect(response.body.reversalOf.id).toBe(entryMovementId);
    expect(response.body.justification).toBe("Lançamento registrado por engano");

    const original = await prisma.cashMovement.findUnique({ where: { id: entryMovementId } });
    expect(original?.reversedAt).not.toBeNull();
    expect(original?.reversalReason).toBe("Lançamento registrado por engano");
  });

  it("segundo estorno do mesmo lançamento retorna 409", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/cash/movements/${entryMovementId}/reversal`)
      .set("Cookie", adminACookie)
      .send({ reason: "Tenta estornar de novo" });

    expect(response.status).toBe(409);
  });

  it("lançamento de venda não pode ser estornado (400)", async () => {
    const saleMovement = await prisma.cashMovement.findUnique({
      where: { origin_saleId: { origin: "SALE", saleId: saleCashId } },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/cash/movements/${saleMovement?.id}/reversal`)
      .set("Cookie", adminACookie)
      .send({ reason: "Tenta estornar venda" });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("cancelamento da venda");
  });
});

describe("Resumo financeiro", () => {
  it("calcula totais por período no servidor", async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const response = await request(app.getHttpServer())
      .get("/api/cash/summary")
      .query({ from: hoje, to: hoje })
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(response.body.salesTotal).toBe("150.00");
    expect(response.body.manualEntriesTotal).toBe("50.00");
    expect(response.body.manualExitsTotal).toBe("30.00");
    expect(response.body.cancelmentsTotal).toBe("50.00");
    expect(response.body.reversalsInTotal).toBe("0.00");
    expect(response.body.reversalsOutTotal).toBe("50.00");
    expect(response.body.reversalsNetTotal).toBe("-50.00");
    expect(response.body.totalIn).toBe("200.00");
    expect(response.body.totalOut).toBe("130.00");
    expect(response.body.net).toBe("70.00");
  });

  it("filtro por sessão funciona", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/cash/summary")
      .query({ sessionId: cashSessionId })
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(response.body.net).toBe("70.00");
  });

  it("período sem dados retorna zeros", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/cash/summary")
      .query({ from: "2020-01-01", to: "2020-01-31" })
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(response.body.totalIn).toBe("0.00");
    expect(response.body.totalOut).toBe("0.00");
    expect(response.body.net).toBe("0.00");
  });

  it("membro pode consultar o resumo", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/cash/summary")
      .set("Cookie", memberACookie);

    expect(response.status).toBe(200);
    expect(response.body.salesTotal).toBe("150.00");
  });
});

describe("Fechamento do caixa", () => {
  it("calcula saldo esperado e diferença de forma server-side", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/cash/sessions/${cashSessionId}/close`)
      .set("Cookie", adminACookie)
      .send({ countedAmount: "265.50", notes: "Contagem do fim do turno" });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("CLOSED");
    // 200 (inicial) + 50 (entrada) - 30 (saída) + 100 (venda dinheiro)
    // - 50 (estorno) = 270; contado 265,50 → diferença -4,50.
    expect(response.body.expectedBalance).toBe("270.00");
    expect(response.body.countedAmount).toBe("265.50");
    expect(response.body.differenceBalance).toBe("-4.50");
    expect(response.body.closedBy.name).toBe("Admin Caixa");
    expect(response.body.closedAt).toBeTruthy();
    // Entradas/saídas do caixa consideram apenas dinheiro físico (inCash):
    // entrada manual 50 + venda em dinheiro 100 = 150; saída manual 30 +
    // estorno 50 = 80 (cancelamento foi no Pix, fora do saldo).
    expect(response.body.entriesTotal).toBe("150.00");
    expect(response.body.exitsTotal).toBe("80.00");
    expect(response.body.salesTotal).toBe("150.00");
    expect(response.body.cancelmentsTotal).toBe("50.00");
  });

  it("fechamento duplicado retorna 409", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/cash/sessions/${cashSessionId}/close`)
      .set("Cookie", adminACookie)
      .send({ countedAmount: "100.00" });

    expect(response.status).toBe(409);
  });

  it("venda com caixa fechado é rejeitada (409)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", memberACookie)
      .send({
        items: [{ productId, quantity: "1" }],
        paymentMethod: "CASH",
        clientRequestId: "cash-req-0003",
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain("Caixa fechado");
    // Venda de 2 unidades (dinheiro) + 1 unidade (Pix, cancelada e devolvida).
    expect(await getStock()).toBe("8.000");
  });

  it("movimentação manual com caixa fechado é rejeitada (409)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/cash/movements")
      .set("Cookie", adminACookie)
      .send({ type: "IN", amount: "10.00", description: "Depois do fechamento" });

    expect(response.status).toBe(409);
  });

  it("estorno com sessão fechada é rejeitado (409)", async () => {
    const movement = await prisma.cashMovement.findFirst({
      where: { companyId: companyAId, origin: "MANUAL", type: "OUT" },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/cash/movements/${movement?.id}/reversal`)
      .set("Cookie", adminACookie)
      .send({ reason: "Tenta estornar com caixa fechado" });

    expect(response.status).toBe(409);
  });

  it("situação atual volta a ser inexistente (404)", async () => {
    const response = await currentSession(adminACookie);
    expect(response.status).toBe(404);
    expect(response.body.message).toContain("Nenhuma sessão de caixa aberta");
  });

  it("aberturas simultâneas após o fechamento criam exatamente uma sessão", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }).map(() =>
        request(app.getHttpServer())
          .post("/api/cash/sessions")
          .set("Cookie", adminACookie)
          .send({ initialAmount: "0.00" }),
      ),
    );

    const created = results.filter((result) => result.status === 201);
    const conflicts = results.filter((result) => result.status === 409);

    expect(created.length).toBe(1);
    expect(conflicts.length).toBe(3);

    const sessions = await prisma.cashSession.count({ where: { companyId: companyAId } });
    expect(sessions).toBe(2);
  });
});

describe("Isolamento multiempresa e permissões", () => {
  it("empresa B não enxerga sessão aberta da empresa A (404)", async () => {
    const response = await currentSession(adminBCookie);
    expect(response.status).toBe(404);
  });

  it("histórico de sessões é isolado", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/cash/sessions")
      .set("Cookie", adminBCookie);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(0);
  });

  it("resumo de sessão de outra empresa retorna 404", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/cash/sessions/${cashSessionId}/summary`)
      .set("Cookie", adminBCookie);

    expect(response.status).toBe(404);
  });

  it("fechar sessão de outra empresa retorna 404", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/cash/sessions/${cashSessionId}/close`)
      .set("Cookie", adminBCookie)
      .send({ countedAmount: "0.00" });

    expect(response.status).toBe(404);
  });

  it("movimentações de outra empresa não vazam", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/cash/movements")
      .set("Cookie", adminBCookie);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(0);
  });

  it("resumo da empresa B é zero", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/cash/summary")
      .set("Cookie", adminBCookie);

    expect(response.status).toBe(200);
    expect(response.body.net).toBe("0.00");
  });

  it("estornar lançamento de outra empresa retorna 404", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/cash/movements/${entryMovementId}/reversal`)
      .set("Cookie", adminBCookie)
      .send({ reason: "Ataque de outra empresa" });

    expect(response.status).toBe(404);
  });

  it("exige autenticação nas rotas de caixa", async () => {
    const response = await request(app.getHttpServer()).get("/api/cash/sessions/current");
    expect(response.status).toBe(401);
  });
});
