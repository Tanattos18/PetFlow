# API — PetFlow

Prefixo global: `/api` (exceto `GET /health`). Autenticação por cookie
`petflow_session` (HttpOnly) — ver `ARCHITECTURE.md`. Todos os endpoints
abaixo exigem sessão válida, exceto os marcados como públicos. Escopo de
tenant sempre derivado da sessão (`companyId`); nenhum `companyId` é aceito
do cliente.

## Códigos de erro

| Código | Quando |
|---|---|
| 400 | Payload/query inválido (Zod) ou regra de negócio (saldo insuficiente, ajuste negativo, categoria/fornecedor/produto/cliente/responsável inválidos, cliente/responsável inativo, data de nascimento futura) |
| 401 | Sem sessão ou sessão inválida/expirada |
| 403 | Sem papel `ADMIN` em rotas de escrita restrita |
| 404 | Recurso inexistente **ou** de outra empresa (sem vazar existência) |
| 409 | Conflito de unicidade (email, nome de categoria/produto, SKU, barcode, nome de serviço, cliente possivelmente duplicado) |

Respostas de erro seguem `{ statusCode, message, timestamp, path }` (Zod
inclui `issues[]`).

## Autenticação (Etapa 1)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/auth/login` | público | Email+senha; retorna cookie HttpOnly |
| POST | `/api/auth/register` | público (flag) | Cria empresa nova + administrador e loga (201); só responde quando `REGISTRATION_ENABLED=true` (senão 404), rate limit por IP (`register|ip`), email global único → 409, slug único gerado do nome da empresa |
| POST | `/api/auth/reset-password` | público (flag) | Redefine a senha pelo email digitado; só responde quando `PASSWORD_RESET_ENABLED=true` (senão 404), com rate limit próprio (`reset|ip|email`); usuário inativo/inexistente → 404, email em múltiplas contas → 400; revoga as sessões abertas do usuário |
| POST | `/api/auth/logout` | sessão | Revoga a sessão atual |
| GET | `/api/auth/me` | sessão | Usuário + empresa autenticados |
| GET | `/api/users` | ADMIN | Lista usuários da empresa |
| POST | `/api/users` | ADMIN | Cria usuário na empresa |
| PATCH | `/api/users/:id/status` | ADMIN | Ativa/inativa (revoga sessões) |
| GET | `/health` | público | Health check técnico |

## Categorias

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/categories` | sessão | Lista paginada; `search`, `status`, `page`, `pageSize` |
| GET | `/api/categories/:id` | sessão | Detalhe |
| POST | `/api/categories` | ADMIN | Cria (nome único por empresa, case-insensitive) |
| PATCH | `/api/categories/:id` | ADMIN | Edita |
| PATCH | `/api/categories/:id/status` | ADMIN | Ativa/inativa |

## Fornecedores

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/suppliers` | sessão | Lista paginada; `search`, `status` |
| GET | `/api/suppliers/:id` | sessão | Detalhe |
| POST | `/api/suppliers` | ADMIN | Cria |
| PATCH | `/api/suppliers/:id` | ADMIN | Edita |
| PATCH | `/api/suppliers/:id/status` | ADMIN | Ativa/inativa |

