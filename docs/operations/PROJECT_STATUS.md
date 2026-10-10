# Status do projeto — PetFlow

## Etapa atual

**Etapa 9 — Assinaturas e gestão comercial** — CONCLUÍDA.

**Pós-Etapa 9 (2026-10-10)** — entregas de acesso e demonstração
CONCLUÍDAS: redefinição de senha pelo painel, cadastro aberto de
contas, seed de demonstração e guia de uso no README. Aguardando
direção do proprietário para a próxima etapa.

Data: 2026-10-10.

Etapas anteriores: Etapa 0 (2026-10-09), Etapa 1 (2026-10-09),
Etapa 2 (2026-10-09), Etapa 3 (2026-10-09), Etapa 4 (2026-10-09),
Etapa 5 (2026-10-09), Etapa 6 (2026-10-09), Etapa 7 (2026-10-09),
Etapa 8 (2026-10-10).

Escopo (aprovado na conversa — sem prompt oficial em
`Etapas_projeto/`): assinaturas recorrentes de clientes do pet shop
(planos, criação com pagamento opcional no caixa, renovação via caixa
e cancelamento com motivo) **e** billing da própria empresa no SaaS
(catálogo de planos globais seedados e assinatura do tenant, com
troca/renovação/cancelamento). Pagamento sempre pela
caixa/venda existente (sem gateway); decisões registradas —
`TenantPlan`/`TenantSubscription` globais como exceção documentável,
catálogo global do billing sem escrita via API nesta etapa,
cancelamento com motivo obrigatório (cliente) e opcional (billing).

## Entregas concluídas (Etapa 9)

- [x] Schemas Zod E9 em `@petflow/shared` (seção "Etapa 9"):
      `subscriptionStatusSchema`/`tenantSubscriptionStatusSchema` +
      labels, `SUBSCRIPTION_MIN/MAX_DURATION_DAYS` (1/3650),
      `TENANT_PLAN_DEFAULT_DURATION_DAYS=30`, `create/update/
      listSubscriptionPlans*`, `create/listSubscriptions*`
      (`startAt` opcional ISO, `registerPayment`), `cancelSubscriptionSchema`
      (reason 3..500), `updateTenantSubscriptionSchema` e
      `cancelTenantSubscriptionSchema` (reason opcional ≤ 500).
- [x] Migration `20261010131027_etapa9_subscriptions`: enums
      `SubscriptionStatus`/`TenantSubscriptionStatus`; modelos
      `SubscriptionPlan`/`Subscription` (FK `Restrict`, índices por
      empresa e `[clientId]`), `TenantPlan`/`TenantSubscription`
      (globais; `companyId` `@unique`); `CashMovement.subscriptionId`
      (FK `SetNull` + índice `[companyId, subscriptionId]`); seed dos 3
      `TenantPlan` iniciais na própria migration; aplicada em `petflow`
      (dev); `db:validate` OK.
- [x] Módulo `apps/api/src/subscriptions` (escrita com `AdminGuard`):
      `GET/POST /api/subscription-plans` (201; nome único por empresa →
      409), `GET/PATCH /:id`, `PATCH /:id/status`; `GET /api/subscriptions`
      (filtros `status`/`clientId`/`search` + paginação) e `GET /:id`
      (expiração lazy); `POST /api/subscriptions` (201; cliente/plano
      ativos; `registerPayment` em transação com `lockOpenCashSession`
      → caixa fechado 409); `POST /:id/renew` (201; estende a partir de
      `max(now, endAt)`, `renewalCount+1`, movimento de caixa
      vinculado; cancelada → 409); `POST /:id/cancel` (201; motivo
      3..500, guarda de status → 409). Cross-tenant → 404.
- [x] Módulo `apps/api/src/billing`: `GET /api/billing/plans`,
      `GET /api/billing/subscription` (404 se ausente; expiração lazy),
      `PUT /api/billing/subscription` (AdminGuard; upsert reinicia o
      período e reativa), `POST .../renew` (201; cancelada → 409),
      `POST .../cancel` (201; duplo → 409); escrita do catálogo global
      não exposta.
