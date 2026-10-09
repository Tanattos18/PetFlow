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
let productAId: string;
let productBId: string;
let lowStockProductId: string;

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

  const companyA = await createCompany("estoque-a");
  const companyB = await createCompany("estoque-b");

  await createUser({ companyId: companyA.id, name: "Admin A", email: "admin@estoque-a.test", role: "ADMIN" });
  await createUser({ companyId: companyA.id, name: "Membro A", email: "membro@estoque-a.test" });
  await createUser({ companyId: companyB.id, name: "Admin B", email: "admin@estoque-b.test", role: "ADMIN" });

  const productA = await prisma.product.create({
    data: { companyId: companyA.id, name: "Shampoo 500ml", sku: "SHA-500" },
  });
  productAId = productA.id;

  const lowStock = await prisma.product.create({
    data: {
      companyId: companyA.id,
      name: "Antipulgas",
      sku: "ANT-001",
      stockQuantity: 2,
      minimumStock: 5,
    },
  });
  lowStockProductId = lowStock.id;

  const productB = await prisma.product.create({
    data: { companyId: companyB.id, name: "Produto B", sku: "PROD-B-EST" },
  });
  productBId = productB.id;

  adminACookie = await login("admin@estoque-a.test");
  memberACookie = await login("membro@estoque-a.test");
  adminBCookie = await login("admin@estoque-b.test");
});

afterAll(async () => {
  await app.close();
});

describe("Entradas e saídas de estoque", () => {
  it("entrada aumenta o saldo e registra movimento", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/stock/entries")
      .set("Cookie", memberACookie)
      .send({ productId: productAId, quantity: "10.5", reference: "NF 123" });

    expect(response.status).toBe(201);
    expect(response.body.stockQuantity).toBe("10.500");
    expect(response.body.movement.type).toBe("IN");
    expect(response.body.movement.quantity).toBe("10.500");
    expect(response.body.movement.createdBy.name).toBe("Membro A");
    expect(await getStock(productAId)).toBe("10.500");
  });

  it("saída reduz o saldo", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/stock/exits")
      .set("Cookie", memberACookie)
      .send({ productId: productAId, quantity: "3", notes: "Uso interno" });

    expect(response.status).toBe(201);
    expect(response.body.stockQuantity).toBe("7.500");
    expect(response.body.movement.type).toBe("OUT");
  });

  it("saída superior ao saldo é rejeitada e não altera nada", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/stock/exits")
      .set("Cookie", memberACookie)
      .send({ productId: productAId, quantity: "999" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Estoque insuficiente para esta saída");
    expect(await getStock(productAId)).toBe("7.500");

    const movements = await prisma.stockMovement.count({
      where: { productId: productAId, type: "OUT" },
    });
    expect(movements).toBe(1);
  });

  it("rejeita quantidade zero", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/stock/entries")
      .set("Cookie", memberACookie)
      .send({ productId: productAId, quantity: 0 });

    expect(response.status).toBe(400);
  });

  it("rejeita quantidade negativa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/stock/entries")
      .set("Cookie", memberACookie)
      .send({ productId: productAId, quantity: -5 });

    expect(response.status).toBe(400);
  });

  it("movimentação em produto inativo é rejeitada", async () => {
    await prisma.product.update({
      where: { id: productAId },
      data: { status: "INACTIVE" },
    });

    const response = await request(app.getHttpServer())
      .post("/api/stock/entries")
      .set("Cookie", memberACookie)
      .send({ productId: productAId, quantity: 1 });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Produto inativo não permite movimentações");

    await prisma.product.update({
      where: { id: productAId },
      data: { status: "ACTIVE" },
    });
  });
});

describe("Ajustes de inventário", () => {
  it("ajuste positivo aplica saldo e exige autoria", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/stock/adjustments")
      .set("Cookie", adminACookie)
      .send({
        productId: productAId,
        type: "ADJUST_POSITIVE",
        quantity: "2.25",
        reason: "Recontagem física",
      });

    expect(response.status).toBe(201);
    expect(response.body.stockQuantity).toBe("9.750");
    expect(response.body.movement.type).toBe("ADJUST_POSITIVE");
    expect(response.body.movement.notes).toBe("Recontagem física");
    expect(response.body.movement.createdBy.name).toBe("Admin A");
  });

  it("ajuste negativo reduz saldo mas não pode deixar negativo", async () => {
    const ok = await request(app.getHttpServer())
      .post("/api/stock/adjustments")
      .set("Cookie", adminACookie)
      .send({
        productId: productAId,
        type: "ADJUST_NEGATIVE",
        quantity: "1",
        reason: "Avaria",
      });
    expect(ok.status).toBe(201);
    expect(ok.body.stockQuantity).toBe("8.750");

    const invalid = await request(app.getHttpServer())
      .post("/api/stock/adjustments")
      .set("Cookie", adminACookie)
      .send({
        productId: productAId,
        type: "ADJUST_NEGATIVE",
        quantity: "9999",
        reason: "Demais",
      });
    expect(invalid.status).toBe(400);
  });

  it("ajuste sem justificativa é rejeitado", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/stock/adjustments")
      .set("Cookie", adminACookie)
      .send({ productId: productAId, type: "ADJUST_POSITIVE", quantity: 1 });

    expect(response.status).toBe(400);
    expect(response.body.issues?.some((issue: { path: string }) => issue.path === "reason")).toBe(
      true,
    );
  });

  it("membro comum não pode ajustar", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/stock/adjustments")
      .set("Cookie", memberACookie)
      .send({
        productId: productAId,
        type: "ADJUST_POSITIVE",
        quantity: 1,
        reason: "Sem permissão",
      });

    expect(response.status).toBe(403);
  });
});

