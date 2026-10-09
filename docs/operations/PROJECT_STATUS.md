# Status do projeto — PetFlow

## Etapa atual

**Etapa 4 — Caixa e financeiro** — CONCLUÍDA
(aguardando aprovação do proprietário para avançar).

Data: 2026-10-09.

Etapas anteriores: Etapa 0 (2026-10-09), Etapa 1 (2026-10-09),
Etapa 2 (2026-10-09), Etapa 3 (2026-10-09).

## Entregas concluídas (Etapa 4)

- [x] Migration `20261009212628_etapa4_cash_finance` aplicada em `petflow`
      (dev) e `petflow_test` (testes); schema validado.
- [x] Modelos: `CashSession` (sessão única aberta por empresa, valores de
      abertura/fechamento em `Decimal(12,2)`, auditoria de quem abriu/
      fechou) e `CashMovement` (ledger imutável com `type`, `origin`,
      `inCash`, justificativa, vínculo com venda e auto-relação de
      estorno, único `(origin, saleId)`); `Sale.cashSessionId` (FK
      `SetNull`); enums `CashSessionStatus`, `CashMovementType`,
      `CashMovementOrigin`.
- [x] API módulo `cash` (prefixo `/api`): abrir/consultar/fechar
      sessões (`GET /sessions/current` responde 404 sem sessão),
      movimentações manuais (`POST /movements`, `OUT` exige
      justificativa) e histórico com filtros, estorno auditável
      (`POST /movements/:id/reversal`) e resumo financeiro
      (`GET /summary`) — escrita restrita a ADMIN, leitura autenticada.
- [x] Integração com vendas: `POST /sales` e `POST /sales/:id/cancel`
      exigem caixa aberto (409) e gravam `cashSessionId` + lançamento
      único (`SALE`/`SALE_CANCELMENT`) na mesma transação; `inCash` =
      venda/cancelamento em dinheiro.
- [x] Regras: saldo esperado e diferença calculados no servidor no
      fechamento; abertura serializada por lock na `Company` (duplicidade
      → 409); estorno apenas de `MANUAL` não estornado na sessão aberta
      (duplo → 409; venda → 400); ordem de locks sessão → produtos.
- [x] Frontend: `/caixa` (situação, abertura, form entrada/saída e
      movimentações recentes), `/caixa/fechar` (esperado vs. contado com
      diferença), `/caixa/movimentos` (filtros + estorno), `/caixa/sessoes`
      (histórico), `/financeiro` (resumo por período); banner "Caixa
      fechado" com bloqueio de finalização no `/pdv`; home exibe "Caixa e
      financeiro" como módulo disponível; badge "Etapa 4".

## Testes executados

| Verificação | Comando | Resultado |
|---|---|---|
| Schema Prisma válido | `npm run db:validate` | OK |
| Lint | `npm run lint` | OK (0 erros) |
| Typecheck | `npm run typecheck` | OK (4 workspaces) |
| Testes (PostgreSQL real) | `npm test` | 141/141 aprovados (8 arquivos) |
| Build | `npm run build` | OK (shared, api, web, worker) |
| E2E API + web | script `e2e-etapa4.ps1` | 30/30 verificações OK |

Cobertura dos testes novos (37): abertura (duplicidade 409, permissão
403, saldo inicial), movimentações manuais (validações de valor/
justificativa, permissão), integração com vendas (lançamento `SALE` com
`inCash` verdadeiro para dinheiro e falso para Pix, cancelamento com
lançamento único mesmo em recancelamento 409), estorno (403 membro, motivo
curto 400, criação do compensatório + marcação do original, duplo 409,
lançamento de venda 400), resumo financeiro (totais por período,
filtro por sessão, período vazio com zeros, leitura por membro),
fechamento (esperado/diferença server-side, duplo 409, bloqueio de
venda/movimentação/estorno pós-fechamento, 4 aberturas concorrentes →
exatamente 1 sucesso) e isolamento multiempresa (sessão/histórico/
resumo/estorno de outra empresa → 404/zero/vazio).

## Pendências conhecidas

- CI (lint + typecheck + testes) quando solicitado.
- Validação de formato de CPF/CNPJ (hoje apenas texto com limite de
  tamanho) — avaliar na etapa de clientes/fornecedores avançado.
- Estoque negativo nunca é permitido por padrão; se houver necessidade
  futura de venda com saldo insuficiente (backorder), será decisão explícita.
- Formas de pagamento configuráveis além de Dinheiro/Cartão/Pix/Outro
  (hoje "Outro" aceita descrição livre).
- Vendas anteriores à Etapa 4 (sem `cashSessionId`/lançamento) ficam fora
  do financeiro — limitação de dados de desenvolvimento.
- Integração da pasta `automação do whatsapp/` em etapa própria.

## Git

- Branch: `main`; remoto: `origin` → `https://github.com/Tanattos18/PetFlow.git`.
- `3b77828` feat(etapa-1): autenticação, usuários, permissões e multiempresa
- `6a36407` feat(etapa-2): implementa produtos e controle de estoque
- `e305d52` docs: registra hashes dos commits e push da etapa 2
- `912d1c8` feat(etapa-3): implementa vendas e ponto de venda
- `6ae287d` feat(etapa-4): implementa caixa e financeiro
- `bf2d5a9` docs: registra hash do commit da etapa 4
- Push confirmado: `2af5ba7..bf2d5a9 main -> main` (árvore de trabalho
  em sincronia com `origin/main` após a Etapa 4).

## Próxima etapa autorizada

**Etapa 5 — a definir** — a iniciar somente após aprovação explícita do
proprietário.
