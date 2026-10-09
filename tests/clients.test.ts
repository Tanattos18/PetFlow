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

let clientAId: string;
let clientBId: string;
let petOfClientAId: string;

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

  const companyA = await createCompany("clientes-a");
  const companyB = await createCompany("clientes-b");

  await createUser({
    companyId: companyA.id,
    name: "Admin A",
    email: "admin@clientes-a.test",
    role: "ADMIN",
  });
  await createUser({
    companyId: companyA.id,
    name: "Membro A",
    email: "membro@clientes-a.test",
  });
  await createUser({
    companyId: companyB.id,
    name: "Admin B",
    email: "admin@clientes-b.test",
    role: "ADMIN",
  });

  const clientA = await prisma.client.create({
    data: {
      companyId: companyA.id,
      name: "Maria Oliveira",
      nameKey: "maria oliveira",
      phone: "11999998888",
      email: "maria@exemplo.com",
    },
  });
  clientAId = clientA.id;

  const pet = await prisma.pet.create({
    data: {
      companyId: companyA.id,
      clientId: clientA.id,
      name: "Thor",
      species: "DOG",
      breed: "Labrador",
    },
  });
  petOfClientAId = pet.id;

  const clientB = await prisma.client.create({
    data: {
      companyId: companyB.id,
      name: "Maria Oliveira",
      nameKey: "maria oliveira",
      phone: "11999998888",
      email: "maria@exemplo.com",
    },
  });
  clientBId = clientB.id;

  adminACookie = await login("admin@clientes-a.test");
  memberACookie = await login("membro@clientes-a.test");
  adminBCookie = await login("admin@clientes-b.test");
});

afterAll(async () => {
  await app.close();
});

