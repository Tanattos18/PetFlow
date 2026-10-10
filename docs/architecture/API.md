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
| PUT | `/api/whatsapp/config` | ADMIN | Salva `phoneNumberId`, `wabaId`, `displayName` |
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

## Padrão para módulos futuros

1. Modelo sempre com `companyId` + FK `Restrict` e índices por empresa.
2. `findFirst({ where: { id, companyId: auth.companyId } })` em toda
   leitura/escrita individual; 404 quando não encontrar.
3. Guards: leitura com sessão; escrita sensível com `AdminGuard`.
4. Nunca aceitar saldo/valores críticos enviados pelo cliente como fonte
   de verdade.
