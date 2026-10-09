# Banco de dados — diretrizes e modelo atual

## Modelos implementados (Etapa 5)

Migration: `database/prisma/migrations/20261009222638_etapa5_clients_pets_services`
(aditiva — não altera nem remove dados existentes).

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `Client` | `companyId` (FK `Restrict`), `name`, `nameKey`, `phone?`, `mobile?`, `email?`, `cpf?`, endereço (`street?`, `number?`, `complement?`, `district?`, `city?`, `state?`, `zip?`), `notes?`, `status` (enum `RecordStatus`), timestamps, `pets`, `sales` | índices `(companyId, nameKey)`, `(companyId, status)`, `(companyId, name)`, `(companyId, phone)`, `(companyId, mobile)`, `(companyId, email)`; **sem unique** em `nameKey` — duplicidade é checada na aplicação (mesmo nome + contato igual com ativo → 409) |
| `Pet` | `companyId` (FK `Restrict`), `clientId` (FK `Restrict`), `name`, `species` (enum `PetSpecies`), `breed?`, `sex` (enum `PetSex`, default `UNKNOWN`), `birthDate?`, `weight?` `Decimal(6,2)`, `color?`, `notes?`, `status`, timestamps | índices `(companyId, status)`, `(companyId, name)`, `(clientId)`; responsável sempre da mesma empresa (validado na API) |
| `Service` | `companyId` (FK `Restrict`), `name`, `nameKey`, `description?`, `durationMinutes?` (`Int`), `price` `Decimal(12,2)`, `status`, timestamps | único `(companyId, nameKey)` (nome de catálogo único por empresa, case-insensitive); índices `(companyId, status)`, `(companyId, name)` |

Enums novos:

- `PetSpecies`: `DOG`, `CAT`, `BIRD`, `RODENT`, `REPTILE`, `FISH`, `OTHER`.
- `PetSex`: `MALE`, `FEMALE`, `UNKNOWN`.

Alteração em modelo existente:

- `Sale.clientId` (`String?`, FK → `Client`, `SetNull`, índice
  `(companyId, clientId)`): vínculo opcional da venda com o cliente;
  inativar/apagar cliente nunca quebra vendas antigas (snapshot dos itens
  permanece).

Regras derivadas:

- **Anti-duplicidade de cliente** (suave, documentado em
  `ClientsService`): `nameKey` = `nome.trim().toLowerCase()` com espaços
  colapsados; telefone armazenado só com dígitos, email em minúsculas
  (normalização feita no Zod compartilhado); o bloqueio 409 ocorre quando
  o `nameKey` coincide **e** algum contato (phone/mobile/email) também
  coincide com cliente `ACTIVE` — homônimos sem contato e famílias com
  mesmo telefone nunca bloqueiam; janela de corrida aceita (sem unique
  duro no banco).
- Nome de serviço é único por empresa via `nameKey` (mesmo padrão das
  categorias); preços `Decimal(12,2)` não negativos.
- Cliente/Pet com `status = INACTIVE` permanecem para histórico; pet de
  cliente inativo não pode ser criado (400), mas os existentes são
  preservados.

## Modelos implementados (Etapa 4)

Migration: `database/prisma/migrations/20261009212628_etapa4_cash_finance`.

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `CashSession` | `companyId` (FK `Restrict`), `status` (enum `CashSessionStatus`), `initialAmount` `Decimal(12,2)`, `openingNotes?`, `openedByUserId` (FK `Restrict`), `openedAt`, `closedAt?`, `closedByUserId?` (FK `SetNull`), `closingNotes?`, `countedAmount?`, `expectedAmount?`, `difference?` (`Decimal(12,2)`), `movements`, `sales` | índices `(companyId, status)` e `(companyId, openedAt)`; sem `updatedAt` — a sessão muda apenas na abertura/fechamento |
| `CashMovement` | `companyId` (FK `Restrict`), `cashSessionId` (FK `Restrict`), `type` (enum `CashMovementType`), `origin` (enum `CashMovementOrigin`), `inCash` `Boolean` (default `true`), `amount` `Decimal(12,2)`, `description`, `justification?`, `saleId?` (FK `Restrict`), `reversalOfId?` (auto-relação FK `Restrict`), `reversals`, `reversedAt?`, `reversedByUserId?` (FK `SetNull`), `reversalReason?`, `createdByUserId` (FK `Restrict`), `createdAt` | único `(origin, saleId)` (venda/cancelamento nunca duplicam lançamento; NULLs não conflitam); índices `(companyId, createdAt)`, `(companyId, cashSessionId)`, `(companyId, saleId)`; sem `updatedAt` — ledger imutável |

Enums novos:

- `CashSessionStatus`: `OPEN`, `CLOSED`.
- `CashMovementType`: `IN`, `OUT`.
- `CashMovementOrigin`: `MANUAL`, `SALE`, `SALE_CANCELMENT`, `REVERSAL`.

