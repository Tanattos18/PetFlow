import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createHash, createHmac } from "node:crypto";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp, resetDatabase, sessionCookieFrom } from "./helpers/app";
import type { PrismaService } from "../apps/api/src/prisma/prisma.module";
import { WhatsAppProviderService } from "../apps/api/src/whatsapp/whatsapp-provider.service";
import { processDueMessages } from "../apps/worker/src/whatsapp/processor";
import {
  MetaCloudProvider,
  MockWhatsAppProvider,
  classifyHttpStatus,
  isOptOutText,
  nextBackoffMs,
  toE164,
  type WhatsAppProvider,
} from "@petflow/whatsapp";

const PASSWORD = "SenhaForte123!";
const VERIFY_TOKEN = "petflow-test-verify-token";
const APP_SECRET = "petflow-test-app-secret";
const PHONE_NUMBER_ID = "1234567890";

let app: INestApplication;
let prisma: PrismaService;
let providerService: WhatsAppProviderService;

let adminACookie: string;
let memberACookie: string;
let adminBCookie: string;

let anaId: string;
let brunoId: string;
let dudaId: string;
let carlosId: string;
let t1Id: string;
let t2Id: string;

let keyCounter = 0;

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

async function findMessage(id: string) {
  const message = await prisma.whatsAppMessage.findUnique({ where: { id } });
  if (!message) throw new Error(`Mensagem ${id} não encontrada`);
  return message;
}

async function setConsent(
  clientId: string,
  status: "OPTED_IN" | "OPTED_OUT",
  cookie = adminACookie,
): Promise<void> {
  const response = await request(app.getHttpServer())
    .put(`/api/whatsapp/consents/${clientId}`)
    .set("Cookie", cookie)
    .send({ status, source: "MANUAL" });
  if (response.status > 299) {
    throw new Error(
      `Consentimento ${status} falhou: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }
}

async function enqueue(): Promise<string> {
  keyCounter += 1;
  const response = await request(app.getHttpServer())
    .post("/api/whatsapp/messages")
    .set("Cookie", adminACookie)
    .send({
      clientId: anaId,
      templateId: t1Id,
      variables: ["Ana", "Rex"],
      idempotencyKey: `e6-q-${Date.now()}-${keyCounter}`,
    });
  if (response.status !== 201) {
    throw new Error(`Enfileiramento falhou: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.id as string;
}

async function process(
  provider: WhatsAppProvider,
  options: { now?: Date; maxPerCycle?: number } = {},
) {
  const nowDate = options.now;
  const maxPerCycle = options.maxPerCycle;
  return processDueMessages({
    prisma,
    provider,
    intervalMs: 0,
    sleep: async () => {},
    ...(nowDate ? { now: () => nowDate } : {}),
    ...(maxPerCycle !== undefined ? { maxPerCycle } : {}),
  });
}

function sign(raw: string): string {
  return `sha256=${createHmac("sha256", APP_SECRET).update(raw).digest("hex")}`;
}

async function postWebhook(raw: string, signature?: string) {
  const req = request(app.getHttpServer())
    .post("/api/webhooks/whatsapp")
    .set("Content-Type", "application/json");
  if (signature !== undefined) req.set("X-Hub-Signature-256", signature);
  return req.send(raw);
}

function statusPayload(status: string, wamid: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-e6",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: PHONE_NUMBER_ID },
              statuses: [{ id: wamid, status, ...extra }],
            },
          },
        ],
      },
    ],
  });
}

function inboundPayload(body: string) {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-e6",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: PHONE_NUMBER_ID },
              messages: [
                { id: "wamid.INBOUND1", from: "5511999998888", type: "text", text: { body } },
              ],
            },
          },
        ],
      },
    ],
  });
}

async function acceptedMessage(): Promise<{ id: string; wamid: string }> {
  const id = await enqueue();
  await process(new MockWhatsAppProvider());
  const message = await findMessage(id);
  if (message.status !== "ACCEPTED" || !message.providerMessageId) {
    throw new Error(`Mensagem ${id} não foi aceita (status=${message.status})`);
  }
  return { id, wamid: message.providerMessageId };
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;
  providerService = app.get(WhatsAppProviderService);

  await resetDatabase(prisma);

  const companyA = await createCompany("whatsapp-a");
  const companyB = await createCompany("whatsapp-b");

  await createUser({
    companyId: companyA.id,
    name: "Admin A",
    email: "admin@whatsapp-a.test",
    role: "ADMIN",
  });
  await createUser({
    companyId: companyA.id,
    name: "Membro A",
    email: "membro@whatsapp-a.test",
  });
  await createUser({
    companyId: companyB.id,
    name: "Admin B",
    email: "admin@whatsapp-b.test",
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
    data: { companyId: companyA.id, name: "Bruno Lima", nameKey: "bruno lima" },
  });
  brunoId = bruno.id;

  const duda = await prisma.client.create({
    data: {
      companyId: companyA.id,
      name: "Duda Prado",
      nameKey: "duda prado",
      phone: "11955554444",
    },
  });
  dudaId = duda.id;

  const carlos = await prisma.client.create({
    data: {
      companyId: companyB.id,
      name: "Carlos Souza",
      nameKey: "carlos souza",
      phone: "21988887777",
    },
  });
  carlosId = carlos.id;

  adminACookie = await login("admin@whatsapp-a.test");
  memberACookie = await login("membro@whatsapp-a.test");
  adminBCookie = await login("admin@whatsapp-b.test");
});

