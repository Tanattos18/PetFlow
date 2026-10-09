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

let clientA1: string;
let clientA2: string;
let clientAInactive: string;
let clientB: string;
let petBId: string;

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

async function createClient(companyId: string, name: string, status?: "INACTIVE") {
  return prisma.client.create({
    data: {
      companyId,
      name,
      nameKey: name.trim().toLowerCase().replace(/\s+/g, " "),
      ...(status ? { status } : {}),
    },
  });
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;

  await resetDatabase(prisma);

  const companyA = await createCompany("pets-a");
  const companyB = await createCompany("pets-b");

  await createUser({
    companyId: companyA.id,
    name: "Admin A",
    email: "admin@pets-a.test",
    role: "ADMIN",
  });
  await createUser({
    companyId: companyA.id,
    name: "Membro A",
    email: "membro@pets-a.test",
  });
  await createUser({
    companyId: companyB.id,
    name: "Admin B",
    email: "admin@pets-b.test",
    role: "ADMIN",
  });

  clientA1 = (await createClient(companyA.id, "Familia Um")).id;
  clientA2 = (await createClient(companyA.id, "Familia Dois")).id;
  clientAInactive = (await createClient(companyA.id, "Familia Inativa", "INACTIVE")).id;
  clientB = (await createClient(companyB.id, "Familia Outra")).id;

  const petB = await prisma.pet.create({
    data: { companyId: companyB.id, clientId: clientB, name: "Pet Alheio", species: "CAT" },
  });
  petBId = petB.id;

  adminACookie = await login("admin@pets-a.test");
  memberACookie = await login("membro@pets-a.test");
});

afterAll(async () => {
  await app.close();
});

