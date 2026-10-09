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
let productP1: string;
let productP2: string;
let productInactive: string;
let productCompanyB: string;
let productConcurrent: string;

let saleOneId: string;
let saleOneReceipt: string;
let saleTwoId: string;
let saleTwoReceipt: string;

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

async function getStock(productId: string): Promise<string> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  return product?.stockQuantity.toFixed(3) ?? "";
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;

  await resetDatabase(prisma);

  const companyA = await createCompany("vendas-a");
  const companyB = await createCompany("vendas-b");
  companyAId = companyA.id;

  await createUser({ companyId: companyA.id, name: "Admin A", email: "admin@vendas-a.test", role: "ADMIN" });
  await createUser({ companyId: companyA.id, name: "Membro A", email: "membro@vendas-a.test" });
  await createUser({ companyId: companyB.id, name: "Admin B", email: "admin@vendas-b.test", role: "ADMIN" });

  const p1 = await prisma.product.create({
    data: {
      companyId: companyA.id,
      name: "Ração Premium 15kg",
      sku: "RAC-15",
      salePrice: "120.50",
      stockQuantity: 10,
    },
  });
  productP1 = p1.id;

  const p2 = await prisma.product.create({
    data: {
      companyId: companyA.id,
      name: "Brinquedo Bola",
      sku: "BOL-001",
      salePrice: "15.90",
      stockQuantity: 20,
    },
  });
  productP2 = p2.id;

  const inactive = await prisma.product.create({
    data: {
      companyId: companyA.id,
      name: "Petisco Descontinuado",
      sku: "PET-XXX",
      salePrice: "5.00",
      stockQuantity: 5,
      status: "INACTIVE",
    },
  });
  productInactive = inactive.id;

  const fromB = await prisma.product.create({
    data: {
      companyId: companyB.id,
      name: "Produto Empresa B",
      sku: "B-001",
      salePrice: "99.99",
      stockQuantity: 7,
    },
  });
  productCompanyB = fromB.id;

  const concurrent = await prisma.product.create({
    data: {
      companyId: companyA.id,
      name: "Produto Concorrência Vendas",
      sku: "CONC-VENDA",
      salePrice: "10.00",
      stockQuantity: 5,
    },
  });
  productConcurrent = concurrent.id;

  adminACookie = await login("admin@vendas-a.test");
  memberACookie = await login("membro@vendas-a.test");
  adminBCookie = await login("admin@vendas-b.test");

  // Vendas exigem caixa aberto desde a Etapa 4.
  const openCash = await request(app.getHttpServer())
    .post("/api/cash/sessions")
    .set("Cookie", adminACookie)
    .send({ initialAmount: "100.00" });
  if (openCash.status !== 201) {
    throw new Error(`Abertura de caixa falhou: ${openCash.status}`);
  }
});

afterAll(async () => {
  await app.close();
});

