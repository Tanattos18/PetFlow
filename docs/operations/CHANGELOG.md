# Changelog — PetFlow

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Etapa 5] — 2026-10-09

### Adicionado

- Schema Prisma: modelos `Client`, `Pet` e `Service` (+ enums
  `PetSpecies` e `PetSex`), campo opcional `Sale.clientId` (FK
  `SetNull`, índice `(companyId, clientId)`) e migration aditiva
  `20261009222638_etapa5_clients_pets_services` aplicada em `petflow` e
  `petflow_test`; sem quebra de dados existentes.
- API NestJS (prefixo `/api`, sob `AuthGuard` global):
  - `clients`: `GET /clients` (busca por nome/telefone/mobile/email/CPF,
    filtros de status e paginação), `GET /clients/:id`,
    `GET /clients/:id/pets`, `POST`, `PATCH /:id`, `PATCH /:id/status`
    (escrita autenticada — operação diária, inclui MEMBER).
  - `pets`: `GET /pets` (busca por pet/raça/cor/responsável, filtros de
    responsável/espécie/status), `GET /pets/:id` (com responsável),
    `POST`, `PATCH /:id` (inclui troca de responsável validado),
    `PATCH /:id/status` (escrita autenticada).
  - `services`: `GET /services` (busca, ordenação por nome/preço,
    paginação), `GET /services/:id`, `POST`, `PATCH /:id`,
    `PATCH /:id/status` (escrita restrita a ADMIN — catálogo/preços).
- **Anti-duplicidade de clientes** (documentado no `ClientsService`):
  normalização server-side (`nameKey` = nome minúsculo com espaços
  colapsados, telefone só dígitos, email minúsculo) + pre-check na mesma
  transação — bloqueia apenas quando `nameKey` coincide **e** há telefone/
  mobile/email igual com um cliente `ACTIVE` (409
  `"Cliente possivelmente duplicado"`); nome sozinho nunca bloqueia
  (homônimos), contato sozinho nunca bloqueia (famílias) e `INACTIVE`
  não sinaliza duplicidade; sem unique duro de `nameKey` no banco (janela
  de corrida aceita e documentada).
- Serviços com `nameKey` único por empresa (`@@unique([companyId,
  nameKey])`, como categorias): nome repetido (case-insensitive,
  espaços colapsados) → 409; preço `Decimal(12,2)` obrigatório ≥ 0 e
  duração 1..1440 minutos quando informada.
- Integração venda–cliente: `POST /sales` aceita `clientId` opcional
  (validado `ACTIVE` e da mesma empresa; inativo/outros → 400); listagem
  e detalhe passam a retornar `client { id, name }`; snapshots e totais
  das vendas preservados.
- Schemas Zod compartilhados em `@petflow/shared`: `createClientSchema`,
  `updateClientSchema`, `listClientsQuerySchema`, `createPetSchema`,
  `updatePetSchema`, `listPetsQuerySchema`, `createServiceSchema`,
  `updateServiceSchema`, `listServicesQuerySchema`, enums
  `petSpecies`/`petSex`, labels e helpers `normalizePhone` (data de
  nascimento no futuro → 400; peso 0..999.99 kg).
- Frontend: `/clientes` (lista com busca, contagem de pets, formulário
  completo de cadastro/endereço, ativar/inativar),
  `/clientes/[id]` (ficha do responsável + gestão de pets com
  responsável), `/pets` (listagem global com filtros de
  espécie/responsável/status + cadastro/edição), `/servicos`
  (catálogo com busca/preço/duração, escrita só para ADMIN); `/pdv`
  ganha seletor opcional de cliente ("Venda rápida sem cliente" por
  padrão); `/vendas` e detalhe exibem o cliente; home marca "Clientes e
  animais" e "Serviços" como disponíveis (agendamentos separado "Em
  breve"); badge "Etapa 5".
