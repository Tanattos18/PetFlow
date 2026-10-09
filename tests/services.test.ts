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

let serviceAId: string;
let serviceBId: string;

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

  const companyA = await createCompany("servicos-a");
  const companyB = await createCompany("servicos-b");

  await createUser({
    companyId: companyA.id,
    name: "Admin A",
    email: "admin@servicos-a.test",
    role: "ADMIN",
  });
  await createUser({
    companyId: companyA.id,
    name: "Membro A",
    email: "membro@servicos-a.test",
  });
  await createUser({
    companyId: companyB.id,
    name: "Admin B",
    email: "admin@servicos-b.test",
    role: "ADMIN",
  });

  const serviceB = await prisma.service.create({
    data: {
      companyId: companyB.id,
      name: "Banho Tosa",
      nameKey: "banho tosa",
      price: "80.00",
      durationMinutes: 60,
    },
  });
  serviceBId = serviceB.id;

  adminACookie = await login("admin@servicos-a.test");
  memberACookie = await login("membro@servicos-a.test");
  adminBCookie = await login("admin@servicos-b.test");
});

afterAll(async () => {
  await app.close();
});

describe("Serviços — CRUD, permissões e validações", () => {
  it("admin cria serviço com preço e duração", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/services")
      .set("Cookie", adminACookie)
      .send({
        name: "Banho e Tosa",
        description: "Pacote completo",
        durationMinutes: 45,
        price: "45.50",
      });

    expect(response.status).toBe(201);
    expect(response.body.price).toBe("45.50");
    expect(response.body.durationMinutes).toBe(45);
    expect(response.body.status).toBe("ACTIVE");
    serviceAId = response.body.id;
  });

  it("membro comum não pode criar serviços (catálogo = ADMIN)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/services")
      .set("Cookie", memberACookie)
      .send({ name: "Não Pode", price: "10.00" });

    expect(response.status).toBe(403);
  });

  it("membro comum pode listar serviços (leitura autenticada)", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/services")
      .set("Cookie", memberACookie);

    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it("nome duplicado na mesma empresa é rejeitado (case-insensitive)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/services")
      .set("Cookie", adminACookie)
      .send({ name: "banho  e tosa", price: "50.00" });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "Já existe um serviço com este nome nesta empresa",
    );
  });

  it("mesmo nome de serviço em outra empresa é permitido", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/services")
      .set("Cookie", adminBCookie)
      .send({ name: "Banho e Tosa", price: "70.00" });

    expect(response.status).toBe(201);
  });

  it("valida preço obrigatório, preço negativo e duração fora do intervalo", async () => {
    const missing = await request(app.getHttpServer())
      .post("/api/services")
      .set("Cookie", adminACookie)
      .send({ name: "Sem Preço" });
    expect(missing.status).toBe(400);
    expect(missing.body.issues?.some((i: { path: string }) => i.path === "price")).toBe(true);

    const negative = await request(app.getHttpServer())
      .post("/api/services")
      .set("Cookie", adminACookie)
      .send({ name: "Preço Negativo", price: "-1" });
    expect(negative.status).toBe(400);
    expect(negative.body.issues?.some((i: { path: string }) => i.path === "price")).toBe(true);

    const zeroDuration = await request(app.getHttpServer())
      .post("/api/services")
      .set("Cookie", adminACookie)
      .send({ name: "Duração Zero", price: "10.00", durationMinutes: 0 });
    expect(zeroDuration.status).toBe(400);
    expect(
      zeroDuration.body.issues?.some((i: { path: string }) => i.path === "durationMinutes"),
    ).toBe(true);

    const tooLong = await request(app.getHttpServer())
      .post("/api/services")
      .set("Cookie", adminACookie)
      .send({ name: "Duração Longa", price: "10.00", durationMinutes: 1441 });
    expect(tooLong.status).toBe(400);
    expect(
      tooLong.body.issues?.some((i: { path: string }) => i.path === "durationMinutes"),
    ).toBe(true);
  });

  it("lista serviços com busca, ordenação por preço e paginação", async () => {
    const search = await request(app.getHttpServer())
      .get("/api/services?search=banho")
      .set("Cookie", adminACookie);
    expect(search.status).toBe(200);
    expect(search.body.items.every((s: { id: string }) => s.id !== serviceBId)).toBe(true);
    expect(search.body.items[0].name).toBe("Banho e Tosa");

    const ordered = await request(app.getHttpServer())
      .get("/api/services?orderBy=price&direction=desc&pageSize=5")
      .set("Cookie", adminACookie);
    expect(ordered.status).toBe(200);
    expect(ordered.body.items[0].price).toBe("45.50");
    expect(ordered.body.pageSize).toBe(5);
  });

  it("detalha serviço e não permite acesso cruzado (404)", async () => {
    const own = await request(app.getHttpServer())
      .get(`/api/services/${serviceAId}`)
      .set("Cookie", adminACookie);
    expect(own.status).toBe(200);
    expect(own.body.price).toBe("45.50");

    const cross = await request(app.getHttpServer())
      .get(`/api/services/${serviceBId}`)
      .set("Cookie", adminACookie);
    expect(cross.status).toBe(404);
  });

  it("admin edita preço, duração e descrição", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/services/${serviceAId}`)
      .set("Cookie", adminACookie)
      .send({ price: "49.90", durationMinutes: 50, description: "Revisado" });

    expect(response.status).toBe(200);
    expect(response.body.price).toBe("49.90");
    expect(response.body.durationMinutes).toBe(50);
    expect(response.body.description).toBe("Revisado");
  });

  it("membro comum não pode editar serviço", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/services/${serviceAId}`)
      .set("Cookie", memberACookie)
      .send({ price: "1.00" });

    expect(response.status).toBe(403);
  });

  it("renomear serviço para nome já usado é rejeitado", async () => {
    const other = await request(app.getHttpServer())
      .post("/api/services")
      .set("Cookie", adminACookie)
      .send({ name: "Tosa Sanitária", price: "35.00" });
    expect(other.status).toBe(201);

    const renamed = await request(app.getHttpServer())
      .patch(`/api/services/${other.body.id}`)
      .set("Cookie", adminACookie)
      .send({ name: "BANHO E TOSA" });
    expect(renamed.status).toBe(409);
  });

  it("inativa serviço pelo status", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/services/${serviceAId}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("INACTIVE");

    const list = await request(app.getHttpServer())
      .get("/api/services?status=INACTIVE")
      .set("Cookie", adminACookie);
    expect(list.body.items.some((s: { id: string }) => s.id === serviceAId)).toBe(true);
  });

  it("exige autenticação", async () => {
    const response = await request(app.getHttpServer()).get("/api/services");
    expect(response.status).toBe(401);
  });
});
