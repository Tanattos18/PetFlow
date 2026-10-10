# Status do projeto — PetFlow

## Etapa atual

**Etapa 8 — Agendamentos** — CONCLUÍDA
(aguardando aprovação do proprietário para avançar).

Data: 2026-10-10.

Etapas anteriores: Etapa 0 (2026-10-09), Etapa 1 (2026-10-09),
Etapa 2 (2026-10-09), Etapa 3 (2026-10-09), Etapa 4 (2026-10-09),
Etapa 5 (2026-10-09), Etapa 6 (2026-10-09), Etapa 7 (2026-10-09).

Escopo (aprovado na conversa — sem prompt oficial em
`Etapas_projeto/`): módulo de agendamentos com agenda diária,
conflito de horário da empresa inteira em transação com lock,
transições de status/cancelamento com motivo, lembretes automáticos
pela fila WhatsApp existente (worker intacto), integração com
dashboard/relatórios e frontend `/agenda`; decisões registradas —
conflito empresa-inteira, serviços em vendas/PDV fora da etapa,
`durationMinutes` obrigatório.

## Entregas concluídas (Etapa 8)

- [x] Schemas Zod E8 em `@petflow/shared` (seção "Etapa 8"):
      `localDateTimeField` (calendário real), `create/update/cancel/
      update-status/listAppointments`, `appointmentStatusSchema`,
      constantes de status bloqueante/terminal, constantes de
      lembrete (3 variáveis, lead 5..40320 default 1440) e
      `updateWhatsAppConfigSchema` com `reminderTemplateId`/
      `reminderLeadMinutes`.
- [x] Migration `20261010115308_etapa8_appointments`: enum
      `AppointmentStatus`, modelo `Appointment` (FK `Restrict`,
      índices por empresa/status/cliente/pet) e campos de lembrete em
      `WhatsAppConfig`; aplicada em `petflow` (dev); `db:validate` OK.
- [x] Módulo `apps/api/src/appointments` (somente sessão, sem
      `AdminGuard`): `POST` (201, `startAt`/`endAt` calculados no
      servidor, passado recusado), `GET` (filtros `from/to`, status,
      cliente/pet/serviço, busca, paginação), `GET :id`, `PATCH :id`
      (parcial + reagendamento), `PATCH :id/status`
      (CONFIRMED/COMPLETED/NO_SHOW), `POST :id/cancel` (201, motivo
      3..500); conflito da empresa inteira com `FOR UPDATE` na
      `Company` → 409 (fim-início exato permitido; terminal/cancelado
      não bloqueia).
- [x] Lembretes: `syncReminder` na mesma transação de cada mutação,
      chave `appointment-reminder:<id>` por empresa,
      `origin=SERVICE_REMINDER`, `nextAttemptAt = max(now, startAt −
      lead)`, variáveis pet/serviço/data-hora local, revalidação de
      config/template/consentimento/telefone a cada mutação, atualiza
      pendente ao reagendar, cancela ao cancelar/concluir ou tornar
      inelegível; falha só loga (CRUD nunca falha); worker não
      alterado.
- [x] `GET/PUT /api/whatsapp/config` com campos de lembrete; PUT
      valida template da empresa com exatamente 3 variáveis (400).
- [x] Relatórios: `summary.services` (contagens por status,
      zero-fill), `modules.servicesRealized = {available: true,
      reason: null}`; `clients.services` substitui
      `servicesRealized`.
- [x] Frontend: `/agenda`, `/agenda/novo`, `/agenda/[id]`,
      `/agenda/[id]/editar` + `components/AppointmentForm.tsx`,
      `lib/format.ts` (helpers de dia local), `lib/types.ts` (bloco
      E8); home card "Agendamentos", badge "Etapa 8 — Agendamentos",
      `/whatsapp` com template de lembrete e antecedência,
      `/dashboard` e `/relatorios` com contagens reais.
- [x] `resetDatabase` cobre `Appointment` e o novo FK de template de
      lembrete.

## Testes executados

| Verificação | Comando | Resultado |
|---|---|---|
| Schema Prisma válido | `npm run db:validate` | OK |
| Lint | `npm run lint` | OK (0 erros) |
| Typecheck | `npm run typecheck` | OK (4 workspaces) |
| Testes (PostgreSQL real) | `npm test` | 337/337 aprovados (14 arquivos) |
| Build | `npm run build` | OK (shared, api, web, worker) |
| Varredura de segredos | grep de credenciais | sem achados reais |

Cobertura dos testes novos (45, `tests/appointments.test.ts`):
criação e validações (passado, cliente/pet/serviço inválidos ou
inativos, cross-tenant 404), conflito de empresa inteira (sobreposição
409, fim-início exato 201, terminal/cancelado não bloqueia,
isolamento entre empresas), lista com filtros/busca/paginação,
edição e reagendamento (revalida conflito; terminal 409), transições
de status (invalidos 400, terminal 409), cancelamento (motivo
obrigatório, duplo 409) e lembretes (PENDING única por idempotência,
sem config/template aprovado/consentimento → sem fila, reagendar
atualiza, confirmar mantém, cancelar/concluir cancela a pendente,
opt-out e lead inválidos 400). Asserts de `servicesRealized`
atualizados em `tests/reports.test.ts`.

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
- Itens de serviço em vendas/PDV: fora do escopo da Etapa 8 (decisão
  registrada); venda de serviço continua pelo catálogo de produtos.
- Agenda: visão por dia apenas (semana/mês, recorrência, profissionais
  e horário de funcionamento ficam para etapa futura).
- Lembretes: antecipação fixa por empresa (sem janela de silêncio
  por cliente nem lembrete de confirmação pós-atendimento).
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
- `a186e52` docs: registra push da etapa 7
- `cb018e5` feat(etapa-8): implementa agendamentos com conflito, lembretes e agenda
- Push confirmado: `016ecaf..a186e52 main -> main` (inclui a Etapa 7).
- Push anterior: `2287bec..016ecaf main -> main` (inclui a Etapa 7).

## Próxima etapa autorizada

**Etapa 9 — Assinaturas** — a iniciar somente após aprovação
explícita do proprietário (roadmap: 6=WhatsApp ✅, 7=Dashboard ✅,
8=Agendamentos ✅, 9=Assinaturas — conforme roadmap do README;
prompt oficial da Etapa 9 ainda não localizado em `Etapas_projeto/`).