- Testes de integração com PostgreSQL real: 49 novos testes
  (`clients.test.ts` 20, `pets.test.ts` 12, `services.test.ts` 13 e 4 em
  `sales.test.ts`), totalizando **190** — incluem normalização,
  duplicidade 409 vs. homônimos/famílias, permissões MEMBER/ADMIN,
  troca de responsável, isolamento multiempresa e venda com/sem cliente.
- Validação E2E manual: **40/40 verificações** (CRUD de clientes/pets/
  serviços, normalizações, 409 de duplicidade, validações 400, venda com
  cliente, venda rápida sem cliente e páginas 200).

### Regras de negócio registradas

- Cliente duplicado = mesmo nome normalizado **e** mesmo contato ativo;
  nomes iguais sem contato e contatos iguais com nomes diferentes são
  permitidos (famílias/homônimos).
- Leitura de clientes/pets/serviços exige sessão; escrita de clientes e
  pets é operação diária (MEMBER), escrita de serviços é de catálogo
  (ADMIN).
- Vínculo de venda com cliente é opcional e validado no servidor
  (cliente ativo da mesma empresa); PDV continua suportando venda
  rápida sem cliente.
- Pet sempre pertence a um responsável ativo da mesma empresa; troca de
  responsável validada; desativação nunca apaga histórico (vendas
  mantêm o snapshot/`SetNull`).

### Preservado

- Pasta `automação do whatsapp/` intacta; contratos da Etapa 4 (caixa,
  `inCash`, 404 em `current`) inalterados; vendas sem `clientId`
  continuam válidas.

## [Etapa 4] — 2026-10-09

### Adicionado

- Schema Prisma: modelos `CashSession` e `CashMovement` (+ enums
  `CashSessionStatus`, `CashMovementType`, `CashMovementOrigin`), campo
  `Sale.cashSessionId` (FK `SetNull`) e migration
  `20261009212628_etapa4_cash_finance` aplicada em `petflow` e
  `petflow_test`; ledger imutável com único `(origin, saleId)`.
- API NestJS (prefixo `/api`, sob `AuthGuard` global, módulo `cash`):
  - `POST /cash/sessions` e `POST /cash/sessions/:id/close` (ADMIN),
    `GET /cash/sessions/current` (404 sem sessão aberta),
    `GET /cash/sessions`, `GET /cash/sessions/:id/summary`.
  - `POST /cash/movements` (ADMIN) e `GET /cash/movements` (filtros
    período/sessão/tipo/origem + paginação).
  - `POST /cash/movements/:id/reversal` (ADMIN) — estorno auditável.
  - `GET /cash/summary` — resumo financeiro por período/sessão calculado
    no servidor (vendas, manuais, cancelamentos, estornos, entradas,
    saídas, líquido).
- Uma **única sessão aberta por empresa**: abertura serializada com
  `SELECT ... FOR UPDATE` na `Company` (duplicidade → 409); fechamento
  calcula `expected = inicial + Σ(IN inCash) − Σ(OUT inCash)` e
  `difference = contado − expected` no servidor.
- **Vendas e cancelamentos exigem caixa aberto** (409 `"Caixa fechado:
  abra o caixa para ..."`); na mesma transação a venda grava
  `cashSessionId` e cria lançamento `SALE` (`inCash` = venda em
  dinheiro); cancelamento cria lançamento `SALE_CANCELMENT` único.
- Movimentações manuais (`IN`/`OUT`, `origin = MANUAL`, `inCash = true`)
  com sessão aberta; saída exige justificativa (mín. 3).
- Estorno: apenas `MANUAL` não estornado na sessão aberta; cria
  `REVERSAL` do tipo oposto e marca o original (`reversedAt` via
  `updateMany` condicional — duplo estorno → 409); estorno de venda → 400.
- Schemas Zod compartilhados em `@petflow/shared`:
  `openCashSessionSchema`, `closeCashSessionSchema`,
  `createCashMovementSchema`, `reversalCashMovementSchema`,
  `listCashMovementsQuerySchema`, `cashSummaryQuerySchema`, enums e
  labels.
