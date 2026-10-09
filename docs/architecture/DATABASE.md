# Banco de dados — diretrizes (Etapa 0)

Nenhuma tabela de negócio foi criada nesta etapa. Este documento registra as
diretrizes que orientarão o modelo de dados nas próximas etapas.

## Isolamento multiempresa

- Toda entidade de negócio terá `companyId` obrigatório, com foreign key para a
  tabela `companies` e índice composto `(companyId, id)` ou equivalente.
- Todas as consultas da API serão filtradas por `companyId` do contexto
  autenticado (middleware/filtro de tenant).
- Identificadores externos (ex.: telefone no WhatsApp, código de produto) serão
  únicos dentro da empresa, não globalmente.

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