describe("Criação de vendas", () => {
  it("venda válida com um produto baixa estoque e registra movimento", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", memberACookie)
      .send({
        items: [{ productId: productP1, quantity: "2" }],
        discount: "0",
        paymentMethod: "CASH",
        clientRequestId: "req-venda-0001",
      });

    expect(response.status).toBe(201);
    expect(response.body.receiptCode).toMatch(/^PF-/);
    expect(response.body.subtotal).toBe("241.00");
    expect(response.body.discount).toBe("0.00");
    expect(response.body.total).toBe("241.00");
    expect(response.body.status).toBe("COMPLETED");
    expect(response.body.paymentMethod).toBe("CASH");
    expect(response.body.createdBy.name).toBe("Membro A");
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].productName).toBe("Ração Premium 15kg");
    expect(response.body.items[0].unitPrice).toBe("120.50");
    expect(response.body.items[0].quantity).toBe("2.000");

    expect(await getStock(productP1)).toBe("8.000");

    const movements = await prisma.stockMovement.count({
      where: { productId: productP1, type: "OUT", reference: response.body.receiptCode },
    });
    expect(movements).toBe(1);

    saleOneId = response.body.id;
    saleOneReceipt = response.body.receiptCode;
  });

  it("venda com vários produtos e desconto calcula totais no servidor", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", memberACookie)
      .send({
        items: [
          { productId: productP1, quantity: "1" },
          { productId: productP2, quantity: "3" },
        ],
        discount: "8.20",
        paymentMethod: "PIX",
        clientRequestId: "req-venda-0002",
      });

    expect(response.status).toBe(201);
    expect(response.body.subtotal).toBe("168.20");
    expect(response.body.discount).toBe("8.20");
    expect(response.body.total).toBe("160.00");
    expect(response.body.items).toHaveLength(2);

    expect(await getStock(productP1)).toBe("7.000");
    expect(await getStock(productP2)).toBe("17.000");

    saleTwoId = response.body.id;
    saleTwoReceipt = response.body.receiptCode;
  });

  it("produto inexistente retorna 404 e não cria venda", async () => {
    const before = await prisma.sale.count({ where: { companyId: companyAId } });

    const response = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", memberACookie)
      .send({
        items: [{ productId: "produto-que-nao-existe", quantity: "1" }],
        paymentMethod: "CASH",
      });

    expect(response.status).toBe(404);
    expect(await prisma.sale.count({ where: { companyId: companyAId } })).toBe(before);
  });

  it("produto inativo é rejeitado", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", memberACookie)
      .send({
        items: [{ productId: productInactive, quantity: "1" }],
        paymentMethod: "CASH",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("inativo");
    expect(await getStock(productInactive)).toBe("5.000");
  });

  it("produto de outra empresa retorna 404 e não altera o estoque alheio", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", memberACookie)
      .send({
        items: [{ productId: productCompanyB, quantity: "1" }],
        paymentMethod: "CASH",
      });

    expect(response.status).toBe(404);
    expect(await getStock(productCompanyB)).toBe("7.000");
  });

  it("quantidade zero é rejeitada", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", memberACookie)
      .send({
        items: [{ productId: productP2, quantity: 0 }],
        paymentMethod: "CASH",
      });

    expect(response.status).toBe(400);
    expect(
      response.body.issues?.some(
        (issue: { path: string }) => issue.path === "items.0.quantity",
      ),
    ).toBe(true);
  });

  it("quantidade negativa é rejeitada", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", memberACookie)
      .send({
        items: [{ productId: productP2, quantity: "-2" }],
        paymentMethod: "CASH",
      });

    expect(response.status).toBe(400);
  });

  it("estoque insuficiente é rejeitado e não altera nada", async () => {
    const stockBefore = await getStock(productP2);
    const salesBefore = await prisma.sale.count({ where: { companyId: companyAId } });

    const response = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", memberACookie)
      .send({
        items: [{ productId: productP2, quantity: "100" }],
        paymentMethod: "CASH",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Estoque insuficiente");
    expect(await getStock(productP2)).toBe(stockBefore);
    expect(await prisma.sale.count({ where: { companyId: companyAId } })).toBe(salesBefore);
  });

  it("desconto negativo é rejeitado", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", memberACookie)
      .send({
        items: [{ productId: productP2, quantity: "1" }],
        discount: "-1.00",
        paymentMethod: "CASH",
      });

    expect(response.status).toBe(400);
  });

  it("desconto maior que o subtotal é rejeitado", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", memberACookie)
      .send({
        items: [{ productId: productP2, quantity: "1" }],
        discount: "99999.99",
        paymentMethod: "CASH",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Desconto");
  });

  it("valores adulterados pelo frontend são ignorados (total vem do banco)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", memberACookie)
      .send({
        items: [{ productId: productP2, quantity: "1", unitPrice: "0.01" }],
        discount: "0",
        paymentMethod: "CASH",
        subtotal: "0.01",
        total: "0.01",
        clientRequestId: "req-adulterado-0001",
      });

    expect(response.status).toBe(201);
    expect(response.body.items[0].unitPrice).toBe("15.90");
    expect(response.body.subtotal).toBe("15.90");
    expect(response.body.total).toBe("15.90");
    expect(await getStock(productP2)).toBe("16.000");
  });

  it("lista de itens vazia é rejeitada", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", memberACookie)
      .send({ items: [], paymentMethod: "CASH" });

    expect(response.status).toBe(400);
  });
});