- Frontend: `/caixa` (situação, abertura, movimentações recentes e form
  de entrada/saída), `/caixa/fechar` (saldo esperado vs. contado),
  `/caixa/movimentos` (filtros + estorno com motivo),
  `/caixa/sessoes` (histórico com totais/diferença), `/financeiro`
  (resumo por período); `/pdv` exibe banner "Caixa fechado" e bloqueia a
  finalização; home marca "Caixa e financeiro" como disponível.
- Testes de integração com PostgreSQL real: 37 novos testes
  (`cash.test.ts`), totalizando 141 — incluem integração com vendas
  (`inCash` CASH vs. Pix), cancelamento único, estorno (400/403/409),
  fechamento com diferença, resumo por período, isolamento multiempresa
  e 4 aberturas concorrentes (exatamente 1 sucesso).
- `tests/sales.test.ts` passa a abrir caixa no `beforeAll` (regra nova).
- Validação E2E manual: 30/30 verificações (venda com caixa fechado 409,
  abertura, `inCash` nas duas formas de pagamento, saída sem justificativa
  400, cancelamento único, duplo estorno 409, resumo, fechamento com
  diferença −2.50, duplo fechamento 409, reabertura e páginas 200).

### Regras de negócio registradas

- Uma única sessão de caixa aberta por empresa; vendas, cancelamentos e
  movimentações manuais exigem sessão aberta.
- Saldo esperado e diferença calculados sempre no servidor; data sempre
  do servidor (sem backdating).
- Apenas dinheiro físico (`inCash`) compõe o saldo do caixa; demais
  formas de pagamento entram no resumo financeiro.
- Lançamentos nunca são editados/apagados: estorno cria lançamento
  compensatório com auditoria (autor, data, motivo).

## [Etapa 3] — 2026-10-09

### Adicionado

- Schema Prisma: modelos `Sale` e `SaleItem` (+ enums `PaymentMethod`,
  `SaleStatus`) e migration `20261009205135_etapa3_sales_pdv` aplicada em
  `petflow` e `petflow_test`.
- API NestJS (prefixo `/api`, todos sob `AuthGuard` global):
  - `sales`: `POST /sales` (criação), `GET /sales` (histórico com filtros
    de status, código e período), `GET /sales/:id` (detalhe),
    `POST /sales/:id/cancel` (ADMIN).
- Criação de venda em **transação única**: lock `FOR UPDATE` dos produtos
  em ordem determinística, recálculo de preços/totais com os valores do
  banco (nunca do cliente), gravação da venda + itens (snapshot de nome,
  SKU, unidade, preço e quantidade), baixa de estoque e movimentos `OUT`
  com `reference` = código do comprovante.
- Prevenção de venda duplicada: `clientRequestId` com
  `@@unique([companyId, clientRequestId])` → reenvio/duplo clique
  respondem 409 sem alterar estoque; código de comprovante `PF-XXXXXXXX`
  único por empresa.
- Cancelamento de venda (ADMIN): motivo obrigatório (mín. 3), marca
  `CANCELLED` com autor/data via `updateMany` condicional (segundo
  cancelamento → 409, nunca devolve estoque duas vezes) e devolve o saldo
  com movimentos `IN` compensatórios; venda concluída nunca é apagada.
- Schemas Zod compartilhados em `@petflow/shared`: `createSaleSchema`,
  `createSaleItemSchema`, `cancelSaleSchema`, `listSalesQuerySchema`,
  enums e labels de pagamento/status.
- Frontend: `/pdv` (busca de produtos por nome/SKU/código de barras,
  carrinho com quantidades, desconto, formas de pagamento
  Dinheiro/Cartão/Pix/Outro, finalização com confirmação, comprovante
  imprimível em nova janela), `/vendas` (histórico com filtros de status,
  código e período + paginação), `/vendas/[id]` (detalhe com itens,
  comprovante, cancelamento com motivo e confirmação); home exibe
  "Vendas e PDV" como módulo disponível.