describe("Pets — CRUD e validações", () => {
  let petId: string;

  it("cria pet com sexo padrão, peso e data formatados", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/pets")
      .set("Cookie", adminACookie)
      .send({
        clientId: clientA1,
        name: "Thor",
        species: "DOG",
        breed: "Labrador",
        weight: "12.5",
        birthDate: "2020-05-10",
        color: "Preto",
      });

    expect(response.status).toBe(201);
    expect(response.body.sex).toBe("UNKNOWN");
    expect(response.body.weight).toBe("12.50");
    expect(response.body.birthDate).toBe("2020-05-10");
    expect(response.body.status).toBe("ACTIVE");
    expect(response.body.client).toEqual({
      id: clientA1,
      name: "Familia Um",
      phone: null,
      mobile: null,
      email: null,
    });
    petId = response.body.id;
  });

  it("membro comum pode cadastrar pets (operação diária)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/pets")
      .set("Cookie", memberACookie)
      .send({ clientId: clientA1, name: "Mimi", species: "CAT", sex: "FEMALE" });

    expect(response.status).toBe(201);
    expect(response.body.sex).toBe("FEMALE");
  });

  it("rejeita responsável de outra empresa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/pets")
      .set("Cookie", adminACookie)
      .send({ clientId: clientB, name: "Intruso", species: "DOG" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Responsável inválido ou de outra empresa");
  });

  it("rejeita responsável inativo", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/pets")
      .set("Cookie", adminACookie)
      .send({ clientId: clientAInactive, name: "Sem Dono", species: "DOG" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Responsável está inativo");
  });

  it("rejeita espécie inválida, data futura e peso fora do intervalo", async () => {
    const species = await request(app.getHttpServer())
      .post("/api/pets")
      .set("Cookie", adminACookie)
      .send({ clientId: clientA1, name: "Estranho", species: "DRAGON" });
    expect(species.status).toBe(400);
    expect(species.body.issues?.some((i: { path: string }) => i.path === "species")).toBe(true);

    const future = await request(app.getHttpServer())
      .post("/api/pets")
      .set("Cookie", adminACookie)
      .send({
        clientId: clientA1,
        name: "Viajante",
        species: "DOG",
        birthDate: "2099-01-01",
      });
    expect(future.status).toBe(400);
    expect(future.body.issues?.some((i: { path: string }) => i.path === "birthDate")).toBe(true);

    const zero = await request(app.getHttpServer())
      .post("/api/pets")
      .set("Cookie", adminACookie)
      .send({ clientId: clientA1, name: "Pluma", species: "BIRD", weight: "0" });
    expect(zero.status).toBe(400);
    expect(zero.body.issues?.some((i: { path: string }) => i.path === "weight")).toBe(true);

    const heavy = await request(app.getHttpServer())
      .post("/api/pets")
      .set("Cookie", adminACookie)
      .send({ clientId: clientA1, name: "Elefante", species: "OTHER", weight: "1000" });
    expect(heavy.status).toBe(400);
    expect(heavy.body.issues?.some((i: { path: string }) => i.path === "weight")).toBe(true);
  });

  it("lista pets com filtros de responsável, espécie e busca", async () => {
    const byClient = await request(app.getHttpServer())
      .get(`/api/pets?clientId=${clientA1}`)
      .set("Cookie", adminACookie);
    expect(byClient.status).toBe(200);
    expect(
      byClient.body.items.every((p: { clientId: string }) => p.clientId === clientA1),
    ).toBe(true);

    const bySpecies = await request(app.getHttpServer())
      .get("/api/pets?species=CAT")
      .set("Cookie", adminACookie);
    expect(bySpecies.status).toBe(200);
    expect(bySpecies.body.items.every((p: { species: string }) => p.species === "CAT")).toBe(
      true,
    );

    const byOwner = await request(app.getHttpServer())
      .get("/api/pets?search=Familia%20Um")
      .set("Cookie", adminACookie);
    expect(byOwner.status).toBe(200);
    expect(byOwner.body.items.length).toBeGreaterThanOrEqual(2);
    expect(
      byOwner.body.items.every((p: { clientId: string }) => p.clientId === clientA1),
    ).toBe(true);

    const byName = await request(app.getHttpServer())
      .get("/api/pets?search=thor")
      .set("Cookie", adminACookie);
    expect(byName.status).toBe(200);
    expect(byName.body.items[0].name).toBe("Thor");
  });

  it("detalha pet incluindo o responsável", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/pets/${petId}`)
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(response.body.client.name).toBe("Familia Um");
  });

  it("não permite acessar pet de outra empresa (404)", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/pets/${petBId}`)
      .set("Cookie", adminACookie);
    expect(response.status).toBe(404);
  });

  it("edita pet e troca o responsável dentro da empresa", async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/pets/${petId}`)
      .set("Cookie", adminACookie)
      .send({ clientId: clientA2, sex: "MALE", weight: "13.25" });

    expect(updated.status).toBe(200);
    expect(updated.body.clientId).toBe(clientA2);
    expect(updated.body.sex).toBe("MALE");
    expect(updated.body.weight).toBe("13.25");
    expect(updated.body.client.name).toBe("Familia Dois");
  });

  it("trocar responsável para outra empresa é rejeitado", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/pets/${petId}`)
      .set("Cookie", adminACookie)
      .send({ clientId: clientB });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Responsável inválido ou de outra empresa");
  });

  it("inativa pet pelo status e o filtro reflete a mudança", async () => {
    const inactive = await request(app.getHttpServer())
      .patch(`/api/pets/${petId}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });
    expect(inactive.status).toBe(200);
    expect(inactive.body.status).toBe("INACTIVE");

    const list = await request(app.getHttpServer())
      .get("/api/pets?status=INACTIVE")
      .set("Cookie", adminACookie);
    expect(list.status).toBe(200);
    expect(list.body.items.some((p: { id: string }) => p.id === petId)).toBe(true);
  });

  it("exige autenticação", async () => {
    const response = await request(app.getHttpServer()).get("/api/pets");
    expect(response.status).toBe(401);
  });
});
