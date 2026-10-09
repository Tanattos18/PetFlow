import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import {
  createTestApp,
  resetDatabase,
  sessionCookieFrom,
} from "./helpers/app";
import type { PrismaService } from "../apps/api/src/prisma/prisma.module";

const PASSWORD = "SenhaForte123!";

let app: INestApplication;
let prisma: PrismaService;

let companyAId: string;
let companyBId: string;
let adminACookie: string;
let memberACookie: string;
let adminBCookie: string;
let memberAId: string;
let userBId: string;

async function createCompany(slug: string) {
  return prisma.company.create({ data: { name: `Empresa ${slug}`, slug } });
}

async function createUser(params: {
  companyId: string;
  name: string;
  email: string;
  role?: "ADMIN" | "MEMBER";
  status?: "ACTIVE" | "INACTIVE";
}) {
  return prisma.user.create({
    data: {
      companyId: params.companyId,
      name: params.name,
      email: params.email,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role: params.role ?? "MEMBER",
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

  const companyA = await createCompany("loja-a");
  const companyB = await createCompany("loja-b");
  companyAId = companyA.id;
  companyBId = companyB.id;

  await createUser({
    companyId: companyAId,
    name: "Admin A",
    email: "admin@a.test",
    role: "ADMIN",
  });
  const memberA = await createUser({
    companyId: companyAId,
    name: "Membro A",
    email: "membro@a.test",
  });
  memberAId = memberA.id;

  await createUser({
    companyId: companyBId,
    name: "Admin B",
    email: "admin@b.test",
    role: "ADMIN",
  });
  const userB = await createUser({
    companyId: companyBId,
    name: "Membro B",
    email: "membro@b.test",
  });
  userBId = userB.id;

  adminACookie = await login("admin@a.test");
  memberACookie = await login("membro@a.test");
  adminBCookie = await login("admin@b.test");
});

afterAll(async () => {
  await app.close();
});

describe("GET /api/users", () => {
  it("lista apenas usuários da empresa autenticada", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/users")
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    const emails = response.body.map((user: { email: string }) => user.email);
    expect(emails).toContain("admin@a.test");
    expect(emails).toContain("membro@a.test");
    expect(emails).not.toContain("admin@b.test");
    expect(emails).not.toContain("membro@b.test");
  });

  it("bloqueia usuário sem papel administrativo", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/users")
      .set("Cookie", memberACookie);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Permissão administrativa necessária");
  });
});

describe("POST /api/users", () => {
  it("cria usuário na empresa do administrador com email normalizado", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/users")
      .set("Cookie", adminACookie)
      .send({
        name: "Novo Membro",
        email: "  NovoMembro@A.TEST ",
        password: "OutraSenha123!",
        role: "MEMBER",
      });

    expect(response.status).toBe(201);
    expect(response.body.email).toBe("novomembro@a.test");
    expect(response.body).not.toHaveProperty("passwordHash");

    const stored = await prisma.user.findUnique({
      where: {
        companyId_email: { companyId: companyAId, email: "novomembro@a.test" },
      },
    });
    expect(stored).not.toBeNull();
    expect(stored?.passwordHash).not.toBe("OutraSenha123!");
  });

  it("rejeita email duplicado dentro da mesma empresa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/users")
      .set("Cookie", adminACookie)
      .send({
        name: "Duplicado",
        email: "membro@a.test",
        password: "OutraSenha123!",
      });

    expect(response.status).toBe(409);
  });

  it("permite o mesmo email em outra empresa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/users")
      .set("Cookie", adminBCookie)
      .send({
        name: "Membro A na B",
        email: "membro@a.test",
        password: "OutraSenha123!",
      });

    expect(response.status).toBe(201);
    expect(response.body.email).toBe("membro@a.test");
  });

  it("rejeita criação sem permissão administrativa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/users")
      .set("Cookie", memberACookie)
      .send({
        name: "Intruso",
        email: "intruso@a.test",
        password: "OutraSenha123!",
      });

    expect(response.status).toBe(403);
  });
});

describe("PATCH /api/users/:id/status — isolamento de tenant", () => {
  it("não permite alterar usuário de outra empresa (404)", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/users/${userBId}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(404);

    const userB = await prisma.user.findUnique({ where: { id: userBId } });
    expect(userB?.status).toBe("ACTIVE");
  });

  it("não permite que o administrador inative a própria conta", async () => {
    const adminA = await prisma.user.findUnique({
      where: { companyId_email: { companyId: companyAId, email: "admin@a.test" } },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${adminA?.id}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(403);
  });

  it("inativar usuário revoga as sessões ativas dele", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/users/${memberAId}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("INACTIVE");

    const me = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Cookie", memberACookie);
    expect(me.status).toBe(401);

    const reactivated = await request(app.getHttpServer())
      .patch(`/api/users/${memberAId}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "ACTIVE" });
    expect(reactivated.status).toBe(200);
  });

  it("empresa A não enxerga usuários da empresa B após listagens", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/users")
      .set("Cookie", adminBCookie);

    expect(response.status).toBe(200);
    const emails = response.body.map((user: { email: string }) => user.email);
    expect(emails).toContain("admin@b.test");
    expect(emails).not.toContain("admin@a.test");
  });
});
