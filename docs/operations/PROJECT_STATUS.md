# Status do projeto — PetFlow

## Etapa atual

**Etapa 2 — Produtos, estoque, fornecedores e movimentações** — CONCLUÍDA
(aguardando aprovação do proprietário para avançar).

Data: 2026-10-09.

Etapas anteriores: Etapa 0 (2026-10-09), Etapa 1 (2026-10-09).

## Entregas concluídas (Etapa 2)

- [x] Migration `20261009194843_etapa2_products_stock` aplicada em `petflow`
      (dev) e `petflow_test` (testes); schema validado.
- [x] Modelos: `Category` (nome único por empresa via `nameKey`),
      `Supplier`, `Product` (SKU/barcode únicos por empresa quando
      preenchidos, saldo materializado `Decimal(12,3)`),
      `StockMovement` (histórico imutável com autor).
- [x] API: categorias, fornecedores e produtos (CRUD + paginação/busca/
      filtros) e estoque (entrada, saída, ajuste, saldo, histórico,
      alertas) — ver `docs/architecture/API.md`.
- [x] Consistência de estoque: saldo e movimento na mesma transação com
      lock `FOR UPDATE`; saídas/ajustes que deixariam saldo negativo são
      rejeitados; concorrência coberta por teste real.
- [x] Permissões: escrita de catálogo/produtos e ajustes restritos a
      `ADMIN`; leitura e entradas/saídas liberadas a usuários autenticados;
      escopo sempre pelo `companyId` da sessão.
- [x] Frontend: `/produtos` (busca, filtros, paginação, alerta de estoque
      baixo), detalhe com saldo/histórico/formulários, `/produtos/novo`,
      `/produtos/[id]/editar`, `/categorias`, `/fornecedores`.
- [x] Home exibe "Produtos e estoque" como módulo disponível.

## Testes executados

| Verificação | Comando | Resultado |
|---|---|---|
| Schema Prisma válido | `npm run db:validate` | OK |
| Lint | `npm run lint` | OK (0 erros) |
| Typecheck | `npm run typecheck` | OK (4 workspaces) |
| Testes (PostgreSQL real) | `npm test` | 76/76 aprovados (6 arquivos) |
| Build | `npm run build` | OK (shared, api, web, worker) |
| E2E API | fluxo login→CRUD→movimentações | 200/201/400 conforme esperado |
| E2E web | `GET /produtos`, `/categorias`, `/fornecedores`, detalhe | 200 |

Cobertura dos testes novos (53): CRUD e validações de catálogo/produtos,
duplicidade de SKU/barcode/categoria, categoria/fornecedor de outra empresa
(400/404), entrada/saída/ajuste, saldo negativo bloqueado, justificativa
obrigatória, quantidade zero/negativa, falha transacional sem efeito,
concorrência (5 saídas de 3 sobre saldo 5 → exatamente 1 aprovada, saldo
final 2), histórico com autor/data/tipo/motivo, alertas de estoque baixo,
autenticação/permissão negadas e isolamento multiempresa.

## Pendências conhecidas

- CI (lint + typecheck + testes) quando solicitado.
- Validação de formato de CPF/CNPJ (hoje apenas texto com limite de
  tamanho) — avaliar na etapa de clientes/fornecedores avançado.
- Estoque negativo nunca é permitido por padrão; se houver necessidade
  futura de venda com saldo insuficiente (backorder), será decisão explícita.
- Integração da pasta `automação do whatsapp/` em etapa própria.

## Git

- Branch: `main`; remoto: `origin` → `https://github.com/Tanattos18/PetFlow.git`.
- Commits da Etapa 1 e Etapa 2 (hashes registrados no relatório final).

## Próxima etapa autorizada

**Etapa 3** — a iniciar somente após aprovação explícita do proprietário.