## Produtos

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/products` | sessão | Lista paginada |
| GET | `/api/products/:id` | sessão | Detalhe com categoria/fornecedor/saldo |
| POST | `/api/products` | ADMIN | Cria (valida categoria/fornecedor da empresa) |
| PATCH | `/api/products/:id` | ADMIN | Edita (SKU/barcode revalidados) |
| PATCH | `/api/products/:id/status` | ADMIN | Ativa/inativa (nunca exclui fisicamente) |

Filtros de `GET /api/products`:

| Param | Tipo | Observação |
|---|---|---|
| `search` | texto | Nome, SKU ou código de barras (case-insensitive) |
| `categoryId` / `supplierId` | id | Escopados à empresa |
| `status` | `ACTIVE` \| `INACTIVE` | |
| `lowStock` | `true`/`false` | Somente produtos com estoque baixo |
| `orderBy` | `name` \| `createdAt` \| `stockQuantity` | Whitelist |
| `direction` | `asc` \| `desc` | |
| `page` / `pageSize` | números | `pageSize` máx. 100 |

O campo `lowStock` do produto é calculado no servidor (regra em
`DATABASE.md`); o cliente nunca envia saldo.

## Estoque

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/stock/entries` | sessão | Entrada (aumenta saldo) |
| POST | `/api/stock/exits` | sessão | Saída (rejeita saldo insuficiente) |
| POST | `/api/stock/adjustments` | ADMIN | Ajuste ±; `reason` obrigatório |
| GET | `/api/stock/balance/:productId` | sessão | Saldo atual + flag `lowStock` |
| GET | `/api/stock/movements` | sessão | Histórico paginado; filtros `productId`, `type` |
| GET | `/api/stock/low-stock` | sessão | Produtos ACTIVE em estoque baixo |

Payloads: `{ productId, quantity, notes?, reference? }` (entrada/saída) e
`{ productId, type: ADJUST_POSITIVE|ADJUST_NEGATIVE, quantity, reason }`
(ajuste). Quantidade sempre positiva (até 3 decimais). Resposta de
movimentação: `{ movement, stockQuantity }` — saldo sempre calculado no
servidor, dentro da transação com lock.

## Vendas (Etapa 3)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/sales` | sessão | Cria venda; recalcula tudo no servidor |
| GET | `/api/sales` | sessão | Histórico paginado; filtros `status`, `search` (código), `from`/`to` (`YYYY-MM-DD`, UTC) |
| GET | `/api/sales/:id` | sessão | Detalhe com itens (snapshots) |
| POST | `/api/sales/:id/cancel` | ADMIN | Cancela com `reason`; devolve estoque |

Payload de criação:

```json
{
  "items": [{ "productId": "cuid", "quantity": "3" }],
  "discount": "10.00",
  "paymentMethod": "PIX",
  "paymentNote": null,
  "clientRequestId": "uuid-gerado-pelo-cliente",
  "clientId": "cuid-do-cliente-opcional"
}
```

- **Nunca** enviar preços/totais: `unitPrice`, `subtotal` e `total`
  enviados pelo cliente são descartados; o servidor usa `salePrice` do
  banco. Desconto `>` subtotal → 400; quantidade inválida ou produto
  inativo/estrangeiro à empresa → 400/404.
- `clientId` (opcional, Etapa 5): validado no servidor **antes** dos
  locks (cliente ativo e da mesma empresa; caso contrário 400
  `"Cliente inválido ou de outra empresa"`/`"Cliente está inativo"`).
  Ausente/null → venda sem cliente (venda rápida).
- `clientRequestId` (obrigatório no frontend, único por empresa) torna a
  criação idempotente: repetição → **409** sem alterar estoque.
- Resposta: `{ id, receiptCode, status, subtotal, discount, total,
  paymentMethod, paymentNote, createdAt, createdBy, clientId,
  client: { id, name }, items: [...] }` — Decimals serializados como
  string (`"259.70"`). Listagem e detalhe também incluem `client`.
- Cancelamento: `POST :id/cancel` com `{ reason }` (mín. 3 caracteres);
  venda já cancelada → **409**; venda de outra empresa → **404**;
  membro comum → **403**. Devolve estoque com movimentos `IN`
  compensatórios (`reference = receiptCode`) na mesma transação.

Busca de produtos no PDV reaproveita `GET /api/products?search=&status=ACTIVE`
(nome, SKU ou código de barras).

