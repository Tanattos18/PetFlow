# API — PetFlow

Prefixo global: `/api` (exceto `GET /health`). Autenticação por cookie
`petflow_session` (HttpOnly) — ver `ARCHITECTURE.md`. Todos os endpoints
abaixo exigem sessão válida, exceto os marcados como públicos. Escopo de
tenant sempre derivado da sessão (`companyId`); nenhum `companyId` é aceito
do cliente.

## Códigos de erro

| Código | Quando |
|---|---|
| 400 | Payload/query inválido (Zod) ou regra de negócio (saldo insuficiente, ajuste negativo, categoria/fornecedor inválidos, produto inativo) |
| 401 | Sem sessão ou sessão inválida/expirada |
| 403 | Sem papel `ADMIN` em rotas de escrita restrita |
| 404 | Recurso inexistente **ou** de outra empresa (sem vazar existência) |
| 409 | Conflito de unicidade (email, nome de categoria, SKU, barcode) |

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

## Padrão para módulos futuros

1. Modelo sempre com `companyId` + FK `Restrict` e índices por empresa.
2. `findFirst({ where: { id, companyId: auth.companyId } })` em toda
   leitura/escrita individual; 404 quando não encontrar.
3. Guards: leitura com sessão; escrita sensível com `AdminGuard`.
4. Nunca aceitar saldo/valores críticos enviados pelo cliente como fonte
   de verdade.
