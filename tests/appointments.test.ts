import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp, resetDatabase, sessionCookieFrom } from "./helpers/app";
import type { PrismaService } from "../apps/api/src/prisma/prisma.module";

const PASSWORD = "SenhaForte123!";
const OFFSET = -new Date().getTimezoneOffset();

let app: INestApplication;
let prisma: PrismaService;

let adminACookie: string;
let memberACookie: string;
let adminBCookie: string;

let anaId: string;
let brunoId: string;
let carlosId: string;
let rexId: string;
let serviceAId: string;
let serviceBId: string;
let inactiveServiceAId: string;

let slotCounter = 0;
let reminderTemplateId: string;

function localDate(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function localAt(days: number, hhmm: string): string {
  return `${localDate(days)}T${hhmm}`;
}

function expectedStartAt(startLocal: string): number {
  return Date.parse(`${startLocal}:00.000Z`) - OFFSET * 60_000;
}

/** Slots únicos e não sobrepostos (1h de distância, duração 45min) por teste. */
function nextSlot(): string {
  slotCounter += 1;
  const day = 2 + Math.floor((slotCounter - 1) / 14);
  const hour = 8 + ((slotCounter - 1) % 14);
  return localAt(day, `${String(hour).padStart(2, "0")}:00`);
}

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

function post(payload: Record<string, unknown>, cookie = adminACookie) {
  return request(app.getHttpServer())
    .post("/api/appointments")
    .set("Cookie", cookie)
    .send(payload);
}

async function createAppointment(
  overrides: Record<string, unknown> = {},
  cookie = adminACookie,
): Promise<{ id: string; [key: string]: unknown }> {
  const response = await post(
    {
      clientId: anaId,
      petId: rexId,
      serviceId: serviceAId,
      startLocal: nextSlot(),
      utcOffsetMinutes: OFFSET,
      durationMinutes: 45,
      ...overrides,
    },
    cookie,
  );
  if (response.status !== 201) {
    throw new Error(
      `Criação falhou: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }
  return response.body;
}

async function reminderOf(appointmentId: string) {
  return prisma.whatsAppMessage.findUnique({
    where: {
      companyId_idempotencyKey: {
        companyId: (await prisma.appointment.findUniqueOrThrow({
          where: { id: appointmentId },
          select: { companyId: true },
        })).companyId,
        idempotencyKey: `appointment-reminder:${appointmentId}`,
      },
    },
  });
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;

  await resetDatabase(prisma);

  const companyA = await createCompany("agenda-a");
  const companyB = await createCompany("agenda-b");

  await createUser({
    companyId: companyA.id,
    name: "Admin A",
    email: "admin@agenda-a.test",
    role: "ADMIN",
  });
  await createUser({
    companyId: companyA.id,
    name: "Membro A",
    email: "membro@agenda-a.test",
  });
  await createUser({
    companyId: companyB.id,
    name: "Admin B",
    email: "admin@agenda-b.test",
    role: "ADMIN",
  });

  const ana = await prisma.client.create({
    data: {
      companyId: companyA.id,
      name: "Ana Santos",
      nameKey: "ana santos",
      phone: "11999998888",
    },
  });
  anaId = ana.id;

  const bruno = await prisma.client.create({
    data: {
      companyId: companyA.id,
      name: "Bruno Lima",
      nameKey: "bruno lima",
      phone: "11988887777",
    },
  });
  brunoId = bruno.id;

  const carlos = await prisma.client.create({
    data: {
      companyId: companyB.id,
      name: "Carlos Souza",
      nameKey: "carlos souza",
      phone: "21988887777",
    },
  });
  carlosId = carlos.id;

  const rex = await prisma.pet.create({
    data: { companyId: companyA.id, clientId: ana.id, name: "Rex", species: "DOG" },
  });
  rexId = rex.id;

  await prisma.pet.create({
    data: { companyId: companyA.id, clientId: ana.id, name: "Nina", species: "CAT" },
  });
  await prisma.pet.create({
    data: { companyId: companyA.id, clientId: bruno.id, name: "Luna", species: "CAT" },
  });
  await prisma.pet.create({
    data: { companyId: companyB.id, clientId: carlos.id, name: "Bidu", species: "DOG" },
  });

  const serviceA = await prisma.service.create({
    data: {
      companyId: companyA.id,
      name: "Banho e Tosa",
      nameKey: "banho e tosa",
      price: "45.50",
      durationMinutes: 45,
    },
  });
  serviceAId = serviceA.id;

  const inactive = await prisma.service.create({
    data: {
      companyId: companyA.id,
      name: "Tosa Criativa",
      nameKey: "tosa criativa",
      price: "30.00",
      durationMinutes: 30,
      status: "INACTIVE",
    },
  });
  inactiveServiceAId = inactive.id;

  const serviceB = await prisma.service.create({
    data: {
      companyId: companyB.id,
      name: "Banho B",
      nameKey: "banho b",
      price: "70.00",
      durationMinutes: 60,
    },
  });
  serviceBId = serviceB.id;

  adminACookie = await login("admin@agenda-a.test");
  memberACookie = await login("membro@agenda-a.test");
  adminBCookie = await login("admin@agenda-b.test");
});

afterAll(async () => {
  await app.close();
});

describe("POST /api/appointments — criação e validações", () => {
  it("admin cria agendamento com fuso, duração e relações", async () => {
    const startLocal = nextSlot();
    const response = await post({
      clientId: anaId,
      petId: rexId,
      serviceId: serviceAId,
      startLocal,
      utcOffsetMinutes: OFFSET,
      durationMinutes: 45,
      notes: "Tosa completa",
    });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("SCHEDULED");
    expect(response.body.startLocal).toBe(startLocal);
    expect(Date.parse(response.body.startAt)).toBe(expectedStartAt(startLocal));
    expect(Date.parse(response.body.endAt)).toBe(
      expectedStartAt(startLocal) + 45 * 60_000,
    );
    expect(response.body.client.name).toBe("Ana Santos");
    expect(response.body.pet.name).toBe("Rex");
    expect(response.body.service.name).toBe("Banho e Tosa");
    expect(response.body.service.price).toBe("45.50");
    expect(response.body.createdBy.name).toBe("Admin A");
    expect(response.body.notes).toBe("Tosa completa");
  });

  it("membro comum pode criar agendamento (operação diária, sem AdminGuard)", async () => {
    const response = await post(
      {
        clientId: anaId,
        serviceId: serviceAId,
        startLocal: nextSlot(),
        utcOffsetMinutes: OFFSET,
        durationMinutes: 30,
      },
      memberACookie,
    );
    expect(response.status).toBe(201);
  });

  it("exige autenticação", async () => {
    const response = await request(app.getHttpServer()).get("/api/appointments");
    expect(response.status).toBe(401);
  });

  it("valida campos obrigatórios, formatos e limites", async () => {
    const missing = await post({ serviceId: serviceAId, startLocal: nextSlot(), utcOffsetMinutes: OFFSET, durationMinutes: 30 });
    expect(missing.status).toBe(400);
    expect(missing.body.issues?.some((i: { path: string }) => i.path === "clientId")).toBe(true);

    const badFormat = await post({ clientId: anaId, serviceId: serviceAId, startLocal: "10/10/2026 10:00", utcOffsetMinutes: OFFSET, durationMinutes: 30 });
    expect(badFormat.status).toBe(400);

    const badDate = await post({ clientId: anaId, serviceId: serviceAId, startLocal: "2026-02-30T10:00", utcOffsetMinutes: OFFSET, durationMinutes: 30 });
    expect(badDate.status).toBe(400);

    const badOffset = await post({ clientId: anaId, serviceId: serviceAId, startLocal: nextSlot(), utcOffsetMinutes: 900, durationMinutes: 30 });
    expect(badOffset.status).toBe(400);
    expect(badOffset.body.issues?.some((i: { path: string }) => i.path === "utcOffsetMinutes")).toBe(true);

    const noDuration = await post({ clientId: anaId, serviceId: serviceAId, startLocal: nextSlot(), utcOffsetMinutes: OFFSET });
    expect(noDuration.status).toBe(400);
    expect(noDuration.body.issues?.some((i: { path: string }) => i.path === "durationMinutes")).toBe(true);

    const zero = await post({ clientId: anaId, serviceId: serviceAId, startLocal: nextSlot(), utcOffsetMinutes: OFFSET, durationMinutes: 0 });
    expect(zero.status).toBe(400);

    const tooLong = await post({ clientId: anaId, serviceId: serviceAId, startLocal: nextSlot(), utcOffsetMinutes: OFFSET, durationMinutes: 1441 });
    expect(tooLong.status).toBe(400);
  });

  it("recusa horário no passado", async () => {
    const response = await post({
      clientId: anaId,
      serviceId: serviceAId,
      startLocal: localAt(-1, "10:00"),
      utcOffsetMinutes: OFFSET,
      durationMinutes: 30,
    });
    expect(response.status).toBe(400);
    expect(response.body.message).toContain("passado");
  });

  it("recusa cliente, pet e serviço inválidos", async () => {
    const foreignClient = await post({
      clientId: carlosId,
      serviceId: serviceAId,
      startLocal: nextSlot(),
      utcOffsetMinutes: OFFSET,
      durationMinutes: 30,
    });
    expect(foreignClient.status).toBe(400);
    expect(foreignClient.body.message).toBe("Cliente não encontrado");

    const wrongPet = await post({
      clientId: brunoId,
      petId: rexId,
      serviceId: serviceAId,
      startLocal: nextSlot(),
      utcOffsetMinutes: OFFSET,
      durationMinutes: 30,
    });
    expect(wrongPet.status).toBe(400);
    expect(wrongPet.body.message).toBe("Pet não pertence ao cliente informado");

    const inactiveService = await post({
      clientId: anaId,
      serviceId: inactiveServiceAId,
      startLocal: nextSlot(),
      utcOffsetMinutes: OFFSET,
      durationMinutes: 30,
    });
    expect(inactiveService.status).toBe(400);
    expect(inactiveService.body.message).toBe("Serviço está inativo");

    const foreignService = await post({
      clientId: anaId,
      serviceId: serviceBId,
      startLocal: nextSlot(),
      utcOffsetMinutes: OFFSET,
      durationMinutes: 30,
    });
    expect(foreignService.status).toBe(400);
    expect(foreignService.body.message).toBe("Serviço não encontrado");
  });

  it("agendamento sem pet é permitido", async () => {
    const response = await post({
      clientId: brunoId,
      serviceId: serviceAId,
      startLocal: nextSlot(),
      utcOffsetMinutes: OFFSET,
      durationMinutes: 30,
    });
    expect(response.status).toBe(201);
    expect(response.body.pet).toBeNull();
    expect(response.body.petId).toBeNull();
  });
});

describe("Conflito de horário da empresa inteira", () => {
  it("sobreposição em status que ocupa horário é rejeitada (409)", async () => {
    const first = await createAppointment({
      startLocal: localAt(20, "10:00"),
      durationMinutes: 60,
    });
    expect(first.id).toBeTruthy();

    const clash = await post({
      clientId: anaId,
      serviceId: serviceAId,
      startLocal: localAt(20, "10:30"),
      utcOffsetMinutes: OFFSET,
      durationMinutes: 60,
    });
    expect(clash.status).toBe(409);
    expect(clash.body.message).toContain("Horário indisponível");
  });

  it("fim no início do próximo (back-to-back) é permitido", async () => {
    await createAppointment({ startLocal: localAt(20, "11:00"), durationMinutes: 60 });
    const next = await post({
      clientId: anaId,
      serviceId: serviceAId,
      startLocal: localAt(20, "12:00"),
      utcOffsetMinutes: OFFSET,
      durationMinutes: 60,
    });
    expect(next.status).toBe(201);
  });

  it("agendamento cancelado deixa de bloquear o horário", async () => {
    const first = await createAppointment({
      startLocal: localAt(21, "10:00"),
      durationMinutes: 60,
    });
    const cancel = await request(app.getHttpServer())
      .post(`/api/appointments/${first.id}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "Cliente remarcou" });
    expect(cancel.status).toBe(201);

    const overlapping = await post({
      clientId: brunoId,
      serviceId: serviceAId,
      startLocal: localAt(21, "10:30"),
      utcOffsetMinutes: OFFSET,
      durationMinutes: 60,
    });
    expect(overlapping.status).toBe(201);
  });

  it("agendamento concluído deixa de bloquear o horário", async () => {
    const first = await createAppointment({
      startLocal: localAt(22, "10:00"),
      durationMinutes: 60,
    });
    const done = await request(app.getHttpServer())
      .patch(`/api/appointments/${first.id}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "COMPLETED" });
    expect(done.status).toBe(200);

    const overlapping = await post({
      clientId: brunoId,
      serviceId: serviceAId,
      startLocal: localAt(22, "10:30"),
      utcOffsetMinutes: OFFSET,
      durationMinutes: 60,
    });
    expect(overlapping.status).toBe(201);
  });

  it("mesmo horário ocupado em outra empresa não gera conflito", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/appointments")
      .set("Cookie", adminBCookie)
      .send({
        clientId: carlosId,
        serviceId: serviceBId,
        startLocal: localAt(20, "10:30"),
        utcOffsetMinutes: OFFSET,
        durationMinutes: 60,
      });
    expect(response.status).toBe(201);
  });
});

describe("GET /api/appointments — lista, filtros e isolamento", () => {
  it("paginação retorna páginas distintas ordenadas por início", async () => {
    const page1 = await request(app.getHttpServer())
      .get("/api/appointments?page=1&pageSize=5")
      .set("Cookie", adminACookie);
    expect(page1.status).toBe(200);
    expect(page1.body.items).toHaveLength(5);
    expect(page1.body.total).toBeGreaterThan(5);

    const page2 = await request(app.getHttpServer())
      .get("/api/appointments?page=2&pageSize=5")
      .set("Cookie", adminACookie);
    expect(page2.status).toBe(200);

    const ids1 = page1.body.items.map((a: { id: string }) => a.id);
    const ids2 = page2.body.items.map((a: { id: string }) => a.id);
    expect(ids1.some((id: string) => ids2.includes(id))).toBe(false);

    const starts = page1.body.items.map((a: { startAt: string }) =>
      Date.parse(a.startAt),
    );
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it("filtra por período using startLocal do dia", async () => {
    const day = localDate(30);
    const created = await createAppointment({ startLocal: localAt(30, "09:00") });

    const response = await request(app.getHttpServer())
      .get(`/api/appointments?from=${day}&to=${day}`)
      .set("Cookie", adminACookie);
    expect(response.status).toBe(200);
    expect(
      response.body.items.every((a: { startLocal: string }) =>
        a.startLocal.startsWith(day),
      ),
    ).toBe(true);
    expect(
      response.body.items.some((a: { id: string }) => a.id === created.id),
    ).toBe(true);
  });

  it("filtra por status, cliente, pet e serviço", async () => {
    const doomed = await createAppointment({ startLocal: localAt(31, "09:00") });
    await request(app.getHttpServer())
      .post(`/api/appointments/${doomed.id}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "Filtro de status" });

    const cancelled = await request(app.getHttpServer())
      .get("/api/appointments?status=CANCELLED")
      .set("Cookie", adminACookie);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.items.length).toBeGreaterThan(0);
    expect(
      cancelled.body.items.every((a: { status: string }) => a.status === "CANCELLED"),
    ).toBe(true);

    const byClient = await request(app.getHttpServer())
      .get(`/api/appointments?clientId=${anaId}`)
      .set("Cookie", adminACookie);
    expect(byClient.status).toBe(200);
    expect(byClient.body.items.every((a: { clientId: string }) => a.clientId === anaId)).toBe(true);

    const byPet = await request(app.getHttpServer())
      .get(`/api/appointments?petId=${rexId}`)
      .set("Cookie", adminACookie);
    expect(byPet.status).toBe(200);
    expect(byPet.body.items.length).toBeGreaterThan(0);
    expect(byPet.body.items.every((a: { petId: string | null }) => a.petId === rexId)).toBe(true);

    const byService = await request(app.getHttpServer())
      .get(`/api/appointments?serviceId=${serviceAId}`)
      .set("Cookie", adminACookie);
    expect(byService.status).toBe(200);
    expect(byService.body.items.every((a: { serviceId: string }) => a.serviceId === serviceAId)).toBe(true);
  });

  it("busca por nome de cliente, pet ou serviço", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/appointments?search=bruno")
      .set("Cookie", adminACookie);
    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeGreaterThan(0);
    expect(
      response.body.items.every(
        (a: { client: { name: string } }) =>
          a.client.name.toLowerCase().includes("bruno"),
      ),
    ).toBe(true);
  });

  it("isolamento: empresa B não enxerga agendamentos de A e detalhe cruza com 404", async () => {
    const fromA = await createAppointment({ startLocal: localAt(32, "09:00") });

    const listB = await request(app.getHttpServer())
      .get("/api/appointments")
      .set("Cookie", adminBCookie);
    expect(listB.status).toBe(200);
    expect(
      listB.body.items.some((a: { id: string }) => a.id === fromA.id),
    ).toBe(false);

    const cross = await request(app.getHttpServer())
      .get(`/api/appointments/${fromA.id}`)
      .set("Cookie", adminBCookie);
    expect(cross.status).toBe(404);
  });

  it("valida período invertido e pageSize fora do limite", async () => {
    const inverted = await request(app.getHttpServer())
      .get(`/api/appointments?from=${localDate(5)}&to=${localDate(1)}`)
      .set("Cookie", adminACookie);
    expect(inverted.status).toBe(400);

    const tooBig = await request(app.getHttpServer())
      .get("/api/appointments?pageSize=500")
      .set("Cookie", adminACookie);
    expect(tooBig.status).toBe(400);
  });
});