afterEach(() => {
  providerService.setProvider(null);
  providerService.setProviderConfig(null);
});

afterAll(async () => {
  await app.close();
});

describe("Utilitários do adaptador (unidade)", () => {
  it("normaliza telefones para E.164 e recusa números inválidos", () => {
    expect(toE164("11999998888")).toBe("5511999998888");
    expect(toE164("(11) 99999-8888")).toBe("5511999998888");
    expect(toE164("+55 11 99999-8888")).toBe("5511999998888");
    expect(toE164("5511999998888")).toBe("5511999998888");
    expect(toE164("011999998888")).toBe("5511999998888");
    expect(toE164("999998888")).toBeNull();
    expect(toE164("")).toBeNull();
  });

  it("classifica HTTP 429/5xx como transitório e demais 4xx como permanente", () => {
    expect(classifyHttpStatus(429)).toBe("TRANSIENT");
    expect(classifyHttpStatus(408)).toBe("TRANSIENT");
    expect(classifyHttpStatus(503)).toBe("TRANSIENT");
    expect(classifyHttpStatus(400)).toBe("PERMANENT");
    expect(classifyHttpStatus(401)).toBe("PERMANENT");
    expect(classifyHttpStatus(404)).toBe("PERMANENT");
  });

  it("aplica backoff exponencial com teto de 5 minutos", () => {
    expect(nextBackoffMs(1)).toBe(5_000);
    expect(nextBackoffMs(2)).toBe(10_000);
    expect(nextBackoffMs(3)).toBe(20_000);
    expect(nextBackoffMs(10)).toBe(300_000);
    expect(nextBackoffMs(99)).toBe(300_000);
  });

  it("reconhece palavras de descadastro (opt-out)", () => {
    expect(isOptOutText("SAIR")).toBe(true);
    expect(isOptOutText("sair")).toBe(true);
    expect(isOptOutText("  STOP  ")).toBe(true);
    expect(isOptOutText("cancelar")).toBe(true);
    expect(isOptOutText("quero mais informações")).toBe(false);
    expect(isOptOutText("oi")).toBe(false);
  });
});

describe("Configuração — status, permissões e isolamento", () => {
  it("sem configuração retorna NOT_CONFIGURED com estado do provedor", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/whatsapp/config")
      .set("Cookie", adminACookie);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("NOT_CONFIGURED");
    expect(response.body.phoneNumberId).toBeNull();
    expect(response.body.provider.provider).toBe("mock");
    expect(response.body.webhook.path).toBe("/api/webhooks/whatsapp");
    expect(response.body.webhook.verifyConfigured).toBe(true);
    expect(response.body.webhook.signatureConfigured).toBe(true);
  });

  it("leitura permitida para MEMBER e escrita restrita a ADMIN", async () => {
    const read = await request(app.getHttpServer())
      .get("/api/whatsapp/config")
      .set("Cookie", memberACookie);
    expect(read.status).toBe(200);

    const write = await request(app.getHttpServer())
      .put("/api/whatsapp/config")
      .set("Cookie", memberACookie)
      .send({ phoneNumberId: PHONE_NUMBER_ID });
    expect(write.status).toBe(403);
    expect(write.body.message).toBe("Permissão administrativa necessária");
  });

  it("ADMIN salva a configuração e ela passa a aparecer como CONFIGURED", async () => {
    const created = await request(app.getHttpServer())
      .put("/api/whatsapp/config")
      .set("Cookie", adminACookie)
      .send({ phoneNumberId: PHONE_NUMBER_ID, displayName: "Pet Shop A" });
    expect(created.status).toBe(200);
    expect(created.body.phoneNumberId).toBe(PHONE_NUMBER_ID);

    const read = await request(app.getHttpServer())
      .get("/api/whatsapp/config")
      .set("Cookie", adminACookie);
    expect(read.body.status).toBe("CONFIGURED");
    expect(read.body.displayName).toBe("Pet Shop A");
    expect(read.body.lastError).toBeNull();
  });

  it("outra empresa não enxerga a configuração da primeira (isolamento)", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/whatsapp/config")
      .set("Cookie", adminBCookie);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("NOT_CONFIGURED");
    expect(response.body.phoneNumberId).toBeNull();
    expect(response.body.displayName).toBeNull();
  });

  it("desconectar e religar a integração exige ADMIN", async () => {
    const member = await request(app.getHttpServer())
      .patch("/api/whatsapp/config/status")
      .set("Cookie", memberACookie)
      .send({ status: "DISCONNECTED" });
    expect(member.status).toBe(403);

    const disconnect = await request(app.getHttpServer())
      .patch("/api/whatsapp/config/status")
      .set("Cookie", adminACookie)
      .send({ status: "DISCONNECTED" });
    expect(disconnect.status).toBe(200);
    expect(disconnect.body.status).toBe("DISCONNECTED");

    const reconnect = await request(app.getHttpServer())
      .patch("/api/whatsapp/config/status")
      .set("Cookie", adminACookie)
      .send({ status: "CONFIGURED" });
    expect(reconnect.status).toBe(200);
    expect(reconnect.body.status).toBe("CONFIGURED");
  });

  it("empresa sem configuração não pode alterar status (404)", async () => {
    const response = await request(app.getHttpServer())
      .patch("/api/whatsapp/config/status")
      .set("Cookie", adminBCookie)
      .send({ status: "DISCONNECTED" });
    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Integração não configurada");
  });
});

