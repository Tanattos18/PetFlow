# Arquitetura — PetFlow

## Formato

Monorepo com npm workspaces, frontend e backend separados, preparado para
crescer módulo a módulo sem infraestrutura desnecessária.

## Tecnologias escolhidas

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend | Next.js 15 + React 19 + TypeScript + Tailwind CSS 4 | Previsto no documento de arquitetura; SSR/estilos consistentes com SaaS web |
| Backend | NestJS 11 + TypeScript | Previsto no documento de arquitetura; estrutura modular (módulos, DI, pipes, filters) |
| Banco | PostgreSQL | Previsto; robustez e suporte a multiempresa |
| ORM | Prisma 5 | Escolha única; consistência com a base existente de automação WhatsApp do ambiente |
| Validação | Zod (`@petflow/shared`) | Uma estratégia de validação compartilhável entre front e back |
| Testes | Vitest + Supertest | Compatível com TypeScript e com o NestJS (HTTP in-memory) |
| Lint | ESLint 9 (flat config) + typescript-eslint | Padrão atual da comunidade |

## Módulo WhatsApp — integração com Cloud API (Etapa 6)

- **Provedor abstraído em `packages/whatsapp`**: a API/worker falam com
  `WhatsAppProvider` (interface); `MetaCloudProvider` chama a
  **WhatsApp Business Cloud API** oficial (HTTPS, `fetch` injetável
  para testes) e `MockWhatsAppProvider` é determinístico em dev/teste.
  Scraping, Selenium e QR code ficaram explicitamente fora de escopo;
  a pasta `automação do whatsapp/` permanece intocada.
