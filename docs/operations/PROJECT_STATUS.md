# Status do projeto — PetFlow

## Etapa atual

**Etapa 6 — Integração com WhatsApp** — CONCLUÍDA
(aguardando aprovação do proprietário para avançar).

Data: 2026-10-09.

Etapas anteriores: Etapa 0 (2026-10-09), Etapa 1 (2026-10-09),
Etapa 2 (2026-10-09), Etapa 3 (2026-10-09), Etapa 4 (2026-10-09),
Etapa 5 (2026-10-09).

Escopo: WhatsApp Business Cloud API (Meta) como provedor de mensagens,
fila em PostgreSQL processada pelo `apps/worker` (sem Redis/BullMQ),
webhook oficial com verificação de assinatura, consentimento auditável
e frontend de gestão — sem scraping/QR, sem inventar agendamentos, sem
tocar em `automação do whatsapp/`.

## Entregas concluídas (Etapa 6)

- [x] Migration aditiva `20261009232055_etapa6_whatsapp_integration`
      aplicada em `petflow` (dev) e `petflow_test` (testes); schema
      validado; nenhum dado existente alterado.
- [x] Modelos: `WhatsAppConfig`, `WhatsAppTemplate`,
      `WhatsAppConsent`, `WhatsAppMessage`, `WhatsAppSendAttempt`,
      `WhatsAppWebhookEvent` (+ 8 enums WhatsApp), todos com
      `companyId`, FK `Restrict` e índices multiempresa.
- [x] Pacote `@petflow/whatsapp`: E.164 (`toE164`/`isE164`),
      classificação de erros (429/408/5xx = TRANSIENT),
      backoff exponencial 5s·2^n (cap 300s), opt-out textual,
      `MetaCloudProvider` (fetch injetável, scrub de segredos) e
      `MockWhatsAppProvider` determinístico.
- [x] Schemas Zod E6 em `@petflow/shared` (config, template com
      variáveis `{{n}}`, consentimento E.164, mensagem, cancelamento)
      + labels PT-BR.
- [x] API módulos `whatsapp` (prefixo `/api`, sob `AuthGuard` global):
      `config` (GET/PUT, health POST, status PATCH — escrita ADMIN,
      token nunca exposto), `templates` (catálogo/criação/aprovação/
      status), `consents` (por cliente, opt-in ADMIN, opt-out
      auditável), `messages` (listagem com filtros, enfileiramento
      idempotente por `clientRequestId`, cancelamento).
- [x] Webhook Meta (`@Public`): `GET` com challenge em `text/plain`,
      `POST` com verificação `x-hub-signature-256` sobre `rawBody`
      (403 em assinatura inválida), eventos idempotentes por `wamid`,
      status sent/delivered/read/failed (retry TRANSIENT) e resposta
      "SAIR" → `OPTED_OUT` (source `REPLY`).
- [x] Fila de envio em `apps/worker`: claim atômico
      (`updateMany` PENDING→SENDING), consentimento/desconexão como
      cancelamento, transação attempt+update, backoff,
      `MAX_ATTEMPTS=3` → FAILED, rate limit por ciclo
      (`WHATSAPP_SEND_MAX_PER_CYCLE`/`WHATSAPP_SEND_INTERVAL_MS`),
      loop com heartbeat e shutdown gracioso (SIGINT/SIGTERM).
- [x] Envio só server-side: cliente nunca controla status/saldo/
      provedor; leituras individuais via `findFirst({ id, companyId })`
      → 404; bloqueio de envio sem consentimento `OPTED_IN`.
- [x] Frontend: badge "Etapa 6 — Integração com WhatsApp";
      `/whatsapp` (status, credenciais, teste de conexão,
      desconectar/reconectar), `/whatsapp/templates` (criar,
      aprovação, ativar/inativar), `/whatsapp/mensagens` (lista com
      filtros, envio com variáveis, cancelar), `/whatsapp/mensagens/[id]`
      (detalhe + tentativas); seção "Consentimento WhatsApp" em
      `/clientes/[id]`; card "Automação WhatsApp" disponível na home.