describe("Teste de saúde — credenciais e credenciais ausentes", () => {
  it("sem credenciais no servidor retorna 400 e não altera o status", async () => {
    providerService.setProviderConfig({ provider: "meta" });

    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/config/health")
      .set("Cookie", adminACookie);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Credenciais do provedor não configuradas no servidor",
    );

    const config = await prisma.whatsAppConfig.findFirst({
      where: { phoneNumberId: PHONE_NUMBER_ID },
    });
    expect(config?.status).toBe("CONFIGURED");
  });

  it("credencial inválida marca ERROR sem vazar o token na resposta", async () => {
    providerService.setProvider(
      new MetaCloudProvider({
        accessToken: "tokensecreto123",
        fetchImpl: async () => ({
          status: 401,
          ok: false,
          json: async () => ({
            error: {
              message: "Invalid OAuth access token tokensecreto123",
              code: 190,
            },
          }),
          text: async () => "",
        }),
      }),
    );

    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/config/health")
      .set("Cookie", adminACookie);
    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(false);
    expect(response.body.status).toBe("ERROR");
    expect(JSON.stringify(response.body)).not.toContain("tokensecreto123");

    const config = await prisma.whatsAppConfig.findFirst({
      where: { phoneNumberId: PHONE_NUMBER_ID },
    });
    expect(config?.status).toBe("ERROR");
    expect(config?.lastError ?? "").not.toContain("tokensecreto123");
  });

  it("provedor saudável torna a integração ACTIVE", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/config/health")
      .set("Cookie", adminACookie);
    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(true);
    expect(response.body.status).toBe("ACTIVE");
    expect(response.body.verifiedName).toBe("PetFlow Mock");

    const config = await prisma.whatsAppConfig.findFirst({
      where: { phoneNumberId: PHONE_NUMBER_ID },
    });
    expect(config?.status).toBe("ACTIVE");
    expect(config?.lastHealthAt).not.toBeNull();
  });

  it("empresa sem integração recebe 400 no teste de saúde", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/config/health")
      .set("Cookie", adminBCookie);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Configure a integração antes de testar");
  });
});