Alteração em modelo existente:

- `Sale.cashSessionId` (`String?`, FK → `CashSession`, `SetNull`): vincula a
  venda à sessão de caixa aberta no momento da venda; vendas anteriores à
  Etapa 4 ficam sem sessão/lançamento (dados de desenvolvimento).

Regras derivadas:

- **Uma única sessão `OPEN` por empresa**; serialização de abertura via
  `SELECT ... FOR UPDATE` na linha da `Company`.
- Saldos de caixa (`expectedAmount`, `difference`) calculados **somente no
  servidor** no fechamento: `inicial + Σ(IN inCash) − Σ(OUT inCash)`; a
  diferença é `contado − esperado`.
- `inCash` decide o que compõe o saldo físico: apenas venda com
  `paymentMethod = CASH` (e cancelamentos/estornos correspondentes) entra
  em entradas/saídas do caixa; CARD/PIX/OTHER geram lançamento com
  `inCash = false` (entram no resumo financeiro por origem/tipo).
- Venda e cancelamento criam **um único** lançamento (`origin = SALE` /
  `SALE_CANCELMENT`) na mesma transação, garantido também por
  `@@unique([origin, saleId])`.
- Estorno: apenas lançamentos `MANUAL` ainda não estornados; cria
  movimento compensatório (`origin = REVERSAL`, tipo oposto, mesma
  sessão) e marca o original (`reversedAt` via `updateMany` condicional —
  dupla corrida → 409); histórico nunca é apagado.
- Vendas/cancelamentos movimentações manuais exigem sessão `OPEN`
  (`SELECT ... FOR UPDATE` na sessão — lock de sessão **antes** dos
  produtos, ordem fixa, evita deadlock).

## Modelos implementados (Etapa 3)

Migration: `database/prisma/migrations/20261009205135_etapa3_sales_pdv`.

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `Sale` | `companyId` (FK `Restrict`), `receiptCode`, `clientRequestId?`, `status` (enum `SaleStatus`), `subtotal`/`discount`/`total` `Decimal(12,2)`, `paymentMethod` (enum `PaymentMethod`), `paymentNote?`, `createdByUserId` (FK `Restrict`), `cancelledAt?`, `cancelledByUserId?` (FK `SetNull`), `cancelReason?`, `createdAt`, `items` | únicos `(companyId, receiptCode)` e `(companyId, clientRequestId)` (NULLs não conflitam); índices `(companyId, createdAt)`, `(companyId, status)`; sem `updatedAt` — venda concluída só muda por cancelamento |
| `SaleItem` | `saleId` (FK `Restrict`), `productId` (FK `Restrict`), `productName`, `productSku?`, `unit` (enum `ProductUnit`), `unitPrice` `Decimal(12,2)`, `quantity` `Decimal(12,3)`, `subtotal` `Decimal(12,2)` | índice `(saleId)`; snapshot imutável de nome/SKU/unidade/preço no momento da venda |

Enums novos:

- `PaymentMethod`: `CASH`, `CARD`, `PIX`, `OTHER`.
- `SaleStatus`: `COMPLETED`, `CANCELLED` (cancelamento lógico — nenhuma
  exclusão física de venda ou item).

Regras derivadas:

- Preços e totais **recalculados no servidor** a partir de
  `Product.salePrice`; valores do cliente nunca entram na gravação.
- Criação da venda, itens, baixa de estoque e movimentos `OUT` ocorrem em
  **uma única transação**, com lock `FOR UPDATE` dos produtos em ordem
  de `id` (mesma regra de ordenação no cancelamento — evita deadlock).
- `clientRequestId` torna a criação **idempotente**: reenvio/duplo clique
  → 409, sem segunda venda nem dupla baixa.
- Cancelamento devolve estoque com movimentos `IN` usando
  `reference = receiptCode`; `updateMany({ status: COMPLETED })` garante
  devolução única (corrida entre cancelamentos → 409).

## Modelos implementados (Etapa 2)

Migration: `database/prisma/migrations/20261009194843_etapa2_products_stock`.

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `Category` | `companyId` (FK), `name`, `nameKey`, `description?`, `status` (enum `RecordStatus`), timestamps | único `(companyId, nameKey)` — `nameKey` = nome em minúsculas para unicidade case-insensitive |
| `Supplier` | `companyId` (FK), `name`, `document?`, `email?`, `phone?`, `notes?`, `status`, timestamps | índices `(companyId, status)`, `(companyId, name)`; CPF/CNPJ tratado como texto (validação de formato pendente) |
| `Product` | `companyId` (FK), `categoryId?` (FK `SetNull`), `supplierId?` (FK `SetNull`), `name`, `description?`, `sku?`, `barcode?`, `unit` (enum `ProductUnit`), `costPrice`/`salePrice` `Decimal(12,2)`, `stockQuantity`/`minimumStock` `Decimal(12,3)`, `status`, timestamps | únicos `(companyId, sku)` e `(companyId, barcode)` (NULLs não conflitam no Postgres); índices `(companyId, status)`, `(companyId, name)` |
| `StockMovement` | `companyId` (FK), `productId` (FK `Restrict`), `type` (enum `StockMovementType`), `quantity` `Decimal(12,3)`, `notes?`, `reference?`, `createdByUserId` (FK `Restrict`), `createdAt` | índices `(companyId, productId, createdAt)`, `(companyId, createdAt)`; sem `updatedAt` — histórico imutável |

