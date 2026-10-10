# Status do projeto — PetFlow

## Etapa atual

**Etapa 9 — Assinaturas e gestão comercial** — CONCLUÍDA
(aguardando aprovação do proprietário para avançar).

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

## Testes executados

| Verificação | Comando | Resultado |
|---|---|---|
| Schema Prisma válido | `npm run db:validate` | OK |
| Lint | `npm run lint` | OK (0 erros) |
| Typecheck | `npm run typecheck` | OK (5 workspaces) |
| Testes (PostgreSQL real) | `npm test` | 367/367 aprovados (16 arquivos) |
| Build | `npm run build` | OK (shared, whatsapp, api, web, worker) |
| Varredura de segredos | grep de credenciais | sem achados reais |

Cobertura dos testes novos (30): `tests/subscriptions.test.ts` (18) —
CRUD de planos (nome duplicado 409, escrita só ADMIN, cross-tenant
404), criação de assinatura (validações, cliente/plano inativos,
`registerPayment` com caixa aberto e 409 fechado), listagem com
filtros, renovação (período, contador, movimento de caixa, cancelada
409, caixa fechado 409) e cancelamento (motivo obrigatório, duplo
409); `tests/billing.test.ts` (12) — catálogo global, GET 404,
upsert/troca de plano (reinicia período, valida plano), renew
(cancelada 409, expiração lazy), cancel (duplo 409) e guards ADMIN.

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
- Push confirmado: `671b3d6..fcd468b main -> main` (inclui a Etapa 8).
- Push anterior: `a186e52..671b3d6 main -> main` (inclui a Etapa 8).

## Próxima etapa autorizada

**Nenhuma — as 9 etapas do roadmap estão concluídas.**
Próximos passos possíveis (aguardando decisão do proprietário):
pendências acima (CI/deploy, enforcement de billing, gateway de
pagamento, recorrência automática) ou novas funcionalidades fora do
roadmap; `prompt oficial da Etapa 9` não foi localizado em
`Etapas_projeto/` — escopo aprovado na conversa.