describe("Templates — validação, aprovação e permissões", () => {
  it("MEMBER não pode criar template", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/templates")
      .set("Cookie", memberACookie)
      .send({ name: "lembrete_pet", body: "Olá!" });
    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Permissão administrativa necessária");
  });

  it("cria template com aprovação nunca presumida", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/templates")
      .set("Cookie", adminACookie)
      .send({
        name: "lembrete_pet",
        language: "pt_BR",
        category: "UTILITY",
        body: "Olá {{1}}, seu pet {{2}} aguarda pelo próximo banho.",
      });
    expect(response.status).toBe(201);
    expect(response.body.approval).toBe("PENDING_APPROVAL");
    expect(response.body.status).toBe("ACTIVE");
    t1Id = response.body.id;
  });

  it("nome duplicado na mesma empresa é rejeitado", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/templates")
      .set("Cookie", adminACookie)
      .send({ name: "lembrete_pet", body: "Outro corpo" });
    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "Já existe um template com este nome nesta empresa",
    );
  });

  it("nome fora do padrão do provedor é rejeitado", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/templates")
      .set("Cookie", adminACookie)
      .send({ name: "LembretePet", body: "Olá" });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Dados inválidos");
  });

  it("variáveis fora de sequência são rejeitadas", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/templates")
      .set("Cookie", adminACookie)
      .send({ name: "corpo_invalido", body: "Olá {{2}}" });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Dados inválidos");
    expect(JSON.stringify(response.body)).toContain("sequenciais");
  });

  it("idioma inválido é rejeitado", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/templates")
      .set("Cookie", adminACookie)
      .send({ name: "idioma_ruim", language: "portugues", body: "Olá" });
    expect(response.status).toBe(400);
  });

  it("aprovação é registrada apenas por ADMIN", async () => {
    const member = await request(app.getHttpServer())
      .patch(`/api/whatsapp/templates/${t1Id}`)
      .set("Cookie", memberACookie)
      .send({ approval: "APPROVED" });
    expect(member.status).toBe(403);

    const admin = await request(app.getHttpServer())
      .patch(`/api/whatsapp/templates/${t1Id}`)
      .set("Cookie", adminACookie)
      .send({ approval: "APPROVED" });
    expect(admin.status).toBe(200);
    expect(admin.body.approval).toBe("APPROVED");
  });

  it("cria um segundo template ainda não aprovado", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/templates")
      .set("Cookie", adminACookie)
      .send({ name: "promo_natal", body: "Promoção de natal para seu pet!" });
    expect(response.status).toBe(201);
    expect(response.body.approval).toBe("PENDING_APPROVAL");
    t2Id = response.body.id;
  });

  it("lista filtra por aprovação e isola empresas", async () => {
    const listA = await request(app.getHttpServer())
      .get("/api/whatsapp/templates")
      .set("Cookie", adminACookie);
    expect(listA.status).toBe(200);
    expect(listA.body.total).toBe(2);

    const pending = await request(app.getHttpServer())
      .get("/api/whatsapp/templates")
      .query({ approval: "PENDING_APPROVAL" })
      .set("Cookie", adminACookie);
    expect(pending.body.total).toBe(1);
    expect(pending.body.items[0].name).toBe("promo_natal");

    const listB = await request(app.getHttpServer())
      .get("/api/whatsapp/templates")
      .set("Cookie", adminBCookie);
    expect(listB.body.total).toBe(0);
  });
});

describe("Consentimento — privacidade e permissões", () => {
  it("MEMBER não pode registrar opt-in, mas pode registrar opt-out", async () => {
    const denied = await request(app.getHttpServer())
      .put(`/api/whatsapp/consents/${anaId}`)
      .set("Cookie", memberACookie)
      .send({ status: "OPTED_IN", source: "MANUAL" });
    expect(denied.status).toBe(403);
    expect(denied.body.message).toBe(
      "Apenas administradores podem registrar consentimento proativo",
    );

    const allowed = await request(app.getHttpServer())
      .put(`/api/whatsapp/consents/${anaId}`)
      .set("Cookie", memberACookie)
      .send({ status: "OPTED_OUT", source: "MANUAL" });
    expect(allowed.status).toBe(200);
    expect(allowed.body.status).toBe("OPTED_OUT");
  });

  it("ADMIN registra opt-in com telefone normalizado E.164", async () => {
    const response = await request(app.getHttpServer())
      .put(`/api/whatsapp/consents/${anaId}`)
      .set("Cookie", adminACookie)
      .send({ status: "OPTED_IN", source: "MANUAL" });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("OPTED_IN");
    expect(response.body.source).toBe("MANUAL");
    expect(response.body.phone).toBe("5511999998888");
    expect(response.body.client.name).toBe("Ana Santos");
  });

  it("consentimento de cliente de outra empresa não é acessível", async () => {
    const cross = await request(app.getHttpServer())
      .put(`/api/whatsapp/consents/${carlosId}`)
      .set("Cookie", adminACookie)
      .send({ status: "OPTED_IN", source: "MANUAL" });
    expect(cross.status).toBe(404);
    expect(cross.body.message).toBe("Cliente não encontrado");

    const read = await request(app.getHttpServer())
      .get(`/api/whatsapp/consents/${carlosId}`)
      .set("Cookie", adminACookie);
    expect(read.status).toBe(200);
    expect(read.body).toEqual({});
  });

  it("listagem isola empresas", async () => {
    const listA = await request(app.getHttpServer())
      .get("/api/whatsapp/consents")
      .set("Cookie", adminACookie);
    expect(listA.body.total).toBe(1);

    const listB = await request(app.getHttpServer())
      .get("/api/whatsapp/consents")
      .set("Cookie", adminBCookie);
    expect(listB.body.total).toBe(0);
  });
});

