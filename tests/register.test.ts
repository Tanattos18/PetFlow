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

const PASSWORD = "SenhaForte123!";

let app: INestApplication;
let prisma: PrismaService;

function register(payload: {
  companyName: string;
  name: string;
  email: string;
  password: string;
}) {
  return request(app.getHttpServer())
    .post("/api/auth/register")
    .send(payload);
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;

  await resetDatabase(prisma);

  const company = await prisma.company.create({
    data: { name: "Empresa Registro", slug: "empresa-registro" },
  });
  await prisma.user.create({
    data: {
      companyId: company.id,
      name: "Existente",
      email: "existe@registro.test",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
});

afterAll(async () => {
  await app.close();
});

describe("POST /api/auth/register", () => {
  it("cria empresa + administrador, loga e permite entrar depois", async () => {
    const response = await register({
      companyName: "Pet Shop Registro",
      name: "Dono Registro",
      email: "dono@registro.test",
      password: PASSWORD,
    });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe("dono@registro.test");
    expect(response.body.user.role).toBe("ADMIN");
    expect(response.body.company.name).toBe("Pet Shop Registro");
    expect(response.body.company.slug).toBe("pet-shop-registro");

    const cookie = sessionCookieFrom(response);
    const me = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe("ADMIN");

    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "dono@registro.test", password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.company.slug).toBe("pet-shop-registro");
  });

  it("gera slug único quando já existe empresa com o mesmo nome", async () => {
    const response = await register({
      companyName: "Pet Shop Registro",
      name: "Segundo Dono",
      email: "dono2@registro.test",
      password: PASSWORD,
    });

    expect(response.status).toBe(201);
    expect(response.body.company.slug).toBe("pet-shop-registro-2");
  });

  it("responde 409 para email já cadastrado", async () => {
    const response = await register({
      companyName: "Outra Empresa",
      name: "Tentativa",
      email: "existe@registro.test",
      password: PASSWORD,
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Este email já está cadastrado");
  });

  it("valida a política de senha (mínimo de 8 caracteres)", async () => {
    const response = await register({
      companyName: "Empresa Validacao",
      name: "Validacao",
      email: "valida@registro.test",
      password: "123",
    });

    expect(response.status).toBe(400);
    expect(
      response.body.issues?.some((i: { path: string }) => i.path === "password"),
    ).toBe(true);
  });

  it("responde 404 quando o recurso está desabilitado", async () => {
    const original = env.REGISTRATION_ENABLED;
    env.REGISTRATION_ENABLED = false;
    try {
      const response = await register({
        companyName: "Empresa Desligada",
        name: "Desligada",
        email: "desligada@registro.test",
        password: PASSWORD,
      });
      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Recurso indisponível");
    } finally {
      env.REGISTRATION_ENABLED = original;
    }
  });

  it("aplica rate limit de cadastro por IP", async () => {
    const original = env.AUTH_RATE_LIMIT_MAX;
    env.AUTH_RATE_LIMIT_MAX = 2;
    try {
      const attempts = [];
      for (let i = 0; i < 4; i += 1) {
        attempts.push(
          await register({
            companyName: "Empresa Rate",
            name: "Rate",
            email: "existe@registro.test",
            password: PASSWORD,
          }),
        );
      }
      expect(attempts.some((r) => r.status === 429)).toBe(true);
    } finally {
      env.AUTH_RATE_LIMIT_MAX = original;
    }
  });
});
