# Status do projeto — PetFlow

## Etapa atual

**Etapa 3 — Vendas e PDV** — CONCLUÍDA
(aguardando aprovação do proprietário para avançar).

Data: 2026-10-09.

Etapas anteriores: Etapa 0 (2026-10-09), Etapa 1 (2026-10-09),
Etapa 2 (2026-10-09).

## Entregas concluídas (Etapa 3)

- [x] Migration `20261009205135_etapa3_sales_pdv` aplicada em `petflow`
      (dev) e `petflow_test` (testes); schema validado.
- [x] Modelos: `Sale` (código de comprovante único por empresa,
      `clientRequestId` idempotente, status, subtotal/desconto/total em
      `Decimal(12,2)`, forma de pagamento, cancelamento com autor/motivo/
      data) e `SaleItem` (snapshot imutável de nome, SKU, unidade, preço e
      quantidade); enums `PaymentMethod` (CASH, CARD, PIX, OTHER) e
      `SaleStatus` (COMPLETED, CANCELLED).
- [x] API: `POST /sales` (recalcula preços/totais do banco em transação
      única com venda + itens + baixa de estoque + movimentos OUT),
      `GET /sales` (histórico paginado com filtros status/código/período),
      `GET /sales/:id` (detalhe), `POST /sales/:id/cancel` (ADMIN, motivo
      obrigatório, devolve estoque com movimentos IN compensatórios,
      blindado contra duplo cancelamento) — ver `docs/architecture/API.md`.
- [x] Prevenção de venda duplicada: `clientRequestId` único por empresa →
      reenvio/duplo clique respondem 409 sem alterar estoque.
- [x] Permissões: criação/consulta liberadas a usuários autenticados;
      cancelamento restrito a `ADMIN`; empresa sempre da sessão.
- [x] Frontend: `/pdv` (busca por nome/SKU/barcode, carrinho, quantidades,
      desconto, formas de pagamento, finalização com confirmação e
      comprovante imprimível), `/vendas` (histórico com filtros),
      `/vendas/[id]` (detalhe, comprovante, cancelamento com motivo);
      home exibe "Vendas e PDV" como módulo disponível.

## Testes executados

| Verificação | Comando | Resultado |
|---|---|---|
| Schema Prisma válido | `npm run db:validate` | OK |
| Lint | `npm run lint` | OK (0 erros) |
| Typecheck | `npm run typecheck` | OK (4 workspaces) |
| Testes (PostgreSQL real) | `npm test` | 104/104 aprovados (7 arquivos) |
| Build | `npm run build` | OK (shared, api, web, worker) |
| E2E API | fluxo login→venda→estoque→cancelamento | 25/25 verificações OK |
| E2E web | `GET /pdv`, `/vendas`, `/vendas/[id]` | 200 |

Cobertura dos testes novos (28): venda válida (1 e vários produtos),
produto inexistente/inativo/de outra empresa (404/400), quantidade
zero/negativa, estoque insuficiente sem efeitos, desconto negativo ou
acima do subtotal, adulteração de preços/totais pelo cliente ignorada,
reenvio com `clientRequestId` (409), vendas concorrentes (5 de 3 sobre
saldo 5 → 1 aprovada, saldo final 2, estoque nunca negativo), snapshot de
nome/SKU/preço preservado após renomeação, histórico com filtros
(status/código/período) e paginação, cancelamento (permissão 403, motivo
400, devolução única de estoque, recancelamento 409) e isolamento
multiempresa (detalhe/cancelamento de outra empresa → 404).

## Pendências conhecidas

- CI (lint + typecheck + testes) quando solicitado.
- Validação de formato de CPF/CNPJ (hoje apenas texto com limite de
  tamanho) — avaliar na etapa de clientes/fornecedores avançado.
- Estoque negativo nunca é permitido por padrão; se houver necessidade
  futura de venda com saldo insuficiente (backorder), será decisão explícita.
- Formas de pagamento configuráveis além de Dinheiro/Cartão/Pix/Outro
  (hoje "Outro" aceita descrição livre).
- Integração da pasta `automação do whatsapp/` em etapa própria.

## Git

- Branch: `main`; remoto: `origin` → `https://github.com/Tanattos18/PetFlow.git`.
- `3b77828` feat(etapa-1): autenticação, usuários, permissões e multiempresa
- `6a36407` feat(etapa-2): implementa produtos e controle de estoque
- `e305d52` docs: registra hashes dos commits e push da etapa 2
- `912d1c8` feat(etapa-3): implementa vendas e ponto de venda
- Push confirmado: `e305d52..912d1c8 main -> main` (árvore de trabalho
  limpa, em sincronia com `origin/main`).

## Próxima etapa autorizada

**Etapa 4 — Caixa e financeiro** — a iniciar somente após aprovação
explícita do proprietário.
