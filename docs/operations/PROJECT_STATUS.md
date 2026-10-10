# Status do projeto — PetFlow

## Etapa atual

**Etapa 7 — Dashboard e relatórios** — CONCLUÍDA
(aguardando aprovação do proprietário para avançar).

Data: 2026-10-09.

Etapas anteriores: Etapa 0 (2026-10-09), Etapa 1 (2026-10-09),
Etapa 2 (2026-10-09), Etapa 3 (2026-10-09), Etapa 4 (2026-10-09),
Etapa 5 (2026-10-09), Etapa 6 (2026-10-09).

Escopo: dashboard gerencial e relatórios com agregação server-side
sobre dados reais das Etapas 1–6 (sem dados fictícios); período em
UTC documentado e testado; CSV opcional com proteção contra injeção;
serviços realizados explicitamente indisponíveis até a Etapa 8; sem
nova dependência de biblioteca de gráficos.

## Entregas concluídas (Etapa 7)

- [x] Auditoria inicial: fontes de dados dos 6 módulos existentes,
      padrões de serviço/controller/teste reaproveitados, sem lib de
      gráficos nas dependências (decisão: barras CSS/Tailwind).
- [x] Schemas Zod E7 em `@petflow/shared` (seção "Etapa 7"):
      `reportDateField` valida calendário real (round-trip ISO),
      `checkReportPeriod` (`from ≤ to`, máximo 366 dias), período
      padrão de 30 dias, formatos `json|csv` e schemas dos 6
      relatórios (+ paginação).
- [x] Migration aditiva `20261010002727_etapa7_report_indexes`
      (`Client` e `Pet` com `@@index([companyId, createdAt])`)
      aplicada em `petflow` (dev) e `petflow_test` (testes);
      schema validado; nenhum dado alterado.
- [x] Módulo `apps/api/src/reports` (`ReportsModule`):
      `GET /api/reports/summary` (vendas, por dia/forma de pagamento
      em SQL, caixa, estoque, clientes/pets, WhatsApp,
      `servicesRealized.available=false`), `/sales` (totais
      concluídas × canceladas, filtros, paginação), `/stock/alerts`
      (sem estoque ou no mínimo, sem inativos), `/stock/movements`
      (totais por tipo zero-fill), `/cash` (inCash vs todos,
      estornos, sessões), `/clients` (novos + espécies) e
      `/whatsapp` (status atual + falhas por motivo).
- [x] Período em UTC inclusivo `T00:00:00.000Z`–`T23:59:59.999Z`,
      default 30 dias, máx. 366; ticket médio com `null` sem
      vendas; totais do relatório de vendas sempre separados por
      status (filtro `status` afeta só a lista; `paymentMethod`
      afeta os totais).
- [x] Helper CSV com aspas/CRLF e neutralização de injeção
      (`=`, `+`, `-`, `@` → apóstrofo), teto de 5000 linhas, ignora
      paginação; exportação em vendas, alertas e movimentações
      (`format=csv` + Content-Disposition).
- [x] Frontend: `/dashboard` (período, KPIs, barras CSS de vendas
      por dia e por forma de pagamento, card de serviços
      indisponível), `/relatorios` (5 abas com filtros, paginação e
      CSV), `lib/format.ts`, `downloadCsv()`; home com "Dashboard" e
      "Relatórios"; badge "Etapa 7".
- [x] Leitura de relatórios exige apenas sessão (sem `AdminGuard`);
      `companyId` sempre da sessão — parâmetro de cliente é
      ignorado.

## Testes executados

| Verificação | Comando | Resultado |
|---|---|---|
| Schema Prisma válido | `npm run db:validate` | OK |
| Lint | `npm run lint` | OK (0 erros) |
| Typecheck | `npm run typecheck` | OK (4 workspaces) |
| Testes (PostgreSQL real) | `npm test` | 292/292 aprovados (13 arquivos) |
| Build | `npm run build` | OK (shared, api, web, worker) |