## Caixa e financeiro (Etapa 4)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/cash/sessions` | ADMIN | Abre a sessão (uma aberta por empresa; segunda → 409) |
| GET | `/api/cash/sessions/current` | sessão | Sessão `OPEN` com totais + `expectedBalance`; sem sessão → **404** |
| GET | `/api/cash/sessions` | sessão | Últimas 50 sessões com totais e `expectedBalance` |
| GET | `/api/cash/sessions/:id/summary` | sessão | Resumo da sessão (diferença quando fechada); outra empresa → 404 |
| POST | `/api/cash/sessions/:id/close` | ADMIN | Fecha com `countedAmount`; `expected`/`difference` calculados no servidor; já fechada → 409 |
| POST | `/api/cash/movements` | ADMIN | Movimentação manual (`type`, `amount`, `description`; `OUT` exige `justification`) com sessão aberta |
| GET | `/api/cash/movements` | sessão | Histórico paginado; filtros `from`/`to`, `sessionId`, `type`, `origin` |
| POST | `/api/cash/movements/:id/reversal` | ADMIN | Estorno auditável (`reason` ≥ 3) de lançamento `MANUAL` não estornado na sessão aberta |
| GET | `/api/cash/summary` | sessão | Resumo financeiro por período/sessão (vendas, manuais, cancelamentos, estornos, `net`) |

Payload de abertura: `{ "initialAmount": "150.00", "notes": "..." }`.
Payload de fechamento: `{ "countedAmount": "265.50", "notes": "..." }` —
resposta inclui `expectedBalance` e `differenceBalance` (nunca vêm do
cliente).

Comportamentos importantes:

- **Vendas e cancelamentos exigem caixa aberto**: `POST /api/sales` e
  `POST /api/sales/:id/cancel` respondem **409** (`"Caixa fechado: abra o
  caixa para ..."`) quando não há sessão `OPEN`; na criação/cancelamento a
  venda grava `cashSessionId` e um lançamento `CashMovement` (`origin`
  `SALE`/`SALE_CANCELMENT`, `inCash` conforme `paymentMethod === "CASH"`).
- `GET /api/cash/sessions/current` responde **404** quando não há sessão
  aberta (frontend trata 404 como "caixa fechado").
- Escrita restrita a `ADMIN` (abrir, fechar, movimentar, estornar);
  leitura liberada a qualquer sessão autenticada.
- Estorno de lançamento `SALE`/`SALE_CANCELMENT` → 400 (usar cancelamento
  da venda); lançamento já estornado → 409; sessão fechada → 409;
  lançamento de outra empresa → 404.

## Clientes (Etapa 5)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/clients` | sessão | Lista paginada; `search` (nome/telefone/email/CPF), `status`, `page`, `pageSize`; inclui `petsCount`/`salesCount` |
| GET | `/api/clients/:id` | sessão | Detalhe com contagens |
| GET | `/api/clients/:id/pets` | sessão | Pets do responsável (inclui inativos) |
| POST | `/api/clients` | sessão | Cria (MEMBER pode — operação diária) |
| PATCH | `/api/clients/:id` | sessão | Edita |
| PATCH | `/api/clients/:id/status` | sessão | Ativa/inativa |

- Normalização no servidor (Zod compartilhado): telefone/CPF só dígitos
  (`normalizePhone`), email em minúsculas; endereço estruturado
  (`street`, `number`, `complement`, `district`, `city`, `state`, `zip`).
- **Duplicidade**: criação responde **409** `"Cliente possivelmente
  duplicado"` quando `nameKey` + algum contato coincide com cliente
  `ACTIVE`; homônimos sem contato e mesmo telefone em clientes distintos
  são permitidos (política em `DATABASE.md`).
- Recurso de outra empresa → 404; cliente inativo não bloqueia novo
  cadastro nem edição.

## Pets (Etapa 5)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/pets` | sessão | Lista paginada; filtros `species`, `status`, `clientId`, `search` (pet/raça/cor/responsável) |
| GET | `/api/pets/:id` | sessão | Detalhe com responsável |
| POST | `/api/pets` | sessão | Cria (responsável ativo da mesma empresa) |
| PATCH | `/api/pets/:id` | sessão | Edita (troca de responsável validada) |
| PATCH | `/api/pets/:id/status` | sessão | Ativa/inativa |