- **Configuração multiempresa por banco**: credenciais
  (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`,
  `WHATSAPP_VERIFY_TOKEN`) vêm primeiro de `WhatsAppConfig` (por
  empresa) com fallback em variáveis de ambiente; a API nunca devolve
  token (apenas `hasAccessToken`) e erros passam por scrub antes de
  log/serialização. Em dev/teste o provedor padrão é `mock`
  (`WHATSAPP_PROVIDER`).
- **Enfileirar ≠ entregar** (fila em Postgres, sem Redis/BullMQ):
  `POST /api/whatsapp/messages` só valida e grava `PENDING` +
  `nextAttemptAt`; o `apps/worker` faz claim atômico
  (`updateMany` `PENDING/RETRY → SENDING` — dois workers nunca enviam
  a mesma mensagem), chama o provedor e grava
  `WhatsAppSendAttempt` + transição de status na mesma transação.
  Alternativa descartada (Redis/BullMQ) seria infraestrutura nova sem
  necessidade comprovada (regra de evolução arquitetural nº 4).
- **Backoff e classificação de erro**: 429/408/5xx são TRANSIENT →
  reagenda com `5s · 2^n` (cap 300s) até `maxAttempts` (3) → `FAILED`;
  demais são PERMANENT → falha imediata. Rate limit por ciclo
  (`WHATSAPP_SEND_MAX_PER_CYCLE`/`WHATSAPP_SEND_INTERVAL_MS`).
- **Cancelamentos server-side**: sem consentimento `OPTED_IN`, opt-out
  posterior ou config `DISCONNECTED` → mensagem `CANCELLED` sem
  chamada ao provedor (decisão do servidor, nunca do cliente).
- **Webhook idempotente e verificado**: `GET` responde o challenge da
  Meta em `text/plain`; `POST` valida `x-hub-signature-256`
  (HMAC-SHA256 do corpo bruto com `WHATSAPP_APP_SECRET`, `rawBody`
  habilitado no Nest) → 403 em assinatura inválida; cada
  `(wamid, tipo)` é gravado uma única vez (`WhatsAppWebhookEvent`)
  antes de transicionar status (SENT/DELIVERED/READ/FAILED) —
  reentregas da Meta nunca duplicam efeito. Resposta `"SAIR"` grava
  opt-out (`source = REPLY`).
- **Permissões**: leitura autenticada; escrita de config/templates e
  opt-in restritas a `ADMIN`; opt-out e cancelamento liberados a
  qualquer sessão (proteção do cliente); webhook público com
  verificação criptográfica.
- **Frontend**: `/whatsapp` (status/credenciais/teste de conexão),
  `/whatsapp/templates`, `/whatsapp/mensagens` (+ detalhe com
  tentativas), seção de consentimento em `/clientes/[id]`.

## Estrutura de aplicações

```
apps/web      → interface Next.js (porta 3000 por padrão)
apps/api      → NestJS (porta 3001 por padrão, variável API_PORT)
apps/worker   → processo único para tarefas em segundo plano (stub na Etapa 0)
packages/shared → tipos e schemas Zod compartilhados
packages/config → tsconfig base comum
database/     → schema Prisma, migrations e seeds
docs/         → documentação funcional, técnica e operacional
tests/        → testes compartilhados/integração
```

## Regras de comunicação

- `web` consome `api` exclusivamente via HTTP (endpoints REST).
- `worker` será acionado nas etapas futuras (fila ou agendamento); na Etapa 0 é
  apenas estrutura.
- Nenhuma regra de negócio vive no frontend.

## Regras de evolução arquitetural

1. Novas funcionalidades entram como módulo no `apps/api` (ex.:
   `src/modules/products`), sem poluir o AppModule com lógica.
2. Tabelas novas só são criadas com migration versionada no `database/`.
3. Tipos/schemas usados por mais de um app vão para `@petflow/shared`.
4. Infraestrutura adicional (Redis, filas, microsserviços) só é introduzida
   com necessidade comprovada e registro em CHANGELOG.
5. Segredos somente por variáveis de ambiente (`.env` local, nunca versionado).

## Decisões registradas (Etapa 0)

- Backend NestJS conforme previsto no documento de arquitetura (aprovado pelo
  proprietário do produto).
- Prisma com schema em `database/prisma/` (adaptação de layout para monorepo;
  comandos usam `--schema`).
- Sem verificação de banco no health check nesta etapa (nenhuma tabela/modelo
  de negócio existe ainda); o health reflete status técnico da API.
- Pasta `automação do whatsapp/` mantida intacta na raiz como base existente de
  automação; será avaliada/integrada em etapa própria (não faz parte da Etapa 0).

## Autenticação, autorização e multiempresa (Etapa 1)

### Estratégia de autenticação (uma única)

- **Sessão server-side com cookie `HttpOnly`**: no login, a API gera um token
  aleatório (32 bytes), devolve no cookie `petflow_session` (`HttpOnly`,
  `SameSite=Lax`, `Secure` quando `AUTH_COOKIE_SECURE=true`, `Path=/`) e grava
  na tabela `Session` apenas o **hash SHA-256** do token, com `expiresAt`.
- `GET /api/auth/me` e demais rotas privadas resolvem o cookie → hash →
  sessão ativa → usuário `ACTIVE` → `request.user`/`request.company`.
- Logout apaga a sessão (revogação efetiva); inativar usuário revoga todas as
  sessões dele. Nada de JWT, nada de `localStorage`.
- Senhas: `bcryptjs` com 12 rounds. Nunca em respostas, logs ou seeds.
- Proteções auxiliares: rate limit de login (5/15min por IP+email, memória),
  checagem de `Origin` em requisições mutantes, CORS por allowlist
  (`APP_ORIGINS`), validação Zod na entrada.

### Autorização

- `APP_GUARD` global `AuthGuard` protege tudo; rotas públicas usam o
  decorador `@Public()` (ex.: `/health`, `POST /auth/login`).
- `AdminGuard` (em `@Auth()` + `@UseGuards`) exige `role: ADMIN` — verificado
  no servidor para gestão de usuários.

### Isolamento multiempresa (tenant)

- `companyId` vem **sempre** do contexto autenticado (`request.user.companyId`);
  nunca é aceito do cliente.
- Todas as consultas/escritas de usuários filtram por `companyId`; recursos de
  outra empresa respondem 404 (sem vazar existência).
- Padrão para módulos futuros: escopo de empresa obrigatório no guard/helper
  de contexto — novo recurso sem `companyId` não deve ser aceito.
- Um usuário pertence a exatamente uma empresa nesta etapa.

### Decisões de execução relevantes

- Runtime de dev `tsx` (esbuild) **não** emite `emitDecoratorMetadata`;
  providers com injeção de construtor usam `@Inject()` explícito (mesmo
  redundante no build `tsc`) — padrão adotado nos módulos da API.
- Frontend consome a API via rewrites do Next (`/api/:path*` →
  `http://localhost:3001/api/...`), mantendo mesmos domínios/cookies.

## Acesso pós-Etapa 9 — redefinição de senha e cadastro (2026-10-10)

- **Flags de ambiente** regem os fluxos públicos de acesso; padrão no
  código é **desabilitado** (`false`), `true` apenas em `.env`
  local, `.env.example` e `tests/setup-env.ts`:
  - `PASSWORD_RESET_ENABLED` → `POST /api/auth/reset-password` +
    página `/redefinir-senha` (fluxo local, **sem token de e-mail**;
    rate limit `reset|ip|email`; troca de hash + revogação de todas
    as sessões na mesma transação).
  - `REGISTRATION_ENABLED` → `POST /api/auth/register` + página
    `/cadastro` (cria **empresa nova** com o usuário como ADMIN e
    loga automaticamente; rate limit por IP `register|ip`; e-mail
    global único → 409; slug único gerado do nome da empresa).
- Sessão compartilhada em `AuthService.createSession()`: login e
  registro usam o mesmo caminho (token 32 bytes, hash SHA-256 em
  `Session`, cookie `HttpOnly`).
- Rotas públicas novas sempre via `@Public()` + flag + rate limit
  próprio (o rate limit de login continua exclusivo de login).
- Em produção: manter as flags desligadas até existir token por
  e-mail na redefinição e verificação de e-mail/anti-abuso no
  cadastro (pendências registradas em PROJECT_STATUS).
- Seed de demonstração (`db:seed:demo`) roda em transação única, só
  em empresa vazia, e nunca em produção.

## Módulo produtos/estoque (Etapa 2)

- **Saldo materializado** em `Product.stockQuantity` (Decimal 12,3), com
  atualização e criação de movimento na **mesma transação** e lock
  pessimista por produto (`SELECT ... FOR UPDATE`) — escolhido por
  consistência sob concorrência e consultas de saldo/barcode rápidas.
  Alternativa descartada (saldo sempre agregado de movimentos) exigiria
  índices/GROUP BY por leitura e não simplificava o bloqueio.
- **Histórico imutável**: `StockMovement` não tem update/delete por
  operação comum; correções são movimentos compensatórios (ajuste ±).
- **Permissões**: leitura de catálogo/estoque para qualquer usuário
  autenticado; escrita de categorias/fornecedores/produtos e ajustes de
  inventário restrita a `ADMIN` (ver `API.md`).
- **Alerta de estoque baixo**: `ACTIVE` + `minimumStock > 0` +
  `stockQuantity <= minimumStock` (produtos sem mínimo definido não geram
  alerta).

## Módulo vendas e PDV (Etapa 3)

- **Fonte de verdade dos preços é o banco**: na criação da venda o
  backend bloqueia os produtos (`FOR UPDATE` em ordem de `id`), recalcula
  subtotal/total com `Product.salePrice` e grava venda + itens + baixa de
  estoque + movimentos `OUT` em uma única transação. Frontend envia
  apenas `productId`, `quantity`, `discount` e `paymentMethod`.
- **Idempotência contra duplo clique**: `clientRequestId` (UUID gerado no
  cliente) com unique por empresa → reenvio responde 409 e nada muda.
  Alternativa descartada: desabilitar o botão apenas (não protege contra
  reenvio por rede/retentativa).
- **Código de comprovante** `PF-XXXXXXXX` único por empresa (letras sem
  ambiguidade), gerado no servidor — não há numeração sequencial por
  empresa (evitaria lock global no `Company`).
- **Snapshots em `SaleItem`** (nome, SKU, unidade, preço, quantidade):
  renomeações/inativações futuras do produto não alteram vendas antigas.
- **Cancelamento lógico com auditoria**: status `CANCELLED` + motivo +
  autor + data; venda nunca é apagada. Devolução de estoque em transação
  com `updateMany({ status: COMPLETED })` → apenas o primeiro cancelamento
  devolve (corrida → 409, estoque nunca devolvido duas vezes).
- **Permissões**: criar/consultar vendas para qualquer usuário
  autenticado (frente de caixa); cancelamento restrito a `ADMIN`.
- **Comprovante imprimível**: HTML mínimo gerado em nova janela
  (`window.open` + `window.print`), independente de CSS da aplicação;
  pop-up bloqueado → aviso ao usuário.

## Módulo caixa e financeiro (Etapa 4)

- **Uma sessão de caixa aberta por empresa**: abertura serializada com
  `SELECT ... FOR UPDATE` na linha da `Company` (409 se já houver
  `OPEN`); fechamento e estorno lockam a própria sessão. Alternativa
  descartada (várias sessões simultâneas) complicaria a conciliação de
  turno sem benefício operacional.
- **Venda/cancelamento exigem caixa aberto** (`409`): mantém o ledger
  financeiro completo e consistente com o estoque — toda venda pertence a
  uma sessão (`Sale.cashSessionId`) e gera exatamente um lançamento
  (`@@unique([origin, saleId])` como defesa extra além da transação).
- **Saldo do caixa = dinheiro físico**: `inCash` marca o que compõe o
  saldo esperado (vendas `CASH` + manuais); CARD/PIX/OTHER geram
  lançamento com `inCash = false` e entram apenas no resumo financeiro
  (que agrega por origem/tipo). Assim "saldo esperado" bate com a
  contagem de cédulas sem misturar recebimentos eletrônicos.
- **Saldo/diferença sempre no servidor**: `expected` e `difference` são
  calculados no fechamento (agregações `inCash` na sessão) e nunca
  aceitos do cliente; data/hora sempre do servidor (sem backdating).
- **Estorno auditável, nunca edição**: apenas lançamentos `MANUAL` na
  sessão aberta; cria `REVERSAL` do tipo oposto e marca o original com
  `reversedAt`/autor/motivo via `updateMany` condicional (corrida → 409).
  Vendas são revertidas pelo cancelamento (fluxo próprio com devolução de
  estoque), não por estorno.
- **Ordem de locks fixa**: sessão de caixa → produtos ordenados por `id`
  (mesma ordem no cancelamento) — evita deadlock entre venda e
  movimentações.
- **Permissões**: leitura (situação, movimentos, resumo, sessões) para
  qualquer usuário autenticado; escrita (abrir/fechar/movimentar/
  estornar) restrita a `ADMIN`.
- **Frontend**: `/caixa` (situação, abertura e movimentações recentes),
  `/caixa/fechar`, `/caixa/movimentos` (filtros + estorno),
  `/caixa/sessoes` (histórico) e `/financeiro` (resumo por período);
  `/pdv` exibe banner "Caixa fechado" e bloqueia a finalização enquanto
  `GET /cash/sessions/current` retornar 404.

## Módulo clientes, pets e serviços (Etapa 5)

- **Duplicidade de cliente por aplicação, não por unique**: `nameKey`
  (nome colapsado/minúsculo) tem apenas índice comum; o 409
  ("possivelmente duplicado") só dispara quando `nameKey` **e** algum
  contato coincidem com um cliente `ACTIVE`. Unique duro foi descartado
  (bloqueia homônimos e famílias com mesmo telefone); a janela de
  corrida aceita — documentada em `DATABASE.md` e no serviço.
- **Normalização na borda do domínio** (Zod compartilhado): telefone/CPF
  só dígitos, email minúsculo — evita duplicidade por formatação.
- **Serviço único por empresa** via `@@unique([companyId, nameKey])`
  (mesmo padrão das categorias): catálogo/preços são dados mestres.
- **Permissões assimétricas por natureza do dado**: clientes/pets são
  operação diária (leitura e escrita autenticada — MEMBER pode);
  serviços definem preço/catálogo (escrita restrita a `ADMIN`).
- **Venda com cliente opcional**: `Sale.clientId` (`SetNull`) validado
  antes dos locks (400 se inativo/estrangeiro); listagem/detalhe
  retornam `client`; snapshots dos itens permanecem — inativar cliente
  nunca quebra histórico. Venda rápida sem cliente é o default do PDV.
- **Pet sempre com responsável da mesma empresa** (`Restrict` + checagem
  no servidor): recusa responsável inativo/estrangeiro; nascimento futuro
  e peso fora de faixa rejeitados (400) antes de tocar o banco.
- **Frontend**: `/clientes` + `/clientes/[id]` (ficha + pets), `/pets`
  (listagem global com filtros), `/servicos` (escrita ADMIN), seletor
  opcional de cliente no `/pdv`, coluna "Cliente" em `/vendas`;
  home lista "Clientes e animais" e "Serviços" como módulos disponíveis.

## Módulo dashboard e relatórios (Etapa 7)

- **Agregação sempre no servidor**: nenhuma soma/contagem/média roda
  no navegador; o frontend só formata e desenha o que a API já
  calculou (`ReportsService`). Consultas de maior custo (vendas por
  dia, contagens por tipo/status) usam SQL puro com `companyId` no
  `WHERE` — `COUNT` convertido de `BigInt`, `SUM` de decimal para
  string com 2 casas (nunca `number` binário para dinheiro).
- **Nenhum dado fictício**: tudo vem dos módulos 1–6; quando um
  indicador ainda não existe no produto (serviços realizados, pré-Etapa
  8), a resposta traz `available: false` + motivo em vez de zero
  enganoso. Ticket médio sem vendas é `null`, não `0`.
- **Período em UTC documentado e testado**: janela inclusiva
  `T00:00:00.000Z`–`T23:59:59.999Z`, default 30 dias ancorado no `to`,
  máximo 366 dias (validação Zod compartilhada, 400 com `issues`);
  datas de calendário impossíveis (ex.: `2026-02-30`) são rejeitadas
  por round-trip ISO — `Date.parse` do JavaScript sozinho aceitaria e
  rolaria para o mês seguinte.
- **Sem nova dependência de biblioteca de gráficos**: as dependências
  de `apps/web` continuam apenas `next`, `react` e `tailwindcss`;
  barras do dashboard/relatórios são divs CSS. Reavaliar apenas se a
  UX exigir interação avançada.
- **Segurança igual ao resto da API**: módulo sob `AuthGuard` global
  (nenhum endpoint público), leitura sem `AdminGuard` (relatório é
  dado operacional, MEMBER pode), `companyId` sempre do contexto
  autenticado — `companyId` query-string é ignorado; recorte por
  empresa aplicado em cada `groupBy`/`$queryRaw`.
- **Semântica documentada dos totais de vendas**: totais separados
  concluídas × canceladas usam período + `paymentMethod`; o filtro
  `status` restringe só a lista. Mantém o dashboard e o relatório
  consistentes entre si (testado).
- **CSV com segurança**: helper próprio (`common/utils/csv.ts`) —
  aspas, CRLF, prefixo `'` em célula iniciada por `=`, `+`, `-` ou
  `@` (injeção de fórmula), teto `REPORT_CSV_MAX_ROWS=5000`, CSV
  ignorando paginação e sempre com `Content-Disposition` de
  download; streaming via `StreamableFile`.
- **Índices justificados**: apenas `(companyId, createdAt)` em
  `Client` e `Pet` (agregações por período); demais colunas já
  tinham índices das etapas anteriores — ver `DATABASE.md`.
- **Disponibilidade do módulo (pós-Etapa 8)**: `servicesRealized`
  passou a `available: true` e `summary.services`/`clients.services`
  expõem contagens por status; a checagem de `available` permanece no
  frontend para tolerar resposta de API antiga.

## Módulo agendamentos (Etapa 8)

- **Escopo aprovado na conversa** (sem prompt oficial): CRUD +
  conflito de horário da empresa inteira + lembretes pela fila
  WhatsApp existente + `/agenda`; serviços em vendas/PDV ficaram de
  fora e `durationMinutes` é obrigatório (1..1440).
- **Sem `AdminGuard`**: agenda é operação diária — MEMBER cria,
  edita, confirma, conclui, marca `NO_SHOW` e cancela; a única
  escrita "sensível" que exige ADMIN no módulo é a configuração do
  WhatsApp (template/antecedência de lembrete).
- **Horário é autoridade do servidor**: o cliente envia apenas
  `startLocal` (`YYYY-MM-DDTHH:mm`) e `utcOffsetMinutes`
  (`-getTimezoneOffset()`, leste-positivo ±840); `startAt`/`endAt`
  são recalculados sempre (inclusive no `PATCH`), `endAt` nunca vem
  do cliente; passado é recusado com tolerância de 60 s (relógio do
  cliente × servidor).
- **Conflito por transação, não por unique**: lock
  `SELECT ... FOR UPDATE` na `Company` (mesmo padrão da sessão de
  caixa da Etapa 4) + sobreposição `startAt < endAt AND endAt >
  startAt` sobre `SCHEDULED`/`CONFIRMED`; fim-início exato é livre;
  terminal/cancelado não bloqueia; a edição exclui o próprio
  registro. Unique duro foi descartado (fuso/estilo de gravação
  mudaria o contrato — a coluna `startLocal` é string de parede).
- **Guardas de transição no servidor**: `PATCH /:id/status` aceita
  só `CONFIRMED`/`COMPLETED`/`NO_SHOW` (qualquer status → 400,
  terminal → 409); cancelamento é endpoint próprio (`reason`
  obrigatório) via `updateMany` condicional — dupla corrida vira 409
  e o motivo/autor ficam auditados; edição só em status
  não-terminal.
- **Lembretes sem tocar no worker**: `syncReminder` roda na mesma
  transação de cada mutação (criar/editar/status/cancelar) e usa a
  fila já existente (`WhatsAppMessage` + claim/backoff do `apps/worker`
  da Etapa 6 — nenhum código de worker foi alterado). Chave
  `appointment-reminder:<id>` única por empresa dá idempotência;
  elegibilidade (config, template `APPROVED` com 3 variáveis,
  consentimento `OPTED_IN`, telefone E.164, horário futuro) é
  **revalidada a cada mutação** — não é assumir estado do passado.
  Reagendar atualiza a pendente; cancelar/concluir/inelegível
  cancela com motivo registrado; **falha de lembrete só gera
  `Logger.warn`** (o CRUD nunca falha por causa do WhatsApp).
- **Integração com relatórios**: agregação de contagens por status
  (`appointmentStatusCounts`) reutiliza o mesmo recorte de período
  dos demais relatórios; frontend de dashboard/relatórios consome
  `services` sem lógica de fallback de negócio.
- **Frontend sem lib de calendário**: `/agenda` é visão por dia com
  navegação ←/Hoje/→ + `input[type=date]`, filtros e paginação;
  form único (`AppointmentForm`) cobre novo/edição, pré-preenche a
  partir do registro e recarrega os pets quando o cliente muda
  (cliente/pet/serviço editáveis em qualquer status não-terminal).

## Módulo assinaturas e billing (Etapa 9)

- **Escopo aprovado na conversa** (sem prompt oficial; opções "Ambos"
  e "pagamento via caixa/venda existente"): assinaturas recorrentes
  dos **clientes** + billing da **empresa no SaaS**, sempre pelo caixa
  existente — sem gateway, sem cartão, sem recorrência automática.
- **Duas famílias com regras diferentes**:
  - `SubscriptionPlan`/`Subscription` são tenant-scoped (padrão da
    casa: `companyId` + FK `Restrict` + índices por empresa), escrita
    com `AdminGuard`, leitura com sessão — espelho dos serviços da
    Etapa 5 (`nameKey` único por empresa).
  - `TenantPlan`/`TenantSubscription` são **globais por decisão
    documentável** (exceção à regra "todo modelo tem companyId"): o
    catálogo é da plataforma (seed na migration, escrita não exposta
    via API nesta etapa) e a assinatura é única por empresa
    (`companyId @unique`).
- **Pagamento é caixa, sempre**: `registerPayment` na criação,
  renovação e cobranças geram `CashMovement` `IN`/`MANUAL` com
  `inCash: true` e `subscriptionId` vinculado (FK `SetNull`), sempre
  dentro da transação e **após** `lockOpenCashSession` — a mesma
  trava da Etapa 4; caixa fechado → 409, e nada de valor aceito do
  cliente (preço vem do plano).
- **Renovação empilha período**: novo início é `max(now, endAt)`
  (renovar antes do fim não perde dias), `renewalCount + 1`,
  `lastPaymentAt` e status volta a `ACTIVE`; assinatura cancelada é
  definitiva (409) — reativação seria nova assinatura.
- **Cancelamento auditado**: motivo 3..500 obrigatório (cliente) e
  opcional (billing), gravado com `updateMany` condicional — dupla
  corrida vira 409; autor e data persistidos.
- **Expiração lazy, sem job**: leituras marcam `EXPIRED` quando o
  período venceu; nenhum worker/cron foi adicionado (mesma filosofia
  dos lembretes: só o que é necessário agora).
- **Billing sem enforcement (pendência registrada)**: a assinatura do
  tenant hoje é registro comercial — limites por plano (clientes,
  usuários, módulos) não são cobrados no runtime ainda; o gating é a
  próxima evolução natural quando o proprietário definir políticas.
- **Frontend**: `/planos` (catálogo do cliente, CRUD ADMIN),
  `/assinaturas` (+ `nova`, `[id]`) e `/faturamento` (catálogo global
  + estado da assinatura da empresa); cards na home e badge da etapa.