- [x] Frontend: `/planos` (CRUD ADMIN), `/assinaturas` (filtros +
      paginação), `/assinaturas/nova`, `/assinaturas/[id]` (detalhe,
      pagamentos, renovar/cancelar), `/faturamento` (situação + troca/
      renovação/cancelamento), cards na home, badge "Etapa 9 —
      Assinaturas"; DTOs E9 em `lib/types.ts`.
- [x] `resetDatabase` cobre `Subscription` e `TenantSubscription`.

## Entregas concluídas (pós-Etapa 9 — 2026-10-10)

- [x] **Redefinição de senha pelo painel**: endpoint público
      `POST /api/auth/reset-password` (só com
      `PASSWORD_RESET_ENABLED=true`, senão 404; rate limit
      `reset|ip|email`; política 8..72; 404 inexistente/inativo, 400
      conta duplicada; troca de hash + revogação de sessões na mesma
      transação), página `/redefinir-senha` e link no login;
      `tests/password-reset.test.ts` (7).
- [x] **Cadastro aberto de contas**: endpoint público
      `POST /api/auth/register` (201; só com
      `REGISTRATION_ENABLED=true`, senão 404; rate limit por IP
      `register|ip`; email global único → 409; slug único gerado do
      nome; cria empresa + administrador e loga automaticamente),
      página `/cadastro` e link "Cadastre-se" no login; refatoração
      de sessão em `AuthService.createSession()` (login + registro);
      `tests/register.test.ts` (6).
- [x] **Seed de demonstração**: `apps/api/src/cli/seed-demo.ts`
      (`npm run db:seed:demo -- --company=<slug|id|e-mail>`), roda em
      transação única e **só em empresa vazia**; aplicado na empresa
      "Mundo Pet" (6 categorias, 5 fornecedores, 32 produtos, 24
      clientes, 26 pets, 8 serviços, 4 planos, 44 vendas, 8 sessões
      de caixa, 20 agendamentos, 8 assinaturas, tenant Profissional,
      WhatsApp completo); integridade conferida (estoque×movimentos,
      totais de venda, saldos/diferenças de caixa,
      `startLocal`×`startAt`).
- [x] **README**: guia "Como usar o sistema" (primeiro acesso com
      cadastro/redefinição, perfis, rotina, receitas por módulo,
      mapa de páginas) e seção "Dados de demonstração".
- [x] Flags `PASSWORD_RESET_ENABLED`/`REGISTRATION_ENABLED` (padrão
      desabilitado) em `env.ts`, `.env.example`, `.env` local e
      `tests/setup-env.ts`.

## Testes executados

| Verificação | Comando | Resultado |
|---|---|---|
| Schema Prisma válido | `npm run db:validate` | OK |
| Lint | `npm run lint` | OK (0 erros) |
| Typecheck | `npm run typecheck` | OK (5 workspaces) |
| Testes (PostgreSQL real) | `npm test` | 380/380 aprovados (18 arquivos) |
| Build | `npm run build` | OK (shared, whatsapp, api, web, worker) |
| Varredura de segredos | grep de credenciais | sem achados reais |
| Seed de demonstração | `db:seed:demo` + script de integridade | OK (INTEGRIDADE OK) |

Cobertura dos testes novos (30, Etapa 9): `tests/subscriptions.test.ts`
(18) — CRUD de planos (nome duplicado 409, escrita só ADMIN,
cross-tenant 404), criação de assinatura (validações, cliente/plano
inativos, `registerPayment` com caixa aberto e 409 fechado), listagem
com filtros, renovação (período, contador, movimento de caixa,
cancelada 409, caixa fechado 409) e cancelamento (motivo obrigatório,
duplo 409); `tests/billing.test.ts` (12) — catálogo global, GET 404,
upsert/troca de plano (reinicia período, valida plano), renew
(cancelada 409, expiração lazy), cancel (duplo 409) e guards ADMIN.