- Payload: `{ clientId, name, species, breed?, sex?, birthDate? (YYYY-MM-DD),
  weight? (kg, 0..999.99), color?, notes? }`; `sex` padrão `UNKNOWN`;
  nascimento futuro → 400; responsável inativo/outro tenant → 400.
- Serialização: `birthDate` `YYYY-MM-DD`, `weight` string com 2 decimais.

## Serviços (Etapa 5)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/services` | sessão | Lista paginada; `search`, `status`, `orderBy` (name/price/createdAt) |
| GET | `/api/services/:id` | sessão | Detalhe |
| POST | `/api/services` | ADMIN | Cria (nome único por empresa → 409) |
| PATCH | `/api/services/:id` | ADMIN | Edita |
| PATCH | `/api/services/:id/status` | ADMIN | Ativa/inativa |

- Payload: `{ name, description?, durationMinutes? (1..1440),
  price (Decimal(12,2) ≥ 0) }`; `price` sempre string no wire
  (`"80.00"`); nome duplicado na empresa → **409** `"Já existe um
  serviço com este nome nesta empresa"`.

## WhatsApp (Etapa 6)

Integração com a **WhatsApp Business Cloud API** (Meta). Webhook é o
único endpoint público desta seção; demais exigem sessão.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/whatsapp/config` | sessão | Configuração da empresa (credenciais **nunca** retornadas; só flag `hasAccessToken`) |
| PUT | `/api/whatsapp/config` | ADMIN | Salva `phoneNumberId`, `wabaId`, `displayName` + lembrete (`reminderTemplateId`, `reminderLeadMinutes` — template precisa ter exatamente 3 variáveis) |
| POST | `/api/whatsapp/config/health` | ADMIN | Testa credencial com o provedor (token sanitizado no erro) |
| PATCH | `/api/whatsapp/config/status` | ADMIN | `ACTIVE`/`DISCONNECTED` (desconectar bloqueia envios) |
| GET | `/api/whatsapp/templates` | sessão | Lista templates da empresa (filtros `status`, `search`) |
| POST | `/api/whatsapp/templates` | ADMIN | Cria template (`variablesCount` derivado do corpo) |
| PATCH | `/api/whatsapp/templates/:id/approval` | ADMIN | `APPROVED`/`REJECTED` (aprovação interna) |
| PATCH | `/api/whatsapp/templates/:id/status` | ADMIN | `PENDING`/`DISABLED` |
| GET | `/api/whatsapp/consents` | sessão | Lista consentimentos (filtros `status`, `search`) |
| POST | `/api/whatsapp/consents` | ADMIN | Registra/atualiza consentimento por telefone+cliente |
| GET | `/api/whatsapp/consents/:clientId` | sessão | Consentimento do cliente; sem registro → **404** |
| PUT | `/api/whatsapp/consents/:clientId` | ADMIN (opt-in) / sessão (opt-out) | `{ status, source }` — descadastro liberado a qualquer sessão |
| GET | `/api/whatsapp/messages` | sessão | Fila/histórico; filtros `status`, `search`, `page`, `pageSize` |
| POST | `/api/whatsapp/messages` | sessão | Enfileira (`clientId`, `templateId`, `variables`, `clientRequestId`) |
| GET | `/api/whatsapp/messages/:id` | sessão | Detalhe com template + tentativas |
| POST | `/api/whatsapp/messages/:id/cancel` | sessão | Cancela `PENDING`/`RETRY` (já em andamento → 409) |
| GET | `/api/whatsapp/webhook` | **público** | Verificação Meta (query `hub.*`) → challenge `text/plain` |
| POST | `/api/whatsapp/webhook` | **público** | Eventos Meta; exige `x-hub-signature-256` válido → 403 se inválido |

Comportamentos importantes:

- **Enfileirar ≠ entregar**: `POST /messages` valida no servidor
  cliente `ACTIVE` da empresa, template `APPROVED`, consentimento
  `OPTED_IN` e variáveis contra `templateVariableCount()`, e grava
  `PENDING`; o envio real é do worker (ver `ARCHITECTURE.md`).
- Idempotência: `clientRequestId` único por empresa — repetição retorna
  a mesma mensagem (sem duplicar fila).
- Webhook: verificação `HMAC-SHA256` com `WHATSAPP_APP_SECRET` sobre o
  **corpo bruto** (`rawBody`); eventos idempotentes por `wamid`+tipo;
  resposta de texto `"SAIR"` → opt-out (`source = REPLY`).
- Erros do provedor classificados server-side: 429/408/5xx =
  TRANSIENT (worker reagenda com backoff); demais = PERMANENT (falha
  imediata, `attemptCount` nunca passa de `maxAttempts` = 3).
- Recurso de outra empresa → 404; token/access token aparecem apenas em
  configuração local (`.env`), nunca em resposta ou log.

## Relatórios e dashboard (Etapa 7)

Agregação **server-side** sobre os dados reais das Etapas 1–8 — nada
é calculado no navegador e nenhum dado fictício é retornado. Todos os
endpoints exigem apenas sessão (leitura), `companyId` vem sempre do
contexto autenticado e aceitam `from`/`to` em `YYYY-MM-DD`.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/reports/summary` | sessão | KPIs: vendas (concluídas/canceladas, líquido/bruto/descontos, ticket médio), vendas por dia e por forma de pagamento, caixa (sessão aberta + `inCash`/totais), estoque (baixo/zerado), clientes/pets novos, WhatsApp por status, agendamentos por status (`services`), `modules.servicesRealized` |
| GET | `/api/reports/sales` | sessão | Totais separados concluídas × canceladas + lista paginada; filtros `from`, `to`, `status`, `paymentMethod`, `page`, `pageSize`, `format` |
| GET | `/api/reports/stock/alerts` | sessão | Produtos sem estoque ou no mínimo (inativos excluídos); `page`, `pageSize`, `format` |
| GET | `/api/reports/stock/movements` | sessão | Totais por tipo (zero-fill) + lista; filtros `productId`, `type`, período, paginação, `format` |
| GET | `/api/reports/cash` | sessão | `inCash` vs todos, estornos por origem, sessões abertas/fechadas no período |
| GET | `/api/reports/clients` | sessão | Clientes e pets novos no período + pets por espécie + agendamentos por status (`services`) |
| GET | `/api/reports/whatsapp` | sessão | Contagem por status atual + falhas agrupadas por motivo |

