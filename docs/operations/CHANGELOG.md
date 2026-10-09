# Changelog — PetFlow

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

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
