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

async function createCompany(slug: string) {
  return prisma.company.create({ data: { name: `Empresa ${slug}`, slug } });
}

async function createUser(params: {
  companyId: string;
  name: string;
  email: string;
  role?: "ADMIN" | "MEMBER";
  status?: "ACTIVE" | "INACTIVE";
  password?: string;
}) {
  return prisma.user.create({
    data: {
      companyId: params.companyId,
      name: params.name,
      email: params.email,
      passwordHash: await bcrypt.hash(params.password ?? PASSWORD, 4),
      role: params.role ?? "MEMBER",
      status: params.status ?? "ACTIVE",
    },
  });
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;

  await resetDatabase(prisma);

  const company = await createCompany("auth-test");
  await createUser({
    companyId: company.id,
    name: "Admin Auth",
    email: "admin@auth.test",
    role: "ADMIN",
  });
  await createUser({
    companyId: company.id,
    name: "Usuário Inativo",
    email: "inativo@auth.test",
    status: "INACTIVE",
  });
});

afterAll(async () => {
  await app.close();
});

describe("POST /api/auth/login", () => {
  it("autentica com credenciais válidas e retorna cookie httpOnly", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@auth.test", password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      email: "admin@auth.test",
      role: "ADMIN",
    });
    expect(response.body.company).toMatchObject({ slug: "auth-test" });
    expect(response.body.user).not.toHaveProperty("passwordHash");

    const setCookie = response.headers["set-cookie"];
    const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookie).toContain("HttpOnly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).toContain("petflow_session=");
  });

  it("normaliza o email antes de autenticar (caixa)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "Admin@Auth.TEST", password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe("admin@auth.test");
  });

  it("rejeita senha incorreta", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@auth.test", password: "senha-errada" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Credenciais inválidas");
  });

  it("rejeita usuário inexistente com mensagem genérica", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "naoexiste@auth.test", password: PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Credenciais inválidas");
  });

  it("rejeita usuário inativo", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "inativo@auth.test", password: PASSWORD });

    expect(response.status).toBe(401);
  });

  it("rejeita payload inválido (400 com issues)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "nao-e-email", password: "" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Dados inválidos");
    expect(Array.isArray(response.body.issues)).toBe(true);
  });

  it("aplica limite de tentativas de login", async () => {
    let lastStatus = 0;
    for (let attempt = 0; attempt < 6; attempt++) {
      const response = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: "ratelimit@auth.test", password: "qualquer" });
      lastStatus = response.status;
      if (attempt < 5) {
        expect(response.status).toBe(401);
      }
    }
    expect(lastStatus).toBe(429);
  });
});

describe("GET /api/auth/me e rotas protegidas", () => {
  it("retorna 401 sem sessão", async () => {
    const response = await request(app.getHttpServer()).get("/api/auth/me");
    expect(response.status).toBe(401);
  });

  it("retorna 401 em rota privada sem sessão", async () => {
    const response = await request(app.getHttpServer()).get("/api/users");
    expect(response.status).toBe(401);
  });

  it("retorna os dados do usuário autenticado", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@auth.test", password: PASSWORD });
    const cookie = sessionCookieFrom(login);

    const me = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Cookie", cookie);

    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email: "admin@auth.test", role: "ADMIN" });
    expect(me.body.company).toMatchObject({ slug: "auth-test" });
  });
});

describe("POST /api/auth/logout", () => {
  it("encerra a sessão e impede o reuso do cookie", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@auth.test", password: PASSWORD });
    const cookie = sessionCookieFrom(login);

    const beforeLogout = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Cookie", cookie);
    expect(beforeLogout.status).toBe(200);

    const logout = await request(app.getHttpServer())
      .post("/api/auth/logout")
      .set("Cookie", cookie);
    expect(logout.status).toBe(200);

    const afterLogout = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Cookie", cookie);
    expect(afterLogout.status).toBe(401);
  });
});