## Testes executados

| Verificação | Comando | Resultado |
|---|---|---|
| Schema Prisma válido | `npm run db:validate` | OK |
| Lint | `npm run lint` | OK (0 erros) |
| Typecheck | `npm run typecheck` | OK (4 workspaces) |
| Testes (PostgreSQL real) | `npm test` | 251/251 aprovados (12 arquivos) |
| Build | `npm run build` | OK (shared, api, web, worker; 27 rotas) |

Cobertura dos testes novos (61, `tests/whatsapp.test.ts`): E.164,
classificação de HTTP e backoff, opt-out textual; config com sanitização
de token e permissões; templates com contagem de variáveis e
isolamento; consentimento (opt-in ADMIN, opt-out, 404 cross-tenant);
enfileiramento (validações completas, idempotência, 404 cross-tenant);
fila (ACCEPTED não entregue, claim concorrente → 1 envio, transient
reagenda, 3 tentativas → FAILED, permanent imediato, cancelamentos,
rate limit); webhook (challenge, 403 por assinatura, delivered,
duplicado idempotente, anti-regressão, failed, "SAIR" → opt-out, JSON
inválido).

## Pendências conhecidas

- CI (lint + typecheck + testes) quando solicitado.
- Credenciais reais da Meta (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`,
  `WHATSAPP_VERIFY_TOKEN`) só no `.env` local — provisionamento em
  produção é decisão explícita do proprietário.
- Webhook Meta exige URL pública (ngrok/túnel/domínio) — fora do
  ambiente local.
- Botões interativos e mídia (imagem/áudio/documento) — camada de
  provedor suporta payload `components`; UI de mídia fica para etapa
  futura se necessário.
- Entrega de mensagens fora de horário/janela de 24h da Meta (template
  vs. sessão) — validação server-side por `hasPendingSession` está
  registrada; revisar política da Meta na publicação.
- Validação de dígitos verificadores de CPF/CNPJ (hoje CPF valida
  apenas 11 dígitos) — avaliar em etapa avançada.
- Duplicidade de clientes: janela de corrida aceita (sem unique duro de
  `nameKey`).
- Itens de serviço em vendas: fora do escopo (catálogo é preparação
  para agendamentos — agora na Etapa 8).
- Estoque negativo nunca é permitido por padrão; backorder seria decisão
  explícita.
- Formas de pagamento configuráveis além de Dinheiro/Cartão/Pix/Outro.
- Vendas anteriores à Etapa 4 (sem `cashSessionId`/lançamento) ficam fora
  do financeiro — limitação de dados de desenvolvimento.
- CI e deploy (contínuos).

## Git

- Branch: `main`; remoto: `origin` → `https://github.com/Tanattos18/PetFlow.git`.
- `3b77828` feat(etapa-1): autenticação, usuários, permissões e multiempresa
- `6a36407` feat(etapa-2): implementa produtos e controle de estoque
- `e305d52` docs: registra hashes dos commits e push da etapa 2
- `912d1c8` feat(etapa-3): implementa vendas e ponto de venda
- `6ae287d` feat(etapa-4): implementa caixa e financeiro
- `bf2d5a9` docs: registra hash do commit da etapa 4
- `398ad85` docs: registra push da etapa 4
- `59ef5a2` docs: reescreve README com roadmap das 9 etapas
- `9d273b9` feat(etapa-5): implementa clientes, pets e serviços
- `e7bfd34` docs: registra hash do commit da etapa 5
- `f81db3c` feat(etapa-6): integra WhatsApp Cloud API com fila, webhook e frontend
- `4e902d0` docs: registra hash do commit da etapa 6
- Push confirmado: `e7bfd34..4e902d0 main -> main` (inclui a Etapa 6;
  push anterior `2af5ba7..9d273b9` incluiu a Etapa 5).

## Próxima etapa autorizada

**Etapa 7 — Dashboard** — a iniciar somente após aprovação explícita
do proprietário (roadmap: 6=WhatsApp ✅, 7=Dashboard, 8=Agendamentos,
9=Assinaturas — conforme prompt oficial da Etapa 6).