describe("Clientes — CRUD, normalização e permissões", () => {
  let createdClientId: string;

  it("cria cliente normalizando telefone, email e CPF", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/clients")
      .set("Cookie", adminACookie)
      .send({
        name: "João Pereira",
        phone: "(11) 99999-8888",
        mobile: "11 98888-7777",
        email: "  Joao@Exemplo.COM ",
        cpf: "123.456.789-00",
        street: "Rua das Flores",
        number: "123",
        city: "São Paulo",
        state: "SP",
      });

    expect(response.status).toBe(201);
    expect(response.body.phone).toBe("11999998888");
    expect(response.body.mobile).toBe("11988887777");
    expect(response.body.email).toBe("joao@exemplo.com");
    expect(response.body.cpf).toBe("12345678900");
    expect(response.body.status).toBe("ACTIVE");
    expect(response.body._count).toEqual({ pets: 0, sales: 0 });
    createdClientId = response.body.id;
  });

  it("membro comum pode criar clientes (operação diária)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/clients")
      .set("Cookie", memberACookie)
      .send({ name: "Operador do Balconé", phone: "11911112222" });

    expect(response.status).toBe(201);
  });

  it("mesmo nome com mesmo telefone é bloqueado como possível duplicidade", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/clients")
      .set("Cookie", adminACookie)
      .send({ name: "joão   pereira", phone: "11 99999-8888" });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Cliente possivelmente duplicado");
  });

  it("mesmo nome sem contatos nunca bloqueia (homônimos)", async () => {
    const first = await request(app.getHttpServer())
      .post("/api/clients")
      .set("Cookie", adminACookie)
      .send({ name: "Ana Souza" });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post("/api/clients")
      .set("Cookie", adminACookie)
      .send({ name: "ANA  SOUZA" });
    expect(second.status).toBe(201);
  });

  it("mesmo telefone com nomes diferentes nunca bloqueia (família)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/clients")
      .set("Cookie", adminACookie)
      .send({ name: "Pedro Pereira", phone: "11999998888" });

    expect(response.status).toBe(201);
  });

  it("cliente de outra empresa com mesmo nome e telefone não bloqueia", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/clients")
      .set("Cookie", adminBCookie)
      .send({ name: "João Pereira", phone: "11999998888" });

    expect(response.status).toBe(201);
  });

  it("rejeita telefone curto, CPF com dígitos errados e nome inválido", async () => {
    const phone = await request(app.getHttpServer())
      .post("/api/clients")
      .set("Cookie", adminACookie)
      .send({ name: "Telefone Ruim", phone: "123" });
    expect(phone.status).toBe(400);
    expect(phone.body.issues?.some((i: { path: string }) => i.path === "phone")).toBe(true);

    const cpf = await request(app.getHttpServer())
      .post("/api/clients")
      .set("Cookie", adminACookie)
      .send({ name: "CPF Ruim", cpf: "1234567890" });
    expect(cpf.status).toBe(400);
    expect(cpf.body.issues?.some((i: { path: string }) => i.path === "cpf")).toBe(true);

    const name = await request(app.getHttpServer())
      .post("/api/clients")
      .set("Cookie", adminACookie)
      .send({ name: "A" });
    expect(name.status).toBe(400);
    expect(name.body.issues?.some((i: { path: string }) => i.path === "name")).toBe(true);
  });

  it("lista clientes com busca por nome e paginação", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/clients?search=jo%C3%A3o%20pereira&page=1&pageSize=10")
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(response.body.page).toBe(1);
    expect(response.body.pageSize).toBe(10);
    const names = response.body.items.map((item: { name: string }) => item.name);
    expect(names).toContain("João Pereira");
    expect(response.body.items.every((i: { id: string }) => i.id !== clientBId)).toBe(true);
  });

  it("lista apenas clientes da empresa autenticada", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/clients?pageSize=100")
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(response.body.items.every((i: { id: string }) => i.id !== clientBId)).toBe(true);
  });

  it("detalha cliente com contagem de pets e vendas", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/clients/${clientAId}`)
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Maria Oliveira");
    expect(response.body._count.pets).toBe(1);
  });

  it("não permite acessar cliente de outra empresa (404)", async () => {
    const get = await request(app.getHttpServer())
      .get(`/api/clients/${clientBId}`)
      .set("Cookie", adminACookie);
    expect(get.status).toBe(404);

    const patch = await request(app.getHttpServer())
      .patch(`/api/clients/${clientBId}`)
      .set("Cookie", adminACookie)
      .send({ name: "Tentativa" });
    expect(patch.status).toBe(404);
  });

  it("edita cliente normalizando novos contatos", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/clients/${createdClientId}`)
      .set("Cookie", adminACookie)
      .send({ phone: "(11) 97777-6666", notes: "Prefere contato à noite" });

    expect(response.status).toBe(200);
    expect(response.body.phone).toBe("11977776666");
    expect(response.body.notes).toBe("Prefere contato à noite");
    expect(response.body.name).toBe("João Pereira");
  });

  it("edita nome do cliente e a checagem de duplicidade considera o novo nome", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/clients/${createdClientId}`)
      .set("Cookie", adminACookie)
      .send({ name: "maria   oliveira", phone: "11999998888" });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Cliente possivelmente duplicado");
  });

  it("inativa e reativa cliente pelo status", async () => {
    const inactive = await request(app.getHttpServer())
      .patch(`/api/clients/${createdClientId}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });
    expect(inactive.status).toBe(200);
    expect(inactive.body.status).toBe("INACTIVE");

    const active = await request(app.getHttpServer())
      .patch(`/api/clients/${createdClientId}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "ACTIVE" });
    expect(active.status).toBe(200);
    expect(active.body.status).toBe("ACTIVE");
  });

  it("cliente inativo não sinaliza duplicidade para um novo cadastro", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/clients")
      .set("Cookie", adminACookie)
      .send({ name: "Carlos Dias", phone: "11933334444" });
    expect(created.status).toBe(201);

    await request(app.getHttpServer())
      .patch(`/api/clients/${created.body.id}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });

    const again = await request(app.getHttpServer())
      .post("/api/clients")
      .set("Cookie", adminACookie)
      .send({ name: "carlos dias", phone: "11 93333-4444" });
    expect(again.status).toBe(201);
  });

  it("exige autenticação", async () => {
    const response = await request(app.getHttpServer()).get("/api/clients");
    expect(response.status).toBe(401);
  });
});

describe("Pets do cliente", () => {
  it("lista os pets do responsável", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/clients/${clientAId}/pets`)
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0].name).toBe("Thor");
    expect(response.body.items[0].species).toBe("DOG");
  });

  it("retorna 404 para cliente inexistente", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/clients/cli_inexistente/pets")
      .set("Cookie", adminACookie);
    expect(response.status).toBe(404);
  });

  it("exige autenticação", async () => {
    const response = await request(app.getHttpServer()).get(`/api/clients/${clientAId}/pets`);
    expect(response.status).toBe(401);
  });
});

describe("Pets — cadastro básico usado pelos testes de isolamento", () => {
  it("pet criado no setup pertence à empresa correta", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/pets/${petOfClientAId}`)
      .set("Cookie", adminBCookie);
    expect(response.status).toBe(404);
  });
});