Comportamentos importantes:

- **Período em UTC**: janela inclusiva `from T00:00:00.000Z`–
  `to T23:59:59.999Z`; padrão dos últimos `30` dias ancorado no
  `to`; intervalo máximo de `366` dias; `from > to`, formato ou
  data de calendário inválidos → **400** com `issues`.
- **Totais × lista (vendas)**: os totais separados concluídas ×
  canceladas consideram o período e `paymentMethod`; o filtro
  `status` altera **apenas** a lista de itens. Documentado aqui para
  evitar surpresa de consumo.
- **Ticket médio** = líquido ÷ vendas concluídas com 2 casas; sem
  vendas no período o campo volta `null` (nunca `0` fingindo dado).
- **Serviços realizados**: `summary.modules.servicesRealized` vem
  com `available: true` desde a Etapa 8; `summary.services` e
  `clients.services` trazem contagens de agendamentos por status
  (zero-fill) no período — filtros de status em `/clients` não
  existem.
- **WhatsApp**: contagem pelo status **atual** do registro;
  `ACCEPTED` (aceito pela API Meta) não é `DELIVERED`.
- **CSV** (`format=csv` em sales, stock/alerts, stock/movements):
  `text/csv` + `Content-Disposition` com filename
  `petflow_<relatório>_<from>_<to>.csv`, linhas separadas por CRLF,
  escape por aspas e neutralização de injeção (célula iniciada por
  `=`, `+`, `-`, `@` recebe apóstrofo); teto de `5000` linhas e
  **ignora paginação**; exige sessão (401 sem cookie).
