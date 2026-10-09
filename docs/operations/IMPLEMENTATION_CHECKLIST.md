# Checklist geral de implementação — PetFlow

## Etapa 0 — Base do projeto

- [x] Inspecionar diretório, Git, dependências e configurações existentes
- [x] Preservar arquivos preexistentes (`automação do whatsapp/`, documento da etapa)
- [x] Criar monorepo (npm workspaces)
- [x] `apps/api` — NestJS mínimo com health check e tratamento de erros
- [x] `apps/web` — Next.js + Tailwind mínimo
- [x] `apps/worker` — stub de tarefas em segundo plano
- [x] `packages/shared` — tipos/validações compartilhados (base)
- [x] `packages/config` — tsconfig base
- [x] `database/` — schema Prisma técnico + migrations/seeds organizados
- [x] Scripts de dev, build, lint e testes
- [x] `.env.example` sem segredos
- [x] `.gitignore` adequado
- [x] Testes (health check via Vitest + Supertest)
- [x] Documentação: PRD, ARCHITECTURE, DATABASE, DEVELOPMENT, CHANGELOG, PROJECT_STATUS, AGENTS.md
- [x] Validações executadas com evidência

## Etapa 1 — Autenticação, empresas, usuários, permissões e isolamento multiempresa

Escopo definido em `Etapas_projeto/PetFlow_Prompt_OpenCode_Etapa_1.md`.

- [x] Ambiente verificado: PostgreSQL 17 local (sem Docker), bancos `petflow`
      e `petflow_test` criados, `DATABASE_URL` em `.env` local
- [x] Schema Prisma: `Company`, `User`, `Session` + enums; migration
      `20261009185907_etapa1_auth_tenancy` aplicada nos dois bancos
- [x] `npm run db:validate` — schema válido
- [x] Bootstrap seguro e idempotente via CLI (`npm run bootstrap:admin`,
      credenciais por `BOOTSTRAP_*` no ambiente, sem senha padrão)
- [x] Login/logout/`me` com cookie HttpOnly (token SHA-256 em `Session`),
      revogação efetiva no logout e na inativação de usuário
- [x] Endpoints privados protegidos por `AuthGuard` global; permissão
      administrativa verificada no backend (`AdminGuard`)
- [x] Isolamento multiempresa: `companyId` derivado do contexto autenticado;
      testes de acesso cruzado (404/escopo) aprovados
- [x] Rate limit de login, verificação de `Origin`, CORS com allowlist
- [x] Frontend: `/login`, área protegida `/` (empresa + usuário + logout),
      `/usuarios` (admin), proxy rewrites Next → API
- [x] Testes de integração com PostgreSQL real: 23/23 aprovados
      (`tests/auth.test.ts`, `tests/users.test.ts`, `tests/health.test.ts`)
- [x] `npm run lint` — 0 erros
- [x] `npm run typecheck` — OK (4 workspaces)
- [x] `npm run build` — OK (shared, api, web, worker)
- [x] Validação manual E2E: health 200, login 200 (API e via proxy web),
      `me` 200, `users` 200, logout 200, `me` 401 após logout, páginas 200
- [x] Documentação atualizada (CHANGELOG, PROJECT_STATUS, ARCHITECTURE,
      DATABASE, DEVELOPMENT, AGENTS)

## Etapa 2 — Produtos, estoque, fornecedores e movimentações

Escopo definido em `Etapas_projeto/PetFlow_Prompt_OpenCode_Etapa_2.md`.

- [x] Etapa 1 confirmada funcional (proteções de autenticação/tenant ativas)
- [x] Schema: `Category`, `Supplier`, `Product`, `StockMovement`; migration
      `20261009194843_etapa2_products_stock` aplicada em `petflow` e
      `petflow_test`; `npm run db:validate` OK
- [x] CRUD de categorias (nome único por empresa, inativação) pela API
- [x] CRUD de fornecedores (dados opcionais, inativação) pela API
- [x] CRUD de produtos (SKU/barcode únicos por empresa, categoria/fornecedor
      validados no servidor, preços/estoque mínimo não negativos)
- [x] Entradas/saídas/ajustes com saldo materializado + lock `FOR UPDATE`;
      ajustes exigem justificativa e ADMIN; saída não deixa saldo negativo