describe("Prevenção de reenvio (duplo clique)", () => {
  it("mesmo clientRequestId não cria duas vendas", async () => {
    const payload = {
      items: [{ productId: productP2, quantity: "1" }],
      discount: "0",
      paymentMethod: "CARD",
      clientRequestId: "req-duplo-clique-0001",
    };

    const first = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", memberACookie)
      .send(payload);

    expect(first.status).toBe(201);

    const stockAfterFirst = await getStock(productP2);

    const second = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", memberACookie)
      .send(payload);

    expect(second.status).toBe(409);
    expect(await getStock(productP2)).toBe(stockAfterFirst);

    const sales = await prisma.sale.count({
      where: { companyId: companyAId, clientRequestId: "req-duplo-clique-0001" },
    });
    expect(sales).toBe(1);
  });
});

describe("Vendas concorrentes", () => {
  it("vendas concorrentes nunca deixam estoque negativo", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }).map((_, index) =>
        request(app.getHttpServer())
          .post("/api/sales")
          .set("Cookie", memberACookie)
          .send({
            items: [{ productId: productConcurrent, quantity: "3" }],
            paymentMethod: "CASH",
            clientRequestId: `req-concorrente-${index}`,
          }),
      ),
    );

    const approved = results.filter((result) => result.status === 201);
    const rejected = results.filter((result) => result.status === 400);

    expect(approved.length).toBe(1);
    expect(rejected.length).toBe(4);
    expect(await getStock(productConcurrent)).toBe("2.000");

    const movements = await prisma.stockMovement.count({
      where: { productId: productConcurrent, type: "OUT" },
    });
    expect(movements).toBe(1);

    const sales = await prisma.sale.count({
      where: { companyId: companyAId, items: { some: { productId: productConcurrent } } },
    });
    expect(sales).toBe(1);
  });
});