Cobertura dos testes novos (13, pós-Etapa 9):
`tests/password-reset.test.ts` (7) — 404 com flag desligada, 400
validação, 404 inexistente, 400 conta duplicada, sucesso + sessão
antiga revogada, rate limit; `tests/register.test.ts` (6) — criação
com auto-login e login em seguida, slug único, 409 e-mail duplicado,
400 política de senha, 404 com flag desligada, rate limit por IP.

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
- Itens de serviço em vendas/PDV: continua fora; venda de serviço
  segue pelo catálogo de produtos (decisão registrada na Etapa 8).
- Agenda: visão por dia apenas (semana/mês, recorrência, profissionais
  e horário de funcionamento ficam para etapa futura).
- Lembretes: antecipação fixa por empresa (sem janela de silêncio
  por cliente nem lembrete de confirmação pós-atendimento).
- Gráficos avançados (biblioteca, tooltips, zoom): introduzir
  dependência só quando houver necessidade real — hoje barras CSS
  atendem.
- Estoque negativo nunca é permitido por padrão; backorder seria decisão
  explícita.
- Formas de pagamento configuráveis além de Dinheiro/Cartão/Pix/Outro.
- Vendas anteriores à Etapa 4 (sem `cashSessionId`/lançamento) ficam fora
  do financeiro — limitação de dados de desenvolvimento.
- CSV de caixa, clientes e WhatsApp: não implementado (opcional no
  escopo; JSON cobre os casos).
- **Billing (Etapa 9)**: escrita do catálogo global `TenantPlan` não
  exposta via API (exige papel de plataforma); gating/limites de uso
  por plano (clientes, usuários, módulos) não implementados — a
  assinatura do tenant hoje é registro, ainda sem enforcement.
- **Assinaturas (Etapa 9)**: pagamento sempre em Dinheiro no caixa
  (sem escolha de método/cartão); renovação manual, sem cobrança
  recorrente automática; assinatura de cliente não tem edição de
  campos (cancelar + criar nova, decisão registrada).
- **Redefinição de senha pelo painel** (pós-Etapa 9): fluxo local sem
  token de e-mail (flag `PASSWORD_RESET_ENABLED` + rate limit) — em
  produção, manter a flag desabilitada e implementar redefinição com
  token enviado por e-mail.
- **Cadastro aberto** (pós-Etapa 9): cria tenant sem verificação de
  email nem anti-abuso além do rate limit por IP (flag
  `REGISTRATION_ENABLED`) — em produção, avaliar verificação de
  email/captcha antes de habilitar.
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
- `2287bec` docs: registra push da etapa 6
- `f81a077` feat(etapa-7): implementa dashboard e relatorios com agregacao server-side
- `016ecaf` docs: registra hash do commit da etapa 7
- `a186e52` docs: registra push da etapa 7
- `cb018e5` feat(etapa-8): implementa agendamentos com conflito, lembretes e agenda
- `671b3d6` docs: registra hash do commit da etapa 8
- `fcd468b` docs: registra push da etapa 8
- `7e7c1bb` feat(etapa-9): implementa assinaturas de clientes e billing do saas
- `a25f533` docs: registra hash do commit da etapa 9
- `d42d8c0` feat: adiciona redefinicao de senha pelo painel e guia de uso no readme
- `69b2c3a` feat: adiciona cadastro aberto de contas e seed de demonstracao
- `a9055e2` docs: registra hash do commit de cadastro e seed
- Push confirmado: `34cbec6..a9055e2 main -> main` (inclui redefinição
  de senha, cadastro aberto, seed de demonstração e docs pós-Etapa 9).
- Push confirmado: `fcd468b..a25f533 main -> main` (inclui a Etapa 9).
- Push anterior: `671b3d6..fcd468b main -> main` (inclui a Etapa 8).

## Próxima etapa autorizada

**Nenhuma — as 9 etapas do roadmap e as entregas pós-Etapa 9
(redefinição de senha, cadastro aberto, seed de demonstração, guia de
uso) estão concluídas.** Próximos passos possíveis (aguardando decisão
do proprietário): pendências acima (CI/deploy, enforcement de billing,
gateway de pagamento, recorrência automática, verificação de e-mail e
anti-abuso no cadastro), continuidade das atualizações/testes ou novas
funcionalidades fora do roadmap.