- [x] Saldo, histórico paginado (autor, data, tipo, motivo) e alertas de
      estoque baixo
- [x] Escrita de catálogo/produtos/ajustes restrita a ADMIN no backend;
      leitura e entradas/saídas para qualquer usuário autenticado
- [x] Frontend integrado: `/produtos`, detalhe com movimentações,
      `/produtos/novo`, `/produtos/[id]/editar`, `/categorias`,
      `/fornecedores` (busca, filtros, paginação, confirmação de inativação)
- [x] Testes: 76/76 aprovados em PostgreSQL real (CRUD, validações,
      duplicidade, isolamento multiempresa, concorrência, alertas)
- [x] `npm run lint`, `npm run typecheck`, `npm run build` OK
- [x] Validação E2E manual: login, categoria 201, fornecedor 201, produto
      201, entrada 10 → saldo 10, saída 3 → saldo 7, saída 999 → 400,
      ajuste −1 → saldo 6, saldo/histórico/alertas corretos, páginas 200
- [x] Documentação atualizada (CHANGELOG, STATUS, DATABASE, API, DEVELOPMENT,
      ARCHITECTURE, AGENTS)
- [x] Commit e push (ver relatório final / PROJECT_STATUS)

## Etapa 3 — Vendas e PDV (2026-10-09)

- [x] Etapa 2 confirmada funcional (76/76 testes antes de iniciar)
- [x] Schema: `Sale`, `SaleItem`; enums `PaymentMethod`, `SaleStatus`;
      migration `20261009205135_etapa3_sales_pdv` aplicada em `petflow` e
      `petflow_test`; `npm run db:validate` OK
- [x] `POST /api/sales`: recálculo de preços/totais no servidor, snapshot
      de nome/SKU/preço nos itens, baixa de estoque + movimentos `OUT` na
      mesma transação, lock `FOR UPDATE` dos produtos
- [x] Prevenção de venda duplicada (`clientRequestId` idempotente → 409) e
      código de comprovante (`PF-XXXXXXXX`) único por empresa
- [x] Rejeições: produto inexistente/inativo/de outra empresa (404/400),
      quantidade zero/negativa, estoque insuficiente, desconto negativo ou
      acima do subtotal; adulteração de preços/totais pelo cliente
      ignorada (servidor recalcula)
- [x] `GET /api/sales` (histórico paginado, filtros status/código/período)
      e `GET /api/sales/:id` (detalhe com itens e snapshots)
- [x] `POST /api/sales/:id/cancel`: ADMIN, motivo obrigatório, devolução
      única de estoque com movimentos `IN` compensatórios, auditoria
      (autor/data/motivo), venda nunca apagada fisicamente
- [x] Frontend: `/pdv` (busca por nome/SKU/barcode, carrinho com
      quantidades, desconto, formas de pagamento, finalização com
      confirmação e comprovante imprimível), `/vendas` (histórico com
      filtros), `/vendas/[id]` (detalhe + cancelamento com motivo e
      confirmação); sessão expirada redireciona para `/login`
- [x] Testes: 104/104 aprovados em PostgreSQL real (28 novos: validações,
      snapshots, idempotência, concorrência, cancelamento único,
      isolamento multiempresa)
- [x] `npm run lint`, `npm run typecheck`, `npm run build` OK
- [x] Validação E2E manual: 25/25 verificações (venda 3× com desconto →
      total do banco, estoque 10→7→10 no cancelamento, reenvio e
      recancelamento 409, páginas 200)
- [x] Documentação atualizada (CHANGELOG, STATUS, DATABASE, API,
      DEVELOPMENT, ARCHITECTURE)
- [x] Commit e push (ver relatório final / PROJECT_STATUS)

## Etapas futuras — módulos de negócio

- [ ] Cadastro de clientes e animais
- [x] Produtos e estoque (Etapa 2)
- [x] Vendas e PDV (Etapa 3)
- [ ] Caixa e financeiro
- [ ] Serviços e agendamentos
- [ ] Automação WhatsApp
- [ ] Dashboard e relatórios
- [ ] Assinaturas/multiempresa comercial

> Regra: nenhuma etapa é iniciada sem autorização explícita; marcar itens aqui
> apenas com evidência de execução.