Cobertura dos testes novos (41, `tests/reports.test.ts`): agregações
de vendas (líquido/bruto/descontos/cancelamentos/ticket com
rounding), fronteiras de data UTC (00:00:00.000 inclusivo,
23:59:59.999 do dia vizinho excluído), default de 30 dias, validação
de período (inverso, >366 dias, formato e data de calendário
inválidos → 400), filtros e paginação (status afeta só a lista),
consistência resumo × relatório, alertas de estoque (baixo/zerado,
inativo excluído), movimentos por tipo e período, caixa (`inCash`
vs todos, estorno, sessão fechada com diferença), clientes/pets por
período e espécie, WhatsApp (aceitação ≠ entrega, falhas por
motivo), isolamento multiempresa em todos os relatórios, permissões
(401 sem sessão em todos os endpoints, MEMBER pode ler), CSV
(content-type, filename, anti-injeção, ignora paginação) e estado
vazio (`ticketAverage: null`).

## Pendências conhecidas

- CI (lint + typecheck + testes) quando solicitado.
- Credenciais reais da Meta (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`,
  `WHATSAPP_VERIFY_TOKEN`) só no `.env` local — provisionamento em
  produção é decisão explícita do proprietário.
- Webhook Meta exige URL pública (ngrok/túnel/domínio) — fora do
  ambiente local.
- Botões interativos e mídia (imagem/áudio/documento) — camada de
  provedor suporta payload `components`; UI de mídia fica para etapa
  futura se necessário.
- Entrega de mensagens fora de horário/janela de 24h da Meta (template
  vs. sessão) — validação server-side por `hasPendingSession` está
  registrada; revisar política da Meta na publicação.
- Validação de dígitos verificadores de CPF/CNPJ (hoje CPF valida
  apenas 11 dígitos) — avaliar em etapa avançada.
- Duplicidade de clientes: janela de corrida aceita (sem unique duro de
  `nameKey`).
- Itens de serviço em vendas: fora do escopo (catálogo é preparação
  para agendamentos — agora na Etapa 8); "serviços realizados" no
  dashboard fica indisponível até lá.
- Gráficos avançados (biblioteca, tooltips, zoom): introduzir
  dependência só quando houver necessidade real — hoje barras CSS
  atendem.
- Estoque negativo nunca é permitido por padrão; backorder seria decisão
  explícita.
- Formas de pagamento configuráveis além de Dinheiro/Cartão/Pix/Outro.
- Vendas anteriores à Etapa 4 (sem `cashSessionId`/lançamento) ficam fora
  do financeiro — limitação de dados de desenvolvimento.
- CSV de caixa, clientes e WhatsApp: não implementado (opcional no
  escopo; JSON cobre os casos).
- CI e deploy (contínuos).

## Git

- Branch: `main`; remoto: `origin` → `https://github.com/Tanattos18/PetFlow.git`.
- `3b77828` feat(etapa-1): autenticação, usuários, permissões e multiempresa
- `6a36407` feat(etapa-2): implementa produtos e controle de estoque
- `e305d52` docs: registra hashes dos commits e push da etapa 2
- `912d1c8` feat(etapa-3): implementa vendas e ponto de venda
- `6ae287d` feat(etapa-4): implementa caixa e financeiro
- `bf2d5a9` docs: registra hash do commit da etapa 4
- `398ad85` docs: registra push da etapa 4
- `59ef5a2` docs: reescreve README com roadmap das 9 etapas
- `9d273b9` feat(etapa-5): implementa clientes, pets e serviços
- `e7bfd34` docs: registra hash do commit da etapa 5
- `f81db3c` feat(etapa-6): integra WhatsApp Cloud API com fila, webhook e frontend
- `4e902d0` docs: registra hash do commit da etapa 6
- `2287bec` docs: registra push da etapa 6
- `f81a077` feat(etapa-7): implementa dashboard e relatorios com agregacao server-side
- `016ecaf` docs: registra hash do commit da etapa 7
- Push confirmado: `2287bec..016ecaf main -> main` (inclui a Etapa 7).
- Push anterior: `4e902d0..2287bec main -> main` (inclui a Etapa 6).

## Próxima etapa autorizada

**Etapa 8 — Agendamentos** — a iniciar somente após aprovação
explícita do proprietário (roadmap: 6=WhatsApp ✅, 7=Dashboard ✅,
8=Agendamentos, 9=Assinaturas — conforme prompt oficial da Etapa 7).
