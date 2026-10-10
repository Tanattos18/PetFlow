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
import { env } from "../apps/api/src/config/env";

const OLD_PASSWORD = "SenhaForte123!";
const NEW_PASSWORD = "NovaSenhaSegura456!";

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
      passwordHash: await bcrypt.hash(params.password ?? OLD_PASSWORD, 4),
      role: params.role ?? "MEMBER",
      status: params.status ?? "ACTIVE",
    },
  });
}

function reset(payload: { email: string; password: string }) {
  return request(app.getHttpServer())
    .post("/api/auth/reset-password")
    .send(payload);
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;

  await resetDatabase(prisma);

  const company = await createCompany("reset-test");
  await createUser({
    companyId: company.id,
    name: "Admin Reset",
    email: "admin@reset.test",
    role: "ADMIN",
  });
  await createUser({
    companyId: company.id,
    name: "Usuário Inativo",
    email: "inativo@reset.test",
    status: "INACTIVE",
  });

  const other = await createCompany("reset-other");
  await createUser({
    companyId: company.id,
    name: "Duplicado A",
    email: "dup@reset.test",
  });
  await createUser({
    companyId: other.id,
    name: "Duplicado B",
    email: "dup@reset.test",
  });
});

afterAll(async () => {
  await app.close();
});

describe("POST /api/auth/reset-password", () => {
  it("redefine a senha, invalida a antiga e encerra sessões abertas", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@reset.test", password: OLD_PASSWORD });
    expect(login.status).toBe(200);
    const oldCookie = sessionCookieFrom(login);

    const before = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Cookie", oldCookie);
    expect(before.status).toBe(200);

    const response = await reset({
      email: "admin@reset.test",
      password: NEW_PASSWORD,
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });

    const after = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Cookie", oldCookie);
    expect(after.status).toBe(401);

    const oldLogin = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@reset.test", password: OLD_PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@reset.test", password: NEW_PASSWORD });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.user.email).toBe("admin@reset.test");
  });

  it("responde 404 para email inexistente", async () => {
    const response = await reset({
      email: "naoexiste@reset.test",
      password: NEW_PASSWORD,
    });
    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Usuário não encontrado");
  });

  it("responde 404 para usuário inativo", async () => {
    const response = await reset({
      email: "inativo@reset.test",
      password: NEW_PASSWORD,
    });
    expect(response.status).toBe(404);
  });

  it("responde 400 quando o email pertence a mais de uma conta", async () => {
    const response = await reset({
      email: "dup@reset.test",
      password: NEW_PASSWORD,
    });
    expect(response.status).toBe(400);
    expect(response.body.message).toContain("mais de uma conta");
  });

  it("valida a política de senha (mínimo de 8 caracteres)", async () => {
    const response = await reset({
      email: "admin@reset.test",
      password: "123",
    });
    expect(response.status).toBe(400);
    expect(response.body.issues?.some((i: { path: string }) => i.path === "password")).toBe(
      true,
    );
  });

  it("responde 404 quando o recurso está desabilitado", async () => {
    const original = env.PASSWORD_RESET_ENABLED;
    env.PASSWORD_RESET_ENABLED = false;
    try {
      const response = await reset({
        email: "admin@reset.test",
        password: NEW_PASSWORD,
      });
      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Recurso indisponível");
    } finally {
      env.PASSWORD_RESET_ENABLED = original;
    }
  });

  it("aplica rate limit por email", async () => {
    const max = env.AUTH_RATE_LIMIT_MAX;
    if (max <= 0) return;

    for (let i = 0; i < max; i += 1) {
      const attempt = await reset({
        email: "brute@reset.test",
        password: NEW_PASSWORD,
      });
      expect(attempt.status).toBe(404);
    }

    const blocked = await reset({
      email: "brute@reset.test",
      password: NEW_PASSWORD,
    });
    expect(blocked.status).toBe(429);
  });
});