describe("Saldo, histórico e alertas", () => {
  it("consulta de saldo reflete o produto", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/stock/balance/${productAId}`)
      .set("Cookie", memberACookie);

    expect(response.status).toBe(200);
    expect(response.body.stockQuantity).toBe("8.750");
    expect(response.body.productId).toBe(productAId);
  });

  it("histórico retorna tipo, quantidade, motivo, autor e data", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/stock/movements")
      .query({ productId: productAId })
      .set("Cookie", memberACookie);

    expect(response.status).toBe(200);
    expect(response.body.total).toBeGreaterThanOrEqual(3);
    const first = response.body.items[0];
    expect(first).toHaveProperty("type");
    expect(first).toHaveProperty("quantity");
    expect(first).toHaveProperty("notes");
    expect(first).toHaveProperty("createdAt");
    expect(first.createdBy).toHaveProperty("name");
    expect(first.product).toHaveProperty("name");
  });

  it("histórico filtra por tipo", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/stock/movements")
      .query({ productId: productAId, type: "IN" })
      .set("Cookie", memberACookie);

    expect(response.status).toBe(200);
    expect(
      response.body.items.every((item: { type: string }) => item.type === "IN"),
    ).toBe(true);
  });

  it("lista alertas de estoque baixo apenas da empresa", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/stock/low-stock")
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    const ids = response.body.map((item: { id: string }) => item.id);
    expect(ids).toContain(lowStockProductId);
    expect(ids).not.toContain(productBId);

    const low = response.body.find((item: { id: string }) => item.id === lowStockProductId);
    expect(low.stockQuantity).toBe("2.000");
    expect(low.minimumStock).toBe("5.000");
  });

  it("filtro lowStock na listagem de produtos funciona", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/products")
      .query({ lowStock: "true" })
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    const ids = response.body.items.map((item: { id: string }) => item.id);
    expect(ids).toContain(lowStockProductId);
  });
});

describe("Isolamento e autorização", () => {
  it("não permite movimentar produto de outra empresa (404)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/stock/entries")
      .set("Cookie", adminACookie)
      .send({ productId: productBId, quantity: 1 });

    expect(response.status).toBe(404);

    const productB = await prisma.product.findUnique({ where: { id: productBId } });
    expect(productB?.stockQuantity.toFixed(3)).toBe("0.000");
  });

  it("não permite consultar saldo de produto de outra empresa (404)", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/stock/balance/${productBId}`)
      .set("Cookie", adminACookie);

    expect(response.status).toBe(404);
  });

  it("histórico não lista movimentos de outra empresa", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/stock/movements")
      .set("Cookie", adminBCookie);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(0);
  });

  it("exige autenticação nas rotas de estoque", async () => {
    const response = await request(app.getHttpServer()).get("/api/stock/movements");
    expect(response.status).toBe(401);
  });
});

describe("Concorrência de movimentações", () => {
  it("saídas concorrentes não deixam saldo negativo nem divergente", async () => {
    const product = await prisma.product.create({
      data: {
        companyId: (await prisma.product.findUniqueOrThrow({ where: { id: productAId } }))
          .companyId,
        name: "Produto concorrência",
        sku: "CONC-001",
        stockQuantity: 5,
        minimumStock: 1,
      },
    });

    const results = await Promise.all(
      Array.from({ length: 5 }).map(() =>
        request(app.getHttpServer())
          .post("/api/stock/exits")
          .set("Cookie", memberACookie)
          .send({ productId: product.id, quantity: "3" }),
      ),
    );

    const approved = results.filter((result) => result.status === 201);
    const rejected = results.filter((result) => result.status === 400);

    expect(approved.length).toBe(1);
    expect(rejected.length).toBe(4);
    expect(await getStock(product.id)).toBe("2.000");

    const movements = await prisma.stockMovement.count({
      where: { productId: product.id, type: "OUT" },
    });
    expect(movements).toBe(1);
  });
});