- Recurso de outra empresa nunca aparece (404/escopo); parâmetro
  `companyId` enviado pelo cliente é **ignorado**.

## Agendamentos (Etapa 8)

Sessão autenticada — **sem `AdminGuard`**: agenda é operação diária e
também membros criam/editam. `companyId` sempre da sessão.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/appointments` | sessão | Cria (201): `clientId`, `petId`, `serviceId`, `startLocal` (`YYYY-MM-DDTHH:mm`), `utcOffsetMinutes`, `notes?` |
| GET | `/api/appointments` | sessão | Lista; filtros `from`, `to` (dia em `startLocal`), `status`, `clientId`, `petId`, `serviceId`, `search`, `page`, `pageSize` |
| GET | `/api/appointments/:id` | sessão | Detalhe (404 cross-tenant) |
| PATCH | `/api/appointments/:id` | sessão | Edição parcial/reagendamento (apenas status não-terminal) |
| PATCH | `/api/appointments/:id/status` | sessão | `CONFIRMED`, `COMPLETED` ou `NO_SHOW` (terminal → 409) |
| POST | `/api/appointments/:id/cancel` | sessão | Cancela (201): `reason` 3..500 obrigatório; terminal → 409 |

Comportamentos importantes:

- **Horário calculado no servidor**: `startAt`/`endAt` derivam de
  `startLocal` + `utcOffsetMinutes` (leste-positivo, ±840 min — o
  cliente envia `-getTimezoneOffset()`); `durationMinutes` vem do
  serviço (`1..1440`, obrigatório). Passado (tolerância 60 s) → **400**.
- **Conflito da empresa inteira**: em transação com
  `SELECT ... FOR UPDATE` na `Company` (mesmo padrão da sessão de
  caixa), qualquer `SCHEDULED`/`CONFIRMED` sobreposto
  (`startAt < end AND endAt > start`) → **409**; fim-início exato
  permitido; `COMPLETED`/`CANCELLED`/`NO_SHOW` não bloqueiam; a
  edição exclui o próprio registro da checagem.
- **Validações**: cliente ativo, pet do cliente, serviço ativo, todos
  da empresa (cross-tenant → 404); `endAt` sempre derivado (nunca
  vem do cliente).
- **Lembrete automático** (`syncReminder`, mesma transação do CRUD):
  enfileira `WhatsAppMessage` com chave `appointment-reminder:<id>`
  (`origin: SERVICE_REMINDER`, única por empresa),
  `nextAttemptAt = max(now, startAt − reminderLeadMinutes)` e
  variáveis `[pet ou tutor, serviço, "dd/mm/aaaa às HH:mm"]`;
  revalida config ≠ `DISCONNECTED`, template selecionado
  `APPROVED`/ativo com 3 variáveis, telefone E.164 e consentimento
  `OPTED_IN`; reagendar atualiza a pendente, cancelar/concluir/inelegível
  cancela com motivo; falha de lembrete só loga — o CRUD nunca falha.
- Campos de lembrete também em `GET/PUT /api/whatsapp/config`:
  `reminderTemplateId` (template da empresa com exatamente 3
  variáveis → 400 caso contrário) e `reminderLeadMinutes`
  (5..40320, default 1440).

## Assinaturas e billing (Etapa 9)

Duas famílias: assinaturas dos **clientes do pet shop** (tenant-scoped,
escrita com `AdminGuard`) e **billing da empresa no SaaS** (catálogo
global + assinatura única por empresa). Pagamentos usam o caixa
existente (sem gateway); `companyId` sempre da sessão.

### Planos e assinaturas de clientes

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/subscription-plans` | sessão | Lista; `search`, `status`, `page`, `pageSize`, `orderBy` (`name`/`price`/`createdAt`) |
| POST | `/api/subscription-plans` | ADMIN | Cria (201): `name` único por empresa → 409, `price`, `durationDays` (1..3650), `description?` |
| GET | `/api/subscription-plans/:id` | sessão | Detalhe (404 cross-tenant) |
| PATCH | `/api/subscription-plans/:id` | ADMIN | Edição parcial (404 cross-tenant) |
| PATCH | `/api/subscription-plans/:id/status` | ADMIN | `ACTIVE`/`INACTIVE` |
| GET | `/api/subscriptions` | sessão | Lista; `status`, `clientId`, `search`, `page`, `pageSize`; expiração lazy |
| POST | `/api/subscriptions` | ADMIN | Cria (201): `clientId`, `planId`, `startAt?` (ISO), `registerPayment?` |
| GET | `/api/subscriptions/:id` | sessão | Detalhe com `payments` (404 cross-tenant; expiração lazy) |
| POST | `/api/subscriptions/:id/renew` | ADMIN | Renova (201): exige caixa aberto; cancelada → 409 |
| POST | `/api/subscriptions/:id/cancel` | ADMIN | Cancela (201): `reason` 3..500; duplo → 409 |

