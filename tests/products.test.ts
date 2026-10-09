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
let categoryAId: string;
let supplierAId: string;
let supplierBId: string;
let productAId: string;
let productBId: string;

async function createCompany(slug: string) {
  return prisma.company.create({ data: { name: `Empresa ${slug}`, slug } });
}

async function createUser(params: { companyId: string; name: string; email: string; role?: "ADMIN" | "MEMBER" }) {
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

  const companyA = await createCompany("produtos-a");
  const companyB = await createCompany("produtos-b");

  await createUser({ companyId: companyA.id, name: "Admin A", email: "admin@prod-a.test", role: "ADMIN" });
  await createUser({ companyId: companyA.id, name: "Membro A", email: "membro@prod-a.test" });
  await createUser({ companyId: companyB.id, name: "Admin B", email: "admin@prod-b.test", role: "ADMIN" });

  const categoryA = await prisma.category.create({
    data: { companyId: companyA.id, name: "Brinquedos", nameKey: "brinquedos" },
  });
  categoryAId = categoryA.id;
  const supplierA = await prisma.supplier.create({
    data: { companyId: companyA.id, name: "Fornecedor A" },
  });
  supplierAId = supplierA.id;
  const supplierB = await prisma.supplier.create({
    data: { companyId: companyB.id, name: "Fornecedor B" },
  });
  supplierBId = supplierB.id;

  const productB = await prisma.product.create({
    data: { companyId: companyB.id, name: "Produto da Empresa B", sku: "PROD-B-1" },
  });
  productBId = productB.id;

  await prisma.product.createMany({
    data: [
      {
        companyId: companyA.id,
        name: "Ração premium 15kg",
        sku: "RAC-015",
        stockQuantity: 3,
        minimumStock: 5,
      },
      { companyId: companyA.id, name: "Coleira pequena", sku: "COL-P" },
    ],
  });

  adminACookie = await login("admin@prod-a.test");
  memberACookie = await login("membro@prod-a.test");
  adminBCookie = await login("admin@prod-b.test");
});

afterAll(async () => {
  await app.close();
});

describe("POST /api/products — criação", () => {
  it("cria produto com preços, unidades e códigos normalizados", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/products")
      .set("Cookie", adminACookie)
      .send({
        name: "Bola de borracha",
        sku: " bola-001 ",
        barcode: " 7891234567890 ",
        unit: "UNIDADE",
        costPrice: "10.50",
        salePrice: 19.9,
        minimumStock: 5,
        categoryId: categoryAId,
        supplierId: supplierAId,
      });

    expect(response.status).toBe(201);
    expect(response.body.sku).toBe("BOLA-001");
    expect(response.body.barcode).toBe("7891234567890");
    expect(response.body.costPrice).toBe("10.50");
    expect(response.body.salePrice).toBe("19.90");
    expect(response.body.minimumStock).toBe("5.000");
    expect(response.body.stockQuantity).toBe("0.000");
    expect(response.body.lowStock).toBe(true);
    productAId = response.body.id;
  });

  it("rejeita preço negativo", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/products")
      .set("Cookie", adminACookie)
      .send({ name: "Preço negativo", costPrice: -1 });

    expect(response.status).toBe(400);
  });

  it("rejeita estoque mínimo negativo", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/products")
      .set("Cookie", adminACookie)
      .send({ name: "Mínimo negativo", minimumStock: -2 });

    expect(response.status).toBe(400);
  });

  it("rejeita SKU duplicado na mesma empresa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/products")
      .set("Cookie", adminACookie)
      .send({ name: "Duplicado", sku: "BOLA-001" });

    expect(response.status).toBe(409);
  });

  it("rejeita código de barras duplicado na mesma empresa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/products")
      .set("Cookie", adminACookie)
      .send({ name: "Duplicado barcode", barcode: "7891234567890" });

    expect(response.status).toBe(409);
  });

  it("rejeita categoria de outra empresa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/products")
      .set("Cookie", adminACookie)
      .send({ name: "Categoria inválida", categoryId: "categoria-inexistente" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Categoria inválida ou de outra empresa");
  });

  it("rejeita fornecedor de outra empresa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/products")
      .set("Cookie", adminACookie)
      .send({ name: "Fornecedor inválido", supplierId: supplierBId });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Fornecedor inválido ou de outra empresa");
  });

  it("rejeita criação sem permissão administrativa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/products")
      .set("Cookie", memberACookie)
      .send({ name: "Membro não pode" });

    expect(response.status).toBe(403);
  });
});

describe("GET /api/products — listagem e filtros", () => {
  it("lista apenas produtos da empresa autenticada", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/products")
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(response.body.total).toBeGreaterThan(0);
    expect(response.body.items.every((item: { id: string }) => item.id !== productBId)).toBe(
      true,
    );
  });

  it("filtra por busca em nome", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/products")
      .query({ search: "bola" })
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].name).toBe("Bola de borracha");
  });

  it("filtra por SKU", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/products")
      .query({ search: "BOLA-001" })
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
  });

  it("pagina resultados com limite", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/products")
      .query({ page: 1, pageSize: 1 })
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.pageSize).toBe(1);
    expect(response.body.total).toBeGreaterThan(1);
  });

  it("não aceita pageSize acima do limite", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/products")
      .query({ pageSize: 500 })
      .set("Cookie", adminACookie);

    expect(response.status).toBe(400);
  });
});

describe("PATCH /api/products — edição e isolamento", () => {
  it("edita produto próprio", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/products/${productAId}`)
      .set("Cookie", adminACookie)
      .send({ salePrice: "24.90", description: "Cor azul" });

    expect(response.status).toBe(200);
    expect(response.body.salePrice).toBe("24.90");
  });

  it("não permite editar produto de outra empresa (404)", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/products/${productBId}`)
      .set("Cookie", adminACookie)
      .send({ name: "Tentativa" });

    expect(response.status).toBe(404);
  });

  it("não permite consultar produto de outra empresa (404)", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/products/${productBId}`)
      .set("Cookie", adminACookie);

    expect(response.status).toBe(404);
  });

  it("inativa produto sem exclusão física", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/products/${productAId}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("INACTIVE");

    const stored = await prisma.product.findUnique({ where: { id: productAId } });
    expect(stored).not.toBeNull();

    await request(app.getHttpServer())
      .patch(`/api/products/${productAId}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "ACTIVE" });
  });

  it("filtra por categoria e status", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/products")
      .query({ categoryId: categoryAId, status: "ACTIVE" })
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(
      response.body.items.every(
        (item: { categoryId: string }) => item.categoryId === categoryAId,
      ),
    ).toBe(true);
  });

  it("admin da empresa B não enxerga produtos da empresa A", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/products")
      .set("Cookie", adminBCookie);

    expect(response.status).toBe(200);
    expect(response.body.items.every((item: { id: string }) => item.id !== productAId)).toBe(
      true,
    );
    expect(
      response.body.items.every((item: { sku: string | null }) => item.sku !== "BOLA-001"),
    ).toBe(true);
  });
});