- Testes de integração com PostgreSQL real: 28 novos testes
  (`sales.test.ts`), totalizando 104 — incluem adulteração de totais,
  reenvio idempotente, concorrência, snapshots, cancelamento único e
  isolamento multiempresa.
- Validação E2E manual: 25/25 verificações (venda com desconto
  recalculada, estoque baixado/devolvido, 409 em reenvio e
  recancelamento, páginas `/pdv`, `/vendas` e detalhe).

### Regras de negócio registradas

- Backend sempre recalcula preços e totais; valores enviados pelo frontend
  são ignorados.
- Venda, itens e baixa de estoque em uma única transação; estoque negativo
  nunca é permitido.
- Vendas concluídas são preservadas (cancelamento lógico com auditoria).

## [Etapa 2] — 2026-10-09

### Adicionado

- Schema Prisma: modelos `Category`, `Supplier`, `Product` e `StockMovement`
  (+ enums `RecordStatus`, `ProductUnit`, `StockMovementType`) e migration
  `20261009194843_etapa2_products_stock` aplicada em `petflow` e
  `petflow_test`.
- API NestJS (prefixo `/api`, todos sob `AuthGuard` global):
  - `categories`: `GET /categories`, `GET /categories/:id`,
    `POST`, `PATCH /:id`, `PATCH /:id/status` (escrita: ADMIN).
  - `suppliers`: mesmo padrão de categorias.
  - `products`: `GET /products` (busca por nome/SKU/barcode, filtros por
    categoria/fornecedor/status/estoque baixo, paginação ≤100),
    `GET /products/:id`, `POST`, `PATCH /:id`, `PATCH /:id/status` (escrita:
    ADMIN).
  - `stock`: `POST /stock/entries`, `POST /stock/exits` (autenticados),
    `POST /stock/adjustments` (ADMIN, justificativa obrigatória),
    `GET /stock/balance/:productId`, `GET /stock/movements` (histórico
    paginado), `GET /stock/low-stock` (alertas).
- Saldo **materializado** em `Product.stockQuantity` (Decimal 12,3),
  atualizado na mesma transação do movimento, com lock pessimista
  (`SELECT ... FOR UPDATE`) contra concorrência; histórico imutável
  (sem endpoints de edição/exclusão).
- Schemas Zod compartilhados em `@petflow/shared` (criação/edição de
  catálogo, produto, movimentações e queries com paginação).
- Frontend: `/produtos` (lista com busca, filtros, paginação e alerta de
  estoque baixo), `/produtos/novo`, `/produtos/[id]` (detalhe, saldo,
  histórico e formulários de entrada/saída/ajuste),
  `/produtos/[id]/editar`, `/categorias`, `/fornecedores`; home exibe
  "Produtos e estoque" como módulo disponível.
- Testes de integração com PostgreSQL real: 53 novos testes
  (`catalog.test.ts`, `products.test.ts`, `stock.test.ts`), totalizando
  76 — incluem isolamento multiempresa e concorrência de movimentações.

### Regras de negócio registradas

- Unidades: `UNIDADE`, `KG`, `G`, `L`, `ML`, `CAIXA`, `PACOTE`, `ROLLO`;
  quantidades Decimal(12,3); preços Decimal(12,2) não negativos.
- Saída/ajuste negativo que resultaria em saldo negativo é rejeitado (400).
- Ajustes exigem justificativa (mín. 3 caracteres) e papel ADMIN.
- Alerta de estoque baixo: produto `ACTIVE` com `minimumStock > 0` e
  `stockQuantity <= minimumStock`.
- SKU (maúsculas) e código de barras únicos por empresa quando preenchidos;
  nome de categoria único por empresa (case-insensitive via `nameKey`).
- Categoria/fornecedor de produto validados contra a empresa autenticada;
  recursos de outra empresa respondem 404.

### Preservado

- Pasta `automação do whatsapp/` intacta; proteções da Etapa 1 ativas.

## [Etapa 1] — 2026-10-09

### Adicionado

- Schema Prisma com modelos `Company`, `User` e `Session` (+ enums de status
  e papel) e migration `20261009185907_etapa1_auth_tenancy` aplicada nos
  bancos `petflow` (dev) e `petflow_test` (testes).