describe("Enfileiramento de mensagens — validações do servidor", () => {
  it("empresa sem integração configurada recebe 409", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/messages")
      .set("Cookie", adminBCookie)
      .send({ clientId: carlosId, templateId: t1Id, variables: ["a", "b"] });
    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Integração não configurada");
  });

  it("cliente sem consentimento registrado é bloqueado", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/messages")
      .set("Cookie", adminACookie)
      .send({ clientId: dudaId, templateId: t1Id, variables: ["a", "b"] });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Cliente sem consentimento registrado para mensagens",
    );
  });

  it("cliente sem telefone válido é bloqueado", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/messages")
      .set("Cookie", adminACookie)
      .send({ clientId: brunoId, templateId: t1Id, variables: ["a", "b"] });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Cliente sem telefone válido para WhatsApp",
    );
  });

  it("cliente inexistente em outra empresa é 404", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/messages")
      .set("Cookie", adminACookie)
      .send({ clientId: carlosId, templateId: t1Id, variables: ["a", "b"] });
    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Cliente não encontrado");
  });

  it("template sem aprovação do provedor é rejeitado", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/messages")
      .set("Cookie", adminACookie)
      .send({ clientId: anaId, templateId: t2Id, variables: [] });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Template ainda não tem aprovação registrada do provedor",
    );
  });

  it("descadastro ativo bloqueia novos envios", async () => {
    await setConsent(anaId, "OPTED_OUT");

    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/messages")
      .set("Cookie", adminACookie)
      .send({ clientId: anaId, templateId: t1Id, variables: ["Ana", "Rex"] });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Cliente realizou descadastro — novos envios bloqueados",
    );

    await setConsent(anaId, "OPTED_IN");
  });

  it("quantidade de variáveis precisa bater com o corpo do template", async () => {
    const missing = await request(app.getHttpServer())
      .post("/api/whatsapp/messages")
      .set("Cookie", adminACookie)
      .send({ clientId: anaId, templateId: t1Id, variables: ["Ana"] });
    expect(missing.status).toBe(400);
    expect(missing.body.message).toBe("Este template exige 2 variável(is)");

    const extra = await request(app.getHttpServer())
      .post("/api/whatsapp/messages")
      .set("Cookie", adminACookie)
      .send({ clientId: anaId, templateId: t1Id, variables: ["a", "b", "c"] });
    expect(extra.status).toBe(400);
    expect(extra.body.message).toBe("Este template exige 2 variável(is)");
  });

  it("MEMBER não pode enviar mensagens", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/messages")
      .set("Cookie", memberACookie)
      .send({ clientId: anaId, templateId: t1Id, variables: ["Ana", "Rex"] });
    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Permissão administrativa necessária");
  });

  it("template inativo bloqueia o envio", async () => {
    await request(app.getHttpServer())
      .patch(`/api/whatsapp/templates/${t1Id}`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });

    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/messages")
      .set("Cookie", adminACookie)
      .send({ clientId: anaId, templateId: t1Id, variables: ["Ana", "Rex"] });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Template está inativo");

    await request(app.getHttpServer())
      .patch(`/api/whatsapp/templates/${t1Id}`)
      .set("Cookie", adminACookie)
      .send({ status: "ACTIVE" });
  });

  it("integração desconectada bloqueia novos envios", async () => {
    await request(app.getHttpServer())
      .patch("/api/whatsapp/config/status")
      .set("Cookie", adminACookie)
      .send({ status: "DISCONNECTED" });

    const response = await request(app.getHttpServer())
      .post("/api/whatsapp/messages")
      .set("Cookie", adminACookie)
      .send({ clientId: anaId, templateId: t1Id, variables: ["Ana", "Rex"] });
    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Integração desconectada");

    await request(app.getHttpServer())
      .patch("/api/whatsapp/config/status")
      .set("Cookie", adminACookie)
      .send({ status: "CONFIGURED" });
  });

  it("idempotência: mesma chave cria apenas uma mensagem", async () => {
    const payload = {
      clientId: anaId,
      templateId: t1Id,
      variables: ["Ana", "Rex"],
      idempotencyKey: "e6-idem-001",
    };

    const first = await request(app.getHttpServer())
      .post("/api/whatsapp/messages")
      .set("Cookie", adminACookie)
      .send(payload);
    expect(first.status).toBe(201);
    expect(first.body.status).toBe("PENDING");
    expect(first.body.toPhone).toBe("5511999998888");
    expect(first.body.origin).toBe("MANUAL");

    const second = await request(app.getHttpServer())
      .post("/api/whatsapp/messages")
      .set("Cookie", adminACookie)
      .send(payload);
    expect(second.status).toBe(409);
    expect(second.body.message).toContain("idempotencyKey");

    const count = await prisma.whatsAppMessage.count({
      where: { idempotencyKey: "e6-idem-001" },
    });
    expect(count).toBe(1);
  });

  it("lista isola empresas, filtra status e aceita busca por período", async () => {
    const listA = await request(app.getHttpServer())
      .get("/api/whatsapp/messages")
      .set("Cookie", adminACookie);
    expect(listA.status).toBe(200);
    expect(listA.body.total).toBeGreaterThan(0);

    const pending = await request(app.getHttpServer())
      .get("/api/whatsapp/messages")
      .query({ status: "PENDING" })
      .set("Cookie", adminACookie);
    expect(pending.body.items.every((m: { status: string }) => m.status === "PENDING")).toBe(true);

    const byPeriod = await request(app.getHttpServer())
      .get("/api/whatsapp/messages")
      .query({ from: "2020-01-01", to: "2030-12-31" })
      .set("Cookie", adminACookie);
    expect(byPeriod.body.total).toBe(listA.body.total);

    const listB = await request(app.getHttpServer())
      .get("/api/whatsapp/messages")
      .set("Cookie", adminBCookie);
    expect(listB.body.total).toBe(0);

    const memberRead = await request(app.getHttpServer())
      .get("/api/whatsapp/messages")
      .set("Cookie", memberACookie);
    expect(memberRead.status).toBe(200);
  });

  it("detalhe de mensagem não vaza para outra empresa", async () => {
    const list = await request(app.getHttpServer())
      .get("/api/whatsapp/messages")
      .set("Cookie", adminACookie);
    const id = list.body.items[0].id as string;

    const cross = await request(app.getHttpServer())
      .get(`/api/whatsapp/messages/${id}`)
      .set("Cookie", adminBCookie);
    expect(cross.status).toBe(404);
    expect(cross.body.message).toBe("Mensagem não encontrada");
  });
});