Comportamentos importantes:

- **Criação**: cliente e plano devem estar ativos e da empresa
  (cross-tenant → 404, inativo → 400); `startAt` opcional (padrão
  `now`); `registerPayment: true` cria `CashMovement` `IN`/`MANUAL`
  (`inCash: true`, origem `MANUAL`, `subscriptionId` vinculado) em
  transação **após** `lockOpenCashSession` — caixa fechado → **409**.
- **Renovação** (transação): trava a sessão de caixa, novo período
  começa em `max(now, endAt)`, `status` volta a `ACTIVE`,
  `renewalCount + 1`, `lastPaymentAt = now` e movimento de caixa
  "Renovação de assinatura: cliente — plano"; assinatura `CANCELLED`
  → **409**; caixa fechado → **409**.
- **Cancelamento**: `updateMany({ id, companyId, status: ACTIVE })` —
  0 linhas → **409** (dupla corrida/estado inválido); grava motivo,
  `cancelledAt` e `cancelledByUserId`.
- **Expiração lazy**: leituras (`GET` lista/detalhe) marcam
  `EXPIRED` quando `endAt < now`; a mudança de status também reage
  em `GET` individual.

### Billing da empresa no SaaS (globais)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/billing/plans` | sessão | Catálogo global ativo (`{ items }`), ordenado por preço |
| GET | `/api/billing/subscription` | sessão | Assinatura da empresa (404 se ausente; expiração lazy) |
| PUT | `/api/billing/subscription` | ADMIN | Upsert (troca de plano reinicia o período e reativa; plano inexistente → 404, inativo → 400) |
| POST | `/api/billing/subscription/renew` | ADMIN | Renova (201): novo período a partir de `max(now, end)`; cancelada → 409 |
| POST | `/api/billing/subscription/cancel` | ADMIN | Cancela (201): `reason?` ≤ 500; duplo → 409 |

Comportamentos importantes:

- `TenantPlan`/`TenantSubscription` são **globais por decisão
  documentável** (exceção à regra de `companyId`): o catálogo é da
  plataforma e a assinatura é única por empresa (`companyId @unique`).
- Escrita do catálogo global **não é exposta** nesta etapa (exige
  papel de plataforma — pendência registrada).
- Sem gateway e sem enforcement de limites por plano ainda — a
  assinatura é registro de comercial (pendências registradas).

## Padrão para módulos futuros

1. Modelo sempre com `companyId` + FK `Restrict` e índices por empresa.
2. `findFirst({ where: { id, companyId: auth.companyId } })` em toda
   leitura/escrita individual; 404 quando não encontrar.
3. Guards: leitura com sessão; escrita sensível com `AdminGuard`.
4. Nunca aceitar saldo/valores críticos enviados pelo cliente como fonte
   de verdade.