- Autenticação por sessão com cookie `HttpOnly` (token aleatório armazenado
  como SHA-256 na tabela `Session`), com expiração e revogação; senha com
  `bcryptjs` (12 rounds).
- Endpoints: `POST /api/auth/login`, `POST /api/auth/logout`,
  `GET /api/auth/me`, `GET|POST /api/users`,
  `PATCH /api/users/:id/status` (admin), `GET /api/health`.
- Guards globais `AuthGuard` + `AdminGuard`, decoradores `@Public`/`@Auth`,
  pipe `ZodValidationPipe` e middleware de verificação de `Origin`.
- Rate limit de login em memória (5 tentativas/15 min por IP+email,
  configurável via `AUTH_RATE_LIMIT_MAX`) e CORS com allowlist `APP_ORIGINS`.
- CLI `npm run bootstrap:admin`: criação idempotente de empresa + primeiro
  administrador via variáveis de ambiente (`BOOTSTRAP_*`).
- Frontend: `/login`, área protegida `/` com usuário/empresa e logout,
  `/usuarios` (listagem/criação/ativação de usuários, admin); proxy
  rewrites do Next (`/api/:path*` → `localhost:3001`).
- Testes de integração reais com PostgreSQL (`petflow_test`): 23 testes
  cobrindo login, sessão, logout, permissões, rate limit, normalização de
  email e isolamento multiempresa.

### Alterado

- Scripts da raiz: `build:shared` antecede `dev:api`, `build`, `typecheck` e
  `test` (evita `packages/shared/dist` desatualizado).
- Prefixo global da API `/api` (health fora do prefixo); `cookie-parser`
  registrado no bootstrap.

### Corrigido

- Injeção de dependência no runtime `tsx` (esbuild não emite
  `emitDecoratorMetadata`): `@Inject()` explícito nos providers com
  construtor injetado.
- Filtro global de exceções não embrulhava mais a resposta duas vezes
  (`message` sempre string; `issues` do Zod preservado).
- Schemas Zod de email fazem `trim`/`toLowerCase` antes da validação.

### Preservado

- Pasta `automação do whatsapp/` intacta; nenhum arquivo da Etapa 0 removido.

### Notas

- Nenhum segredo real em código/Git (`.env` local apenas, não versionado).
- Módulos de negócio permanecem fora do escopo (Etapa 2+).

## [Etapa 0] — 2026-10-09

### Adicionado

- Monorepo com npm workspaces (`apps/*`, `packages/*`).
- `apps/api`: aplicação NestJS mínima com `GET /health` e filtro global de
  exceções.
- `apps/web`: aplicação Next.js mínima com Tailwind CSS, layout de boas-vindas
  e listagem informativa dos módulos planejados (sem funcionalidades).
- `apps/worker`: processo stub de background tasks com heartbeat e shutdown
  gracioso.
- `packages/shared`: pacote com constantes e schemas Zod de base
  (paginação, formato de erro de API).
- `packages/config`: `tsconfig.base.json` compartilhado.
- `database/`: schema Prisma técnico (sem tabelas de negócio), pastas de
  migrations e seeds documentadas.
- `tests/health.test.ts`: testes Vitest + Supertest do health check e do 404
  tratado.
- Documentação: PRD, ARCHITECTURE, DATABASE (diretrizes), DEVELOPMENT,
  CHANGELOG, PROJECT_STATUS, IMPLEMENTATION_CHECKLIST e AGENTS.md.
- Configuração de ESLint 9 (flat config), Vitest e `.env.example`.

### Preservado

- Pasta `automação do whatsapp/` (base existente de automação WhatsApp)
  mantida intacta, sem alterações.
- Documento `PETFLOW — ETAPA 0.txt` (entrada do processo) mantido na raiz.

### Notas

- Nenhum módulo de negócio implementado (regra da Etapa 0).
- Nenhum segredo real presente nos arquivos criados.
