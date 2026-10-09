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
let categoryBId: string;
let supplierBId: string;

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

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;

  await resetDatabase(prisma);

  const companyA = await createCompany("catalogo-a");
  const companyB = await createCompany("catalogo-b");

  await createUser({
    companyId: companyA.id,
    name: "Admin A",
    email: "admin@catalogo-a.test",
    role: "ADMIN",
  });
  await createUser({
    companyId: companyA.id,
    name: "Membro A",
    email: "membro@catalogo-a.test",
  });
  await createUser({
    companyId: companyB.id,
    name: "Admin B",
    email: "admin@catalogo-b.test",
    role: "ADMIN",
  });

  const categoryB = await prisma.category.create({
    data: { companyId: companyB.id, name: "Rações", nameKey: "rações" },
  });
  categoryBId = categoryB.id;
  const supplierB = await prisma.supplier.create({
    data: { companyId: companyB.id, name: "Fornecedor B" },
  });
  supplierBId = supplierB.id;

  adminACookie = await login("admin@catalogo-a.test");
  memberACookie = await login("membro@catalogo-a.test");
  adminBCookie = await login("admin@catalogo-b.test");
});

afterAll(async () => {
  await app.close();
});

describe("Categorias — CRUD e validação", () => {
  let categoryAId: string;

  it("cria categoria normalizando o nome para unicidade", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/categories")
      .set("Cookie", adminACookie)
      .send({ name: "  Ração Premium ", description: "Rações premium" });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("Ração Premium");
    categoryAId = response.body.id;
  });

  it("rejeita nome duplicado na mesma empresa (case-insensitive)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/categories")
      .set("Cookie", adminACookie)
      .send({ name: "RAÇÃO PREMIUM" });

    expect(response.status).toBe(409);
  });

  it("permite o mesmo nome de categoria em outra empresa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/categories")
      .set("Cookie", adminBCookie)
      .send({ name: "Ração Premium" });

    expect(response.status).toBe(201);
  });

  it("rejeita criação sem permissão administrativa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/categories")
      .set("Cookie", memberACookie)
      .send({ name: "Membro Não Pode" });

    expect(response.status).toBe(403);
  });

  it("lista apenas categorias da empresa autenticada", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/categories")
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    const names = response.body.items.map((item: { name: string }) => item.name);
    expect(names).toContain("Ração Premium");
    expect(response.body.items.every((item: { id: string }) => item.id !== categoryBId)).toBe(
      true,
    );
  });

  it("rejeita payload inválido (nome curto)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/categories")
      .set("Cookie", adminACookie)
      .send({ name: "A" });

    expect(response.status).toBe(400);
  });

  it("edita categoria e inativa com status", async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/categories/${categoryAId}`)
      .set("Cookie", adminACookie)
      .send({ description: "Atualizada" });
    expect(updated.status).toBe(200);
    expect(updated.body.description).toBe("Atualizada");

    const inactive = await request(app.getHttpServer())
      .patch(`/api/categories/${categoryAId}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });
    expect(inactive.status).toBe(200);
    expect(inactive.body.status).toBe("INACTIVE");
  });

  it("não permite acessar categoria de outra empresa (404)", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/categories/${categoryBId}`)
      .set("Cookie", adminACookie);

    expect(response.status).toBe(404);
  });

  it("exige autenticação", async () => {
    const response = await request(app.getHttpServer()).get("/api/categories");
    expect(response.status).toBe(401);
  });
});

describe("Fornecedores — CRUD e isolamento", () => {
  let supplierAId: string;

  it("cria fornecedor com dados opcionais vazios como null", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/suppliers")
      .set("Cookie", adminACookie)
      .send({ name: "Pet Distribuidora", document: "", phone: "(11) 99999-0000" });

    expect(response.status).toBe(201);
    expect(response.body.document).toBeNull();
    expect(response.body.phone).toBe("(11) 99999-0000");
    supplierAId = response.body.id;
  });

  it("rejeita criação sem permissão administrativa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/suppliers")
      .set("Cookie", memberACookie)
      .send({ name: "Não Pode" });

    expect(response.status).toBe(403);
  });

  it("edita e inativa fornecedor", async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/suppliers/${supplierAId}`)
      .set("Cookie", adminACookie)
      .send({ email: "contato@petdist.com" });
    expect(updated.status).toBe(200);
    expect(updated.body.email).toBe("contato@petdist.com");

    const inactive = await request(app.getHttpServer())
      .patch(`/api/suppliers/${supplierAId}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });
    expect(inactive.status).toBe(200);
    expect(inactive.body.status).toBe("INACTIVE");
  });

  it("lista apenas fornecedores da empresa autenticada", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/suppliers")
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(
      response.body.items.every((item: { id: string }) => item.id !== supplierBId),
    ).toBe(true);
  });

  it("não permite editar fornecedor de outra empresa (404)", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/suppliers/${supplierBId}`)
      .set("Cookie", adminACookie)
      .send({ name: "Tentativa" });

    expect(response.status).toBe(404);
  });
});