describe("Histórico, snapshots e filtros", () => {
  it("detalhe preserva snapshot mesmo após renomear o produto", async () => {
    await prisma.product.update({
      where: { id: productP1 },
      data: { name: "Ração Premium 15kg EDITADA" },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/sales/${saleOneId}`)
      .set("Cookie", memberACookie);

    expect(response.status).toBe(200);
    expect(response.body.items[0].productName).toBe("Ração Premium 15kg");
    expect(response.body.items[0].productSku).toBe("RAC-15");
    expect(response.body.items[0].unitPrice).toBe("120.50");

    await prisma.product.update({
      where: { id: productP1 },
      data: { name: "Ração Premium 15kg" },
    });
  });

  it("histórico lista vendas paginadas da empresa", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/sales")
      .query({ page: 1, pageSize: 5 })
      .set("Cookie", memberACookie);

    expect(response.status).toBe(200);
    expect(response.body.total).toBeGreaterThanOrEqual(5);
    expect(response.body.items.length).toBeLessThanOrEqual(5);
    expect(response.body.page).toBe(1);
    expect(response.body.items[0]).toHaveProperty("receiptCode");
    expect(response.body.items[0]).toHaveProperty("total");
  });

  it("filtro por status retorna apenas vendas concluídas", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/sales")
      .query({ status: "COMPLETED" })
      .set("Cookie", memberACookie);

    expect(response.status).toBe(200);
    expect(
      response.body.items.every((item: { status: string }) => item.status === "COMPLETED"),
    ).toBe(true);
  });

  it("busca por receiptCode encontra a venda", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/sales")
      .query({ search: saleOneReceipt })
      .set("Cookie", memberACookie);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0].id).toBe(saleOneId);
  });

  it("filtro de período funciona", async () => {
    const ontem = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const hoje = new Date().toISOString().slice(0, 10);

    const passado = await request(app.getHttpServer())
      .get("/api/sales")
      .query({ from: "2020-01-01", to: ontem })
      .set("Cookie", memberACookie);
    expect(passado.status).toBe(200);
    expect(passado.body.total).toBe(0);

    const atual = await request(app.getHttpServer())
      .get("/api/sales")
      .query({ from: hoje })
      .set("Cookie", memberACookie);
    expect(atual.status).toBe(200);
    expect(atual.body.total).toBeGreaterThanOrEqual(5);
  });

  it("empresa B não vê vendas da empresa A", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/sales")
      .set("Cookie", adminBCookie);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(0);
  });
});

describe("Cancelamento de vendas", () => {
  it("exige autenticação", async () => {
    const response = await request(app.getHttpServer()).get("/api/sales");
    expect(response.status).toBe(401);
  });

  it("membro comum não pode cancelar", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/sales/${saleTwoId}/cancel`)
      .set("Cookie", memberACookie)
      .send({ reason: "Tentativa sem permissão" });

    expect(response.status).toBe(403);
  });

  it("cancelamento sem motivo é rejeitado", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/sales/${saleTwoId}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "ok" });

    expect(response.status).toBe(400);
    expect(
      response.body.issues?.some((issue: { path: string }) => issue.path === "reason"),
    ).toBe(true);
  });

  it("admin cancela venda com motivo e devolve estoque uma única vez", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/sales/${saleTwoId}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "Cliente desistiu da compra" });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("CANCELLED");
    expect(response.body.cancelReason).toBe("Cliente desistiu da compra");
    expect(response.body.cancelledBy.name).toBe("Admin A");
    expect(response.body.cancelledAt).toBeTruthy();

    expect(await getStock(productP1)).toBe("8.000");
    expect(await getStock(productP2)).toBe("18.000");

    const compensating = await prisma.stockMovement.count({
      where: { type: "IN", reference: response.body.receiptCode },
    });
    expect(compensating).toBe(2);
  });

  it("segundo cancelamento retorna 409 e não devolve estoque de novo", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/sales/${saleTwoId}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "Tenta cancelar novamente" });

    expect(response.status).toBe(409);
    expect(await getStock(productP1)).toBe("8.000");
    expect(await getStock(productP2)).toBe("18.000");

    const compensating = await prisma.stockMovement.count({
      where: { type: "IN", reference: saleTwoReceipt },
    });
    expect(compensating).toBe(2);
  });

  it("cancelamento é registrado no histórico de movimentos", async () => {
    const movements = await prisma.stockMovement.findMany({
      where: { type: "IN", notes: { contains: "Cancelamento da venda" } },
    });
    expect(movements.length).toBeGreaterThanOrEqual(2);
    expect(movements.every((movement) => movement.notes?.includes("Cliente desistiu"))).toBe(
      true,
    );
  });
});

describe("Isolamento multiempresa", () => {
  it("detalhe de venda de outra empresa retorna 404", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/sales/${saleOneId}`)
      .set("Cookie", adminBCookie);

    expect(response.status).toBe(404);
  });

  it("cancelar venda de outra empresa retorna 404 e não altera nada", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/sales/${saleOneId}/cancel`)
      .set("Cookie", adminBCookie)
      .send({ reason: "Ataque de outra empresa" });

    expect(response.status).toBe(404);

    const sale = await prisma.sale.findUnique({ where: { id: saleOneId } });
    expect(sale?.status).toBe("COMPLETED");
    expect(sale?.cancelReason).toBeNull();
    expect(await getStock(productP1)).toBe("8.000");
  });
});