describe("Fila persistente — processamento pelo worker", () => {
  beforeEach(async () => {
    await prisma.whatsAppWebhookEvent.deleteMany();
    await prisma.whatsAppMessageAttempt.deleteMany();
    await prisma.whatsAppMessage.deleteMany();
    await prisma.whatsAppConsent.updateMany({ data: { status: "OPTED_IN" } });
    await prisma.whatsAppConfig.updateMany({
      data: { status: "CONFIGURED", lastError: null },
    });
  });

  it("aceita no provedor sem nunca marcar como entregue", async () => {
    const id = await enqueue();
    const provider = new MockWhatsAppProvider();

    const result = await process(provider);
    expect(result.claimed).toBe(1);
    expect(result.accepted).toBe(1);
    expect(provider.sendCount).toBe(1);

    const message = await findMessage(id);
    expect(message.status).toBe("ACCEPTED");
    expect(message.attempts).toBe(1);
    expect(message.providerMessageId).toMatch(/^wamid\./);
    expect(message.status).not.toBe("SENT");
    expect(message.status).not.toBe("DELIVERED");
    expect(message.status).not.toBe("READ");
    expect(message.nextAttemptAt).toBeNull();

    const attempts = await prisma.whatsAppMessageAttempt.findMany({
      where: { messageId: id },
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].outcome).toBe("ACCEPTED");
    expect(attempts[0].providerMessageId).toBe(message.providerMessageId);

    const detail = await request(app.getHttpServer())
      .get(`/api/whatsapp/messages/${id}`)
      .set("Cookie", adminACookie);
    expect(detail.status).toBe(200);
    expect(detail.body.attemptsLog).toHaveLength(1);
    expect(detail.body.attemptsLog[0].outcome).toBe("ACCEPTED");
  });

  it("processamento concorrente envia apenas uma vez (claim atômico)", async () => {
    const id = await enqueue();
    const provider = new MockWhatsAppProvider();
    const deps = { prisma, provider, intervalMs: 0, sleep: async () => {} };

    const [first, second] = await Promise.all([
      processDueMessages(deps),
      processDueMessages(deps),
    ]);

    expect(provider.sendCount).toBe(1);
    expect(first.claimed + second.claimed).toBe(1);
    expect(first.accepted + second.accepted).toBe(1);

    const message = await findMessage(id);
    expect(message.status).toBe("ACCEPTED");
    expect(message.attempts).toBe(1);
  });

  it("erro transitório reagenda com backoff e depois aceita", async () => {
    const id = await enqueue();
    const provider = new MockWhatsAppProvider({ failureMode: "transient", failureTimes: 1 });

    const first = await process(provider);
    expect(first.retried).toBe(1);
    expect(first.failed).toBe(0);

    const afterFirst = await findMessage(id);
    expect(afterFirst.status).toBe("PENDING");
    expect(afterFirst.attempts).toBe(1);
    expect(afterFirst.nextAttemptAt).not.toBeNull();
    if (!afterFirst.nextAttemptAt) throw new Error("nextAttemptAt deveria estar preenchido");
    expect(afterFirst.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());

    const attempt = await prisma.whatsAppMessageAttempt.findFirst({
      where: { messageId: id },
    });
    expect(attempt?.outcome).toBe("TRANSIENT_ERROR");
    expect(attempt?.errorCode).toBe("MOCK_TRANSIENT");
    expect(attempt?.httpStatus).toBe(503);

    const future = new Date(Date.now() + 60_000);
    const second = await process(provider, { now: future });
    expect(second.accepted).toBe(1);

    const done = await findMessage(id);
    expect(done.status).toBe("ACCEPTED");
    expect(done.attempts).toBe(2);
    expect(done.providerMessageId).toMatch(/^wamid\./);
    expect(provider.sendCount).toBe(2);
  });

  it("esgota tentativas e falha sem repetir indefinidamente", async () => {
    const id = await enqueue();
    const provider = new MockWhatsAppProvider({ failureMode: "transient" });

    for (let round = 1; round <= 3; round += 1) {
      const now = new Date(Date.now() + round * 400_000);
      await process(provider, { now });
    }

    const failed = await findMessage(id);
    expect(failed.status).toBe("FAILED");
    expect(failed.attempts).toBe(3);
    expect(failed.nextAttemptAt).toBeNull();
    expect(failed.failureReason).toBe("MOCK_TRANSIENT");

    const attempts = await prisma.whatsAppMessageAttempt.findMany({
      where: { messageId: id },
    });
    expect(attempts).toHaveLength(3);
    expect(attempts.every((a) => a.outcome === "TRANSIENT_ERROR")).toBe(true);

    const extra = await process(provider, { now: new Date(Date.now() + 2_000_000) });
    expect(extra.due).toBe(0);
    expect(provider.sendCount).toBe(3);
  });

  it("erro permanente falha imediatamente, sem retentativa", async () => {
    const id = await enqueue();
    const provider = new MockWhatsAppProvider({ failureMode: "permanent" });

    const result = await process(provider);
    expect(result.failed).toBe(1);
    expect(result.retried).toBe(0);

    const message = await findMessage(id);
    expect(message.status).toBe("FAILED");
    expect(message.attempts).toBe(1);
    expect(message.failureReason).toBe("MOCK_PERMANENT");
    expect(message.failureDetail).toContain("permanente");
    expect(message.nextAttemptAt).toBeNull();
    expect(provider.sendCount).toBe(1);
  });

  it("descadastro entre enfileirar e enviar cancela o envio", async () => {
    const id = await enqueue();
    await setConsent(anaId, "OPTED_OUT");

    const provider = new MockWhatsAppProvider();
    const result = await process(provider);
    expect(result.cancelled).toBe(1);
    expect(provider.sendCount).toBe(0);

    const message = await findMessage(id);
    expect(message.status).toBe("CANCELLED");
    expect(message.cancelReason).toContain("descadastro");

    await setConsent(anaId, "OPTED_IN");
  });

  it("integração desconectada entre enfileirar e enviar cancela o envio", async () => {
    const id = await enqueue();
    await request(app.getHttpServer())
      .patch("/api/whatsapp/config/status")
      .set("Cookie", adminACookie)
      .send({ status: "DISCONNECTED" });

    const provider = new MockWhatsAppProvider();
    const result = await process(provider);
    expect(result.cancelled).toBe(1);
    expect(provider.sendCount).toBe(0);

    const message = await findMessage(id);
    expect(message.status).toBe("CANCELLED");
    expect(message.cancelReason).toContain("Integração indisponível");

    await request(app.getHttpServer())
      .patch("/api/whatsapp/config/status")
      .set("Cookie", adminACookie)
      .send({ status: "CONFIGURED" });
  });

  it("cancelamento manual funciona só para pendentes e exige ADMIN", async () => {
    const id = await enqueue();

    const member = await request(app.getHttpServer())
      .post(`/api/whatsapp/messages/${id}/cancel`)
      .set("Cookie", memberACookie)
      .send({ reason: "Cliente solicitou cancelamento" });
    expect(member.status).toBe(403);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/whatsapp/messages/${id}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "Cliente solicitou cancelamento" });
    expect(cancelled.status).toBe(201);
    expect(cancelled.body.status).toBe("CANCELLED");
    expect(cancelled.body.cancelReason).toBe("Cliente solicitou cancelamento");

    const again = await request(app.getHttpServer())
      .post(`/api/whatsapp/messages/${id}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "Tentar cancelar de novo" });
    expect(again.status).toBe(409);
  });

  it("limite de envios por ciclo respeita a taxa máxima", async () => {
    const provider = new MockWhatsAppProvider();
    await enqueue();
    await enqueue();
    await enqueue();

    const firstCycle = await process(provider, { maxPerCycle: 2 });
    expect(firstCycle.due).toBe(2);
    expect(firstCycle.accepted).toBe(2);
    expect(provider.sendCount).toBe(2);

    const secondCycle = await process(provider, { maxPerCycle: 2 });
    expect(secondCycle.due).toBe(1);
    expect(secondCycle.accepted).toBe(1);
    expect(provider.sendCount).toBe(3);
  });
});

describe("Webhooks — verificação, assinatura e idempotência", () => {
  beforeEach(async () => {
    await prisma.whatsAppWebhookEvent.deleteMany();
    await prisma.whatsAppMessageAttempt.deleteMany();
    await prisma.whatsAppMessage.deleteMany();
    await prisma.whatsAppConsent.updateMany({ data: { status: "OPTED_IN" } });
    await prisma.whatsAppConfig.updateMany({
      data: { status: "CONFIGURED", lastError: null },
    });
  });

  it("verificação do webhook devolve o challenge com token correto", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/webhooks/whatsapp")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": VERIFY_TOKEN,
        "hub.challenge": "challenge-e6",
      });
    expect(response.status).toBe(200);
    expect(response.text).toBe("challenge-e6");
    expect(response.headers["content-type"]).toContain("text/plain");
  });

  it("verificação com token errado ou sem challenge é recusada", async () => {
    const wrongToken = await request(app.getHttpServer())
      .get("/api/webhooks/whatsapp")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": "token-errado",
        "hub.challenge": "challenge-e6",
      });
    expect(wrongToken.status).toBe(403);

    const missingChallenge = await request(app.getHttpServer())
      .get("/api/webhooks/whatsapp")
      .query({ "hub.mode": "subscribe", "hub.verify_token": VERIFY_TOKEN });
    expect(missingChallenge.status).toBe(403);
  });

  it("payload sem assinatura é recusado", async () => {
    const response = await postWebhook(statusPayload("delivered", "wamid.ANY"));
    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Assinatura do webhook ausente ou inválida");
  });

  it("assinatura inválida é recusada e não altera a mensagem", async () => {
    const { id, wamid } = await acceptedMessage();
    const raw = statusPayload("delivered", wamid);

    const response = await postWebhook(raw, `sha256=${"ab".repeat(32)}`);
    expect(response.status).toBe(403);

    const message = await findMessage(id);
    expect(message.status).toBe("ACCEPTED");
  });

  it("status delivered só é aplicado via webhook autêntico", async () => {
    const { id, wamid } = await acceptedMessage();
    const raw = statusPayload("delivered", wamid);

    const response = await postWebhook(raw, sign(raw));
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      received: true,
      duplicate: false,
      handled: true,
    });

    const message = await findMessage(id);
    expect(message.status).toBe("DELIVERED");
  });

  it("entrega repetida do provedor é idempotente", async () => {
    const { id, wamid } = await acceptedMessage();
    const raw = statusPayload("delivered", wamid);

    const first = await postWebhook(raw, sign(raw));
    expect(first.body.duplicate).toBe(false);

    const second = await postWebhook(raw, sign(raw));
    expect(second.status).toBe(201);
    expect(second.body).toEqual({
      received: true,
      duplicate: true,
      handled: false,
    });

    const events = await prisma.whatsAppWebhookEvent.count({
      where: { eventId: createHash("sha256").update(raw).digest("hex") },
    });
    expect(events).toBe(1);

    const message = await findMessage(id);
    expect(message.status).toBe("DELIVERED");
  });

  it("status antigo não regride (sent após delivered é ignorado)", async () => {
    const { id, wamid } = await acceptedMessage();
    const delivered = statusPayload("delivered", wamid);
    await postWebhook(delivered, sign(delivered));

    const sent = statusPayload("sent", wamid);
    const response = await postWebhook(sent, sign(sent));
    expect(response.status).toBe(201);
    expect(response.body.handled).toBe(false);

    const message = await findMessage(id);
    expect(message.status).toBe("DELIVERED");
  });

  it("failed reportado pelo provedor vira FAILED com motivo", async () => {
    const { id, wamid } = await acceptedMessage();
    const raw = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-e6",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: PHONE_NUMBER_ID },
                statuses: [
                  {
                    id: wamid,
                    status: "failed",
                    errors: [
                      {
                        code: 470,
                        title: "Recipient phone number not in allowed list",
                        message: "Template not allowed",
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const response = await postWebhook(raw, sign(raw));
    expect(response.status).toBe(201);
    expect(response.body.handled).toBe(true);

    const message = await findMessage(id);
    expect(message.status).toBe("FAILED");
    expect(message.failureReason).toBe("470");
    expect(message.failureDetail).toContain("allowed list");
  });

  it("resposta comum não altera o consentimento", async () => {
    const raw = inboundPayload("bom dia, tudo bem?");
    const response = await postWebhook(raw, sign(raw));
    expect(response.status).toBe(201);
    expect(response.body.handled).toBe(false);

    const consent = await prisma.whatsAppConsent.findFirst({
      where: { clientId: anaId },
    });
    expect(consent?.status).toBe("OPTED_IN");
  });

  it("palavra de descadastro na resposta dá opt-out automático", async () => {
    const raw = inboundPayload("SAIR");
    const response = await postWebhook(raw, sign(raw));
    expect(response.status).toBe(201);
    expect(response.body.handled).toBe(true);

    const consent = await prisma.whatsAppConsent.findFirst({
      where: { clientId: anaId },
    });
    expect(consent?.status).toBe("OPTED_OUT");
    expect(consent?.source).toBe("REPLY");
  });

  it("payload que não é do WhatsApp é aceito sem efeito", async () => {
    const raw = JSON.stringify({ object: "page", entry: [] });
    const response = await postWebhook(raw, sign(raw));
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      received: true,
      duplicate: false,
      handled: false,
    });
  });

  it("JSON inválido é rejeitado pelo parser", async () => {
    const response = await postWebhook("{invalid");
    expect(response.status).toBe(400);
  });
});