describe("GET /api/appointments/:id", () => {
  it("detalha agendamento com relações e retorna 404 para id inexistente", async () => {
    const created = await createAppointment({ startLocal: localAt(33, "09:00") });

    const own = await request(app.getHttpServer())
      .get(`/api/appointments/${created.id}`)
      .set("Cookie", adminACookie);
    expect(own.status).toBe(200);
    expect(own.body.client.name).toBe("Ana Santos");
    expect(own.body.service.name).toBe("Banho e Tosa");

    const missing = await request(app.getHttpServer())
      .get("/api/appointments/nao-existe")
      .set("Cookie", adminACookie);
    expect(missing.status).toBe(404);
  });
});

describe("PATCH /api/appointments/:id — edição e reagendamento", () => {
  it("reagenda para horário livre recalculando startAt e endAt", async () => {
    const created = await createAppointment({ startLocal: localAt(34, "09:00") });
    const newStart = localAt(34, "15:00");

    const response = await request(app.getHttpServer())
      .patch(`/api/appointments/${created.id}`)
      .set("Cookie", adminACookie)
      .send({ startLocal: newStart, utcOffsetMinutes: OFFSET });

    expect(response.status).toBe(200);
    expect(response.body.startLocal).toBe(newStart);
    expect(Date.parse(response.body.startAt)).toBe(expectedStartAt(newStart));
    expect(Date.parse(response.body.endAt)).toBe(
      expectedStartAt(newStart) + 45 * 60_000,
    );
  });

  it("reagenda para horário ocupado e para o passado", async () => {
    await createAppointment({ startLocal: localAt(35, "10:00"), durationMinutes: 60 });
    const victim = await createAppointment({ startLocal: localAt(35, "16:00"), durationMinutes: 60 });

    const clash = await request(app.getHttpServer())
      .patch(`/api/appointments/${victim.id}`)
      .set("Cookie", adminACookie)
      .send({ startLocal: localAt(35, "10:30"), utcOffsetMinutes: OFFSET });
    expect(clash.status).toBe(409);

    const past = await request(app.getHttpServer())
      .patch(`/api/appointments/${victim.id}`)
      .set("Cookie", adminACookie)
      .send({ startLocal: localAt(-2, "10:00"), utcOffsetMinutes: OFFSET });
    expect(past.status).toBe(400);
    expect(past.body.message).toContain("passado");
  });

  it("trocar só startLocal deriva o fuso do registro existente", async () => {
    const created = await createAppointment({ startLocal: localAt(36, "09:00") });
    const newStart = localAt(36, "17:00");

    const response = await request(app.getHttpServer())
      .patch(`/api/appointments/${created.id}`)
      .set("Cookie", adminACookie)
      .send({ startLocal: newStart });

    expect(response.status).toBe(200);
    expect(Date.parse(response.body.startAt)).toBe(expectedStartAt(newStart));
  });

  it("alterar duração não dispara conflito consigo mesmo", async () => {
    const created = await createAppointment({ startLocal: localAt(37, "10:00"), durationMinutes: 30 });

    const response = await request(app.getHttpServer())
      .patch(`/api/appointments/${created.id}`)
      .set("Cookie", adminACookie)
      .send({ durationMinutes: 90 });

    expect(response.status).toBe(200);
    expect(response.body.durationMinutes).toBe(90);
    expect(Date.parse(response.body.endAt)).toBe(
      expectedStartAt(localAt(37, "10:00")) + 90 * 60_000,
    );
  });

  it("edita observações e troca pet por outro do mesmo cliente", async () => {
    const nina = await prisma.pet.findFirstOrThrow({
      where: { name: "Nina" },
      select: { id: true },
    });
    const created = await createAppointment({ startLocal: localAt(38, "10:00") });

    const response = await request(app.getHttpServer())
      .patch(`/api/appointments/${created.id}`)
      .set("Cookie", adminACookie)
      .send({ notes: "Cliente chega 10 min antes", petId: nina.id });

    expect(response.status).toBe(200);
    expect(response.body.notes).toBe("Cliente chega 10 min antes");
    expect(response.body.pet.name).toBe("Nina");
  });

  it("recusa pet de outro cliente em edição", async () => {
    const rexOther = rexId;
    const brunoAppointment = await createAppointment({
      clientId: brunoId,
      petId: null,
      startLocal: localAt(39, "10:00"),
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/appointments/${brunoAppointment.id}`)
      .set("Cookie", adminACookie)
      .send({ petId: rexOther });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Pet não pertence ao cliente informado");
  });

  it("agendamento encerrado não pode ser editado", async () => {
    const created = await createAppointment({ startLocal: localAt(40, "10:00") });
    await request(app.getHttpServer())
      .patch(`/api/appointments/${created.id}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "COMPLETED" });

    const response = await request(app.getHttpServer())
      .patch(`/api/appointments/${created.id}`)
      .set("Cookie", adminACookie)
      .send({ notes: "Tentativa tardia" });

    expect(response.status).toBe(409);
  });

  it("edição cruzada entre empresas retorna 404", async () => {
    const fromA = await createAppointment({ startLocal: localAt(41, "10:00") });

    const response = await request(app.getHttpServer())
      .patch(`/api/appointments/${fromA.id}`)
      .set("Cookie", adminBCookie)
      .send({ notes: "Invasão" });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/appointments/:id/status — transições", () => {
  it("confirma, conclui e registra no-show", async () => {
    const created = await createAppointment({ startLocal: localAt(42, "10:00") });

    const confirm = await request(app.getHttpServer())
      .patch(`/api/appointments/${created.id}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "CONFIRMED" });
    expect(confirm.status).toBe(200);
    expect(confirm.body.status).toBe("CONFIRMED");

    const complete = await request(app.getHttpServer())
      .patch(`/api/appointments/${created.id}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "COMPLETED" });
    expect(complete.status).toBe(200);
    expect(complete.body.status).toBe("COMPLETED");

    const noShow = await request(app.getHttpServer())
      .patch(`/api/appointments/${created.id}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "NO_SHOW" });
    expect(noShow.status).toBe(409);
  });

  it("registra no-show a partir de agendado", async () => {
    const created = await createAppointment({ startLocal: localAt(43, "10:00") });

    const response = await request(app.getHttpServer())
      .patch(`/api/appointments/${created.id}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "NO_SHOW" });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("NO_SHOW");
  });

  it("status terminal não aceita nova transição e enum é restrito", async () => {
    const created = await createAppointment({ startLocal: localAt(44, "10:00") });
    await request(app.getHttpServer())
      .patch(`/api/appointments/${created.id}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "NO_SHOW" });

    const terminal = await request(app.getHttpServer())
      .patch(`/api/appointments/${created.id}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "CONFIRMED" });
    expect(terminal.status).toBe(409);

    const invalidEnum = await request(app.getHttpServer())
      .patch(`/api/appointments/${created.id}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "CANCELLED" });
    expect(invalidEnum.status).toBe(400);
  });

  it("status cruzado entre empresas retorna 404", async () => {
    const fromA = await createAppointment({ startLocal: localAt(45, "10:00") });

    const response = await request(app.getHttpServer())
      .patch(`/api/appointments/${fromA.id}/status`)
      .set("Cookie", adminBCookie)
      .send({ status: "CONFIRMED" });

    expect(response.status).toBe(404);
  });
});

describe("POST /api/appointments/:id/cancel", () => {
  it("cancela com motivo registrado e usuário responsável", async () => {
    const created = await createAppointment({ startLocal: localAt(46, "10:00") });

    const response = await request(app.getHttpServer())
      .post(`/api/appointments/${created.id}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "Cliente desmarcou por viagem" });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("CANCELLED");
    expect(response.body.cancelReason).toBe("Cliente desmarcou por viagem");
    expect(response.body.cancelledAt).toBeTruthy();
    expect(response.body.cancelledBy.name).toBe("Admin A");
  });

  it("exige motivo com no mínimo 3 caracteres", async () => {
    const created = await createAppointment({ startLocal: localAt(47, "10:00") });

    const missing = await request(app.getHttpServer())
      .post(`/api/appointments/${created.id}/cancel`)
      .set("Cookie", adminACookie)
      .send({});
    expect(missing.status).toBe(400);

    const short = await request(app.getHttpServer())
      .post(`/api/appointments/${created.id}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "ok" });
    expect(short.status).toBe(400);
  });

  it("segundo cancelamento e cancelamento de concluído retornam 409", async () => {
    const cancelled = await createAppointment({ startLocal: localAt(48, "10:00") });
    await request(app.getHttpServer())
      .post(`/api/appointments/${cancelled.id}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "Primeira cancelada" });

    const again = await request(app.getHttpServer())
      .post(`/api/appointments/${cancelled.id}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "Segunda vez" });
    expect(again.status).toBe(409);

    const done = await createAppointment({ startLocal: localAt(48, "12:00") });
    await request(app.getHttpServer())
      .patch(`/api/appointments/${done.id}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "COMPLETED" });

    const cancelDone = await request(app.getHttpServer())
      .post(`/api/appointments/${done.id}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "Tardio" });
    expect(cancelDone.status).toBe(409);
  });

  it("cancelamento cruzado entre empresas retorna 404", async () => {
    const fromA = await createAppointment({ startLocal: localAt(49, "10:00") });

    const response = await request(app.getHttpServer())
      .post(`/api/appointments/${fromA.id}/cancel`)
      .set("Cookie", adminBCookie)
      .send({ reason: "Invasão" });

    expect(response.status).toBe(404);
  });
});

describe("Lembretes automáticos de WhatsApp (Etapa 8)", () => {
  beforeAll(async () => {
    const template = await request(app.getHttpServer())
      .post("/api/whatsapp/templates")
      .set("Cookie", adminACookie)
      .send({
        name: "lembrete_agendamento",
        language: "pt_BR",
        category: "UTILITY",
        body: "Olá {{1}}, lembramos do serviço {{2}} agendado para {{3}}.",
      });
    if (template.status !== 201) {
      throw new Error(`Template falhou: ${template.status}`);
    }
    reminderTemplateId = template.body.id;

    const approved = await request(app.getHttpServer())
      .patch(`/api/whatsapp/templates/${reminderTemplateId}`)
      .set("Cookie", adminACookie)
      .send({ approval: "APPROVED" });
    if (approved.status !== 200) {
      throw new Error(`Aprovação falhou: ${approved.status}`);
    }

    const config = await request(app.getHttpServer())
      .put("/api/whatsapp/config")
      .set("Cookie", adminACookie)
      .send({
        phoneNumberId: "1234567890",
        reminderTemplateId,
        reminderLeadMinutes: 60,
      });
    if (config.status !== 200) {
      throw new Error(`Config falhou: ${config.status} ${JSON.stringify(config.body)}`);
    }

    await request(app.getHttpServer())
      .put(`/api/whatsapp/consents/${anaId}`)
      .set("Cookie", adminACookie)
      .send({ status: "OPTED_IN", source: "MANUAL" });
  });

  it("configuração expõe template de lembrete e antecedência", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/whatsapp/config")
      .set("Cookie", adminACookie);
    expect(response.status).toBe(200);
    expect(response.body.reminderTemplateId).toBe(reminderTemplateId);
    expect(response.body.reminderLeadMinutes).toBe(60);
  });

  it("rejeita template com variáveis diferentes de 3 ou de outra empresa", async () => {
    const oneVar = await request(app.getHttpServer())
      .post("/api/whatsapp/templates")
      .set("Cookie", adminACookie)
      .send({ name: "lembrete_uma_variavel", body: "Olá {{1}}, tudo bem?" });
    expect(oneVar.status).toBe(201);

    const badCount = await request(app.getHttpServer())
      .put("/api/whatsapp/config")
      .set("Cookie", adminACookie)
      .send({ reminderTemplateId: oneVar.body.id });
    expect(badCount.status).toBe(400);
    expect(badCount.body.message).toContain("3 variáveis");

    const foreignTemplate = await request(app.getHttpServer())
      .post("/api/whatsapp/templates")
      .set("Cookie", adminBCookie)
      .send({
        name: "lembrete_b",
        body: "Olá {{1}}, serviço {{2}} em {{3}}.",
      });
    expect(foreignTemplate.status).toBe(201);

    const foreign = await request(app.getHttpServer())
      .put("/api/whatsapp/config")
      .set("Cookie", adminACookie)
      .send({ reminderTemplateId: foreignTemplate.body.id });
    expect(foreign.status).toBe(400);
    expect(foreign.body.message).toBe("Template de lembrete não encontrado");
  });

  it("rejeita antecedência fora do intervalo de 5 a 40320 minutos", async () => {
    const tooSmall = await request(app.getHttpServer())
      .put("/api/whatsapp/config")
      .set("Cookie", adminACookie)
      .send({ reminderLeadMinutes: 3 });
    expect(tooSmall.status).toBe(400);

    const tooBig = await request(app.getHttpServer())
      .put("/api/whatsapp/config")
      .set("Cookie", adminACookie)
      .send({ reminderLeadMinutes: 40321 });
    expect(tooBig.status).toBe(400);
  });

  it("cria mensagem PENDING única com variáveis derivadas do horário local", async () => {
    const startLocal = localAt(50, "10:00");
    const created = await createAppointment({ startLocal });

    const message = await reminderOf(created.id);
    expect(message).not.toBeNull();
    expect(message!.status).toBe("PENDING");
    expect(message!.origin).toBe("SERVICE_REMINDER");
    expect(message!.idempotencyKey).toBe(`appointment-reminder:${created.id}`);
    expect(message!.toPhone).toBe("5511999998888");
    expect(message!.nextAttemptAt?.getTime()).toBe(expectedStartAt(startLocal) - 60 * 60_000);

    const variables = message!.variables as string[];
    expect(variables[0]).toBe("Rex");
    expect(variables[1]).toBe("Banho e Tosa");
    const [datePart, timePart] = startLocal.split("T");
    const [year, month, day] = datePart.split("-");
    expect(variables[2]).toBe(`${day}/${month}/${year} às ${timePart}`);
  });

  it("cliente sem consentimento não gera mensagem de lembrete", async () => {
    const created = await createAppointment({
      clientId: brunoId,
      petId: null,
      startLocal: localAt(51, "10:00"),
    });

    const message = await reminderOf(created.id);
    expect(message).toBeNull();
  });

  it("reagendar atualiza a mesma mensagem pendente em vez de duplicar", async () => {
    const created = await createAppointment({ startLocal: localAt(52, "10:00") });
    const first = await reminderOf(created.id);
    expect(first).not.toBeNull();

    const newStart = localAt(52, "16:00");
    const rescheduled = await request(app.getHttpServer())
      .patch(`/api/appointments/${created.id}`)
      .set("Cookie", adminACookie)
      .send({ startLocal: newStart, utcOffsetMinutes: OFFSET });
    expect(rescheduled.status).toBe(200);

    const updated = await reminderOf(created.id);
    expect(updated!.id).toBe(first!.id);
    expect(updated!.status).toBe("PENDING");
    expect(updated!.nextAttemptAt?.getTime()).toBe(
      expectedStartAt(newStart) - 60 * 60_000,
    );
    const variables = updated!.variables as string[];
    expect(variables[2]).toContain("às 16:00");

    const count = await prisma.whatsAppMessage.count({
      where: { idempotencyKey: `appointment-reminder:${created.id}` },
    });
    expect(count).toBe(1);
  });

  it("confirmar agendamento mantém a mensagem pendente", async () => {
    const created = await createAppointment({ startLocal: localAt(53, "10:00") });

    const confirm = await request(app.getHttpServer())
      .patch(`/api/appointments/${created.id}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "CONFIRMED" });
    expect(confirm.status).toBe(200);

    const message = await reminderOf(created.id);
    expect(message!.status).toBe("PENDING");
  });

  it("cancelar e concluir agendamento cancelam a mensagem pendente", async () => {
    const cancelled = await createAppointment({ startLocal: localAt(54, "10:00") });
    await request(app.getHttpServer())
      .post(`/api/appointments/${cancelled.id}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "Lembrete junto" });

    const cancelledMessage = await reminderOf(cancelled.id);
    expect(cancelledMessage!.status).toBe("CANCELLED");
    expect(cancelledMessage!.cancelReason).toBe("Agendamento cancelado");

    const completed = await createAppointment({ startLocal: localAt(54, "12:00") });
    await request(app.getHttpServer())
      .patch(`/api/appointments/${completed.id}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "COMPLETED" });

    const completedMessage = await reminderOf(completed.id);
    expect(completedMessage!.status).toBe("CANCELLED");
    expect(completedMessage!.cancelReason).toBe("Agendamento encerrado");
  });

  it("template não aprovado é recusado na avaliação do lembrete", async () => {
    const pending = await request(app.getHttpServer())
      .post("/api/whatsapp/templates")
      .set("Cookie", adminACookie)
      .send({
        name: "lembrete_pendente",
        body: "Olá {{1}}, serviço {{2}} em {{3}}.",
      });
    expect(pending.status).toBe(201);

    await request(app.getHttpServer())
      .put("/api/whatsapp/config")
      .set("Cookie", adminACookie)
      .send({ reminderTemplateId: pending.body.id });
    const created = await createAppointment({ startLocal: localAt(55, "10:00") });
    expect(await reminderOf(created.id)).toBeNull();

    await request(app.getHttpServer())
      .put("/api/whatsapp/config")
      .set("Cookie", adminACookie)
      .send({ reminderTemplateId, reminderLeadMinutes: 60 });
  });

  it("opt-out do cliente impede novo lembrete", async () => {
    await request(app.getHttpServer())
      .put(`/api/whatsapp/consents/${anaId}`)
      .set("Cookie", adminACookie)
      .send({ status: "OPTED_OUT", source: "MANUAL" });

    try {
      const created = await createAppointment({ startLocal: localAt(56, "10:00") });
      expect(await reminderOf(created.id)).toBeNull();
    } finally {
      await request(app.getHttpServer())
        .put(`/api/whatsapp/consents/${anaId}`)
        .set("Cookie", adminACookie)
        .send({ status: "OPTED_IN", source: "MANUAL" });
    }
  });
});