Regras derivadas:

- **Saldo materializado** em `Product.stockQuantity`; entrada/saída/ajuste
  atualizam saldo e criam `StockMovement` na mesma transação, com lock
  pessimista (`SELECT ... FOR UPDATE`) por produto — movimentações
  concorrentes não geram saldo negativo ou divergente.
- Histórico **não editável** por operações comuns: não existem endpoints de
  update/delete de movimentos; correções são novos movimentos compensatórios.
- Alerta de estoque baixo: produto `ACTIVE` com `minimumStock > 0` e
  `stockQuantity <= minimumStock`.
- Unidades aceitas: `UNIDADE`, `KG`, `G`, `L`, `ML`, `CAIXA`, `PACOTE`,
  `ROLLO`; quantidades com até 3 casas decimais; preços com até 2, nunca
  negativos (validados também no Zod compartilhado).
- SKU é normalizado para maiúsculas; barcode e códigos vazios viram `NULL`.
- Nenhuma exclusão física de produto com movimentações: apenas inativação.

## Modelos implementados (Etapa 1)

Migration: `database/prisma/migrations/20261009185907_etapa1_auth_tenancy`
(aplicada em `petflow` e `petflow_test`).

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `Company` | `id`, `name`, `slug`, `status` (enum), `createdAt`, `updatedAt` | `slug` único |
| `User` | `id`, `companyId` (FK → `Company`), `name`, `email`, `passwordHash`, `role` (enum `ADMIN`/`STAFF`), `status` (enum `ACTIVE`/`INACTIVE`), timestamps | único `(companyId, email)`; email normalizado (trim+minúsculas) antes da validação; `onDelete: Restrict` |
| `Session` | `id`, `userId` (FK → `User`), `tokenHash` (SHA-256 do cookie), `expiresAt`, `createdAt` | `tokenHash` único; `userId` com cascade de exclusão lógica via revogação no logout/inativação; índices em `userId` e `expiresAt` |

Regras derivadas:

- Sessões nunca armazenam o token em texto puro; apenas o hash.
- Inativar usuário (`User.status = INACTIVE`) revoga suas sessões.
- Bootstrap (`npm run bootstrap:admin`) cria `Company` + `User` ADMIN de forma
  idempotente (checagem prévia por email/slug), via variáveis `BOOTSTRAP_*`.
- Nenhuma tabela de negócio fora do escopo da Etapa 1 foi criada.

## Isolamento multiempresa

- Toda entidade de negócio terá `companyId` obrigatório, com foreign key para a
  tabela `companies` e índice composto `(companyId, id)` ou equivalente.
- Todas as consultas da API serão filtradas por `companyId` do contexto
  autenticado (middleware/filtro de tenant).
- Identificadores externos (ex.: telefone no WhatsApp, código de produto) serão
  únicos dentro da empresa, não globalmente.
- Já implementado em `User`: unicidade de email por empresa e todos os
  accessos escopados pelo `companyId` da sessão autenticada.

## Integridade referencial

- Foreign keys explícitas com `onDelete` definido (evitar cascade amplo;
  preferir `RESTRICT` ou `SET NULL` conforme o caso).
- Soft delete (`deletedAt`) apenas quando houver necessidade real de histórico
  preservado; caso contrário, exclusão lógica por status.

## Histórico de movimentações

- Estoque, caixa e vendas terão tabelas de movimentação (ledger), nunca apenas
  "saldo" atual — permitindo auditoria e conciliação.
- Alterações críticas podem registrar `createdBy`/`updatedBy`.

## Valores monetários

- Valores em `Decimal(12, 2)` (colunas `DECIMAL`), nunca `FLOAT`.
- Quantidades de estoque em `Decimal(12, 3)` quando houver unidade fracionada.
- Datas e horários em UTC (`TIMESTAMP`); exibição no fuso local no frontend.

## Padrões de colunas

- IDs: `TEXT` (CUID) via Prisma ou `UUID`; decidir um padrão único por modelo.
- `createdAt` / `updatedAt` obrigatórios em toda tabela de negócio.
- Enums do Postgres para estados fechados (status de venda, tipo de
  movimentação), evitando strings livres.

## Migrations e seeds

- Toda mudança de schema é migration versionada em `database/prisma/migrations/`.
- Seeds ficam em `database/seeds/` e devem ser idempotentes.
- O schema é validado na CI/etapa com `npm run db:validate`.
