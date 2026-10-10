# PetFlow

**SaaS de gestão para pet shops de pequeno porte.**
Cadastros de clientes e animais, catálogo de serviços, produtos e estoque,
vendas e ponto de venda, caixa e financeiro, agendamentos e assinaturas
recorrentes — com permissões por perfil, isolamento total entre empresas e
trilha de auditoria em cada operação.

> **Status:** 9 de 9 etapas concluídas (mais a fundação técnica do projeto).
> Etapas 1–9 entregues e verificadas em 10/10/2026 (aguardando aprovação).
> Roadmap do produto completo; próximos passos em
> [`docs/operations/PROJECT_STATUS.md`](docs/operations/PROJECT_STATUS.md)
> (pendências: CI/deploy, enforcement de billing, gateway etc.).

---

## Sumário

1. [O que já está disponível](#o-que-já-está-disponível)
2. [Roadmap — as 9 etapas](#roadmap--as-9-etapas)
3. [Qualidade, segurança e auditoria](#qualidade-segurança-e-auditoria)
4. [Passo a passo — como executar o projeto](#passo-a-passo--como-executar-o-projeto)
5. [Como usar o sistema](#como-usar-o-sistema)
6. [Estrutura do repositório](#estrutura-do-repositório)
7. [Tecnologias](#tecnologias)
8. [Documentação](#documentação)

---

## O que já está disponível

### Etapa 1 — Autenticação, usuários e multiempresa

- **Login seguro** por sessão com cookie `HttpOnly` — nada de token armazenado
  no navegador; senha com hash `bcrypt` e sessão revogável a qualquer momento.
- **Perfis de acesso:** administrador gerencia a operação e os usuários;
  membro opera o dia a dia — a permissão é sempre verificada no servidor.
- **Isolamento multiempresa:** cada pet shop enxerga apenas os próprios dados;
  nenhum acesso cruzado é possível, mesmo com identificadores conhecidos.
- **Proteção de acesso:** limite de tentativas de login, verificação de
  origem e allowlist de CORS.
- **Primeiro administrador** criado de forma segura e idempotente via
  variáveis de ambiente (sem senha padrão no código).

### Etapa 2 — Produtos e estoque

- **Catálogo completo:** categorias, fornecedores e produtos com SKU e
  código de barras únicos por empresa, preços de custo e venda, unidade e
  estoque mínimo.
- **Estoque confiável:** entradas, saídas e ajustes com saldo conferido em
  tempo real; concorrência tratada com trava pessimista — saldo nunca fica
  negativo ou divergente.
- **Alertas de estoque baixo** automáticos para reposição.
- **Histórico imutável de movimentações:** quem, quando, quanto e por quê —
  correções viram movimentos compensatórios, nunca edição de registro.

### Etapa 3 — Vendas e PDV

- **Frente de caixa (PDV):** busca por nome, SKU ou código de barras,
  carrinho, desconto e formas de pagamento (dinheiro, cartão, pix, outro).
- **Comprovante impresso** direto do navegador, com código único por venda.
- **Preços e totais sempre recalculados pelo servidor** — valores enviados
  pelo navegador são descartados.
- **Venda duplicada bloqueada:** duplo clique ou reenvio de rede responde
  com conflito e não gera segunda venda nem dupla baixa de estoque.
- **Cancelamento com devolução automática de estoque**, motivo obrigatório
  e registro de quem cancelou; a venda nunca é apagada.
- **Histórico de vendas** com filtros por status, código e período.

### Etapa 4 — Caixa e financeiro

- **Abertura e fechamento de caixa** por turno, com valor inicial de troco e
  registro de quem abriu/fechou.
- **Uma única sessão de caixa aberta por empresa** — aberturas simultâneas
  concorrentes resultam em exatamente uma sessão.
- **Entradas e saídas manuais** com justificativa obrigatória para saídas.
- **Saldo esperado e diferença calculados pelo sistema** no fechamento;
  o operador informa apenas o valor contado fisicamente.
- **Vendas em dinheiro entram no caixa automaticamente**; cartão e pix
  compõem o resumo financeiro sem misturar o saldo de cédulas.
- **Estorno auditável:** cria lançamento compensatório e marca o original
  com autor, data e motivo — nenhum registro é editado ou apagado.
- **Resumo financeiro por período:** vendas, entradas, saídas, cancelamentos,
  estornos e valor líquido.
- **PDV bloqueia vendas com o caixa fechado**, com aviso e atalho para abrir.

### Etapa 5 — Clientes, pets e serviços

- **Cadastro de clientes** com busca, endereço completo e contatos
  normalizados (telefone só dígitos, e-mail em minúsculas) — a criação
  avisa sobre possível duplicidade sem impedir homônimos ou famílias com
  o mesmo telefone.
- **Ficha do cliente com os animais**: responsável, espécie, raça, sexo,
  nascimento e peso; listagem global de pets com filtros.
- **Catálogo de serviços** com preço e duração — nome único por empresa
  e edição restrita ao administrador.
- **Venda vinculada ao cliente (opcional):** o PDV permite identificar o
  comprador; sem seleção, a venda rápida continua funcionando e o
  histórico antigo permanece intacto.
- **Permissões por natureza do dado:** operação diária (clientes/pets)
  liberada a qualquer usuário autenticado; preço e catálogo (serviços)
  restritos ao administrador — sempre verificado no servidor.

### Etapa 6 — Integração com WhatsApp

- **WhatsApp Business Cloud API (Meta)** oficial — nada de scraping,
  QR code ou automação não suportada; provedor abstraído (mock em
  desenvolvimento, Meta em produção).
- **Configuração por empresa** com teste de conexão e
  desconectar/reconectar; credenciais somente no servidor, nunca em
  resposta ou log.
- **Templates de mensagem** com variáveis `{{n}}`, aprovação interna e
  ativação — envio valida template aprovado no servidor.
- **Consentimento auditável** por cliente (opt-in registrado pelo
  administrador, opt-out por qualquer usuário ou pela resposta "SAIR");
  sem consentimento ativo, nenhum envio acontece.
- **Fila de envio com retentativas:** mensagens são enfileiradas
  (`PENDING`) e entregues por um worker próprio com backoff exponencial
  (até 3 tentativas), taxa limitada por ciclo e histórico completo de
  tentativas — falha transitória nunca perde a mensagem.
- **Webhook oficial da Meta** com verificação de assinatura
  (`x-hub-signature-256`), idempotência por evento e atualização de
  status (enviado/entregue/lido/falhou).
- **Gestão em `/whatsapp`:** status da conexão, templates, fila de
  mensagens com filtros e detalhe de cada envio.

### Etapa 7 — Dashboard e relatórios

- **Dashboard em tempo real** (`/dashboard`) com os indicadores
  calculados no servidor a partir dos dados reais das etapas
  anteriores: vendas (concluídas, canceladas, líquido, ticket
  médio), caixa, estoque, clientes, pets e mensagens WhatsApp.
- **Período editável** com padrão de 30 dias, fuso **UTC** e limites
  de data documentados e testados (janela inclusiva dia a dia;
  intervalo máximo de 366 dias).
- **Gráfico de vendas por dia** e por forma de pagamento em barras
  CSS — sem dependência nova de biblioteca de gráficos.
- **Relatórios em `/relatorios`**: vendas (totais separados
  concluídas × canceladas, filtros e paginação), estoque (alertas de
  reposição e movimentações por tipo), caixa (dinheiro físico vs
  todos os lançamentos, estornos e sessões), clientes/pets novos e
  WhatsApp (status de entrega e falhas por motivo).
- **Exportação CSV** com aspas padrão, limite de 5000 linhas e
  proteção contra injeção de fórmulas (células iniciadas por
  `=`, `+`, `-`, `@`).
- **Serviços realizados** com contagem real de agendamentos por
  status desde a Etapa 8 (`summary.services`) — o dashboard nunca
  inventa dado que o sistema ainda não registra.
- **Mesmas regras de segurança do restante:** leitura exige sessão,
  cada empresa enxerga apenas os próprios números e o `companyId`
  vem sempre da sessão.

### Etapa 8 — Agendamentos

- **Agenda diária em `/agenda`**: visão por dia com navegação
  (←/Hoje/→ e seletor de data), filtros de status e busca,
  paginação, cadastro (`/agenda/novo`), detalhe com transições
  (`/agenda/[id]`) e edição/reagendamento.
- **Conflito de horário da empresa inteira**: qualquer janela
  `SCHEDULED`/`CONFIRMED` sobreposta retorna 409 (fim-início exato
  permitido; cancelados/concluídos não bloqueiam) — checagem em
  transação com trava na empresa.
- **Transições de status** com regras no servidor: confirmar,
  concluir, marcar `NO_SHOW` ou cancelar com motivo obrigatório;
  status terminal não é editável.
- **Lembrete automático de WhatsApp** pela fila já existente
  (sem alteração do worker): antecedência configurada em
  `/whatsapp` (template aprovado com exatamente 3 variáveis +
  consentimento `OPTED_IN`), idempotente por agendamento e
  revalidado a cada mudança.
- **Integração com relatórios**: contagem de agendamentos por
  status no dashboard e em clientes; "serviços realizados" agora
  disponível.

### Etapa 9 — Assinaturas e gestão comercial

- **Planos de assinatura em `/planos`**: nome único por empresa,
  preço, duração em dias e ativação/inativação — escrita restrita ao
  administrador.
- **Assinaturas de clientes em `/assinaturas`**: criação
  (`/assinaturas/nova`) com cliente e plano validados no servidor,
  listagem com filtros de status/busca, detalhe com histórico de
  pagamentos (`/assinaturas/[id]`).
- **Pagamento pelo caixa, sem gateway**: criar com pagamento e
  renovar exigem caixa aberto (409) e geram lançamento de entrada
  vinculado — o preço sempre vem do plano, nunca do cliente.
- **Renovação que não perde dias**: novo período começa em
  `max(agora, fim atual)`, com contador de renovações e registro do
  último pagamento; assinatura cancelada não é reativada.
- **Cancelamento auditado**: motivo obrigatório (3..500), autor e
  data registrados; dupla corrida responde 409.
- **Expiração automática nas leituras**: períodos vencidos viram
  `EXPIRED` sem job em segundo plano.
- **Faturamento do PetFlow em `/faturamento`**: catálogo de planos
  globais (seed da migration), situação da assinatura da empresa e
  troca de plano, renovação ou cancelamento — a escrita do catálogo
  global fica para papel de plataforma (pendência registrada).

---

## Roadmap — as 9 etapas

Antes das nove etapas de produto, a **fundação técnica** (Etapa 0) entregou o
monorepo, o banco de dados, a automação de verificações e a documentação base —
concluída.

| Etapa | Escopo | Status |
|:--:|---|:--:|
| **1** | Autenticação, usuários, permissões e multiempresa | **Concluída** |
| **2** | Produtos, categorias, fornecedores e estoque | **Concluída** |
| **3** | Vendas e ponto de venda (PDV) | **Concluída** |
| **4** | Caixa e financeiro | **Concluída** |
| **5** | Clientes, pets e serviços | **Concluída** |
| **6** | Integração com WhatsApp (Cloud API) | **Concluída** |
| **7** | Dashboard e relatórios gerenciais | **Concluída** |
| **8** | Agendamentos | **Concluída** |
| **9** | Assinaturas e gestão comercial | **Concluída** |

> O escopo detalhado de cada etapa futura é definido no início da etapa
> correspondente e registrado em
> [`docs/operations/IMPLEMENTATION_CHECKLIST.md`](docs/operations/IMPLEMENTATION_CHECKLIST.md).

---

## Qualidade, segurança e auditoria

| Compromisso | Como o PetFlow entrega |
|---|---|
| **Dados isolados por empresa** | `companyId` obrigatório em toda entidade, derivado da sessão autenticado — nunca enviado pelo cliente |
| **Permissões no servidor** | Guards globais de sessão e perfil administrativo; o frontend apenas reflete o que o servidor já exige |
| **Valores monetários corretos** | Decimais de 2 casas no banco e nas validações — nunca ponto flutuante |
| **Nada de estado crítico confiado ao cliente** | Preços, totais, saldos de estoque, saldo de caixa e diferenças são recalculados no servidor |
| **Trilha de auditoria** | Vendas, movimentações de estoque e de caixa nunca são apagadas: cancelamento e estorno criam registros compensatórios com autor, data e motivo |
| **Sessões seguras** | Cookie `HttpOnly` com hash SHA-256 no banco; revogação no logout e ao inativar usuários |
| **Concorrência tratada** | Trava pessimista (`FOR UPDATE`) em ordem fixa: caixa → produtos — vendas simultâneas nunca corrompem saldo |

**Evidências de verificação (Etapa 9):**

- `367` testes automatizados em PostgreSQL real — **367 aprovados**
  (30 novos: 18 de assinaturas e 12 de billing — caixa fechado 409,
  renovação, cancelamento, guards ADMIN, cross-tenant)
- `npm run lint` — 0 erros · `npm run typecheck` — 5 workspaces OK
- `npm run build` — shared, whatsapp, API, web e worker compilando ·
  `npm run db:validate` — schema válido

---

## Passo a passo — como executar o projeto

### 1. Pré-requisitos

| Ferramenta | Versão |
|---|---|
| Node.js | 20 ou superior |
| npm | 11+ (workspaces nativos) |
| PostgreSQL | 17 (porta 5432) |
| Git | 2.x |

### 2. Instalação

```bash
git clone https://github.com/Tanattos18/PetFlow.git
cd PetFlow
npm install
cp .env.example .env
```

### 3. Variáveis de ambiente (`.env`)

```dotenv
DATABASE_URL=postgresql://usuario:senha@localhost:5432/petflow
BOOTSTRAP_COMPANY_NAME=Meu Pet Shop
BOOTSTRAP_COMPANY_SLUG=meu-pet-shop
BOOTSTRAP_ADMIN_NAME=Administrador
BOOTSTRAP_ADMIN_EMAIL=admin@petshop.com
BOOTSTRAP_ADMIN_PASSWORD=<senha-forte>
```

> O `.env` **não é versionado** e nunca deve conter senhas reais em
> arquivos versionados.

### 4. Banco de dados

```bash
npm run db:migrate     # aplica as migrations
npm run db:validate    # valida o schema Prisma
```

### 5. Primeiro administrador

```bash
npm run bootstrap:admin
```

Comando idempotente: cria empresa e administrador apenas se ainda não
existirem.

### 6. Executar (três terminais)

```bash
npm run dev:api        # API  → http://localhost:3001/health
npm run dev:web        # Web  → http://localhost:3000
npm run dev:worker     # worker de tarefas
```

Acesse `http://localhost:3000` e entre com o e-mail/senha do administrador.

### 7. Verificações antes de qualquer alteração

```bash
npm run lint           # padrão de código
npm run typecheck      # tipagem estrita
npm test               # testes em PostgreSQL real
npm run build          # build completo
npm run db:validate    # schema Prisma
```

Guia completo de ambiente em
[`docs/operations/DEVELOPMENT.md`](docs/operations/DEVELOPMENT.md).

---

## Como usar o sistema

Guia prático para o dia a dia de quem opera o PetFlow. Pré-condição: os
três processos rodando (seção anterior) e o primeiro administrador criado
com `npm run bootstrap:admin`.

### Primeiro acesso

1. Abra `http://localhost:3000` e entre com o e-mail/senha do
   administrador definidos no `.env` (`BOOTSTRAP_ADMIN_*`).
2. **Esqueceu a senha ou é a primeira vez?** Na tela de login, use o
   link **"Não consegue entrar? Defina sua senha"** → informe o e-mail
   do usuário e a senha que você quer usar (recurso local, ativado com
   `PASSWORD_RESET_ENABLED=true` no `.env`; as sessões antigas são
   encerradas).
3. A **home** mostra a empresa, o seu papel e os cards de todos os
   módulos — cada card leva direto à área correspondente.
4. Para criar os demais usuários: `/usuarios` → **somente o
   administrador** define nome, e-mail, senha e perfil (administrador ou
   membro).
5. Sessão é pessoal e revogável: **Sair** encerra no servidor; se a
   sessão expirar, o sistema redireciona para o login automaticamente.

### Perfis: o que cada um faz

| Área | Administrador | Membro |
|---|:--:|:--:|
| Clientes, pets e fichas | sim | sim |
| Vendas no PDV, agendamentos e leitura de relatórios | sim | sim |
| Catálogo: serviços, produtos, categorias, fornecedores | sim | somente leitura |
| Caixa: abrir, fechar, entradas/saídas e estorno | sim | somente leitura |
| Cancelar venda, configurar/enviar WhatsApp e usuários | sim | — |
| Planos, assinaturas de clientes e faturamento (SaaS) | sim | somente leitura |

A regra é sempre a mesma: o frontend apenas reflete o que o servidor já
exige — tentar uma ação sem permissão responde com erro, não com tela
bonita.

### Rotina de um dia de trabalho

1. **Abra o caixa** (`/caixa`) informando o troco inicial — sem caixa
   aberto, o PDV bloqueia venda e o pagamento/renovação de assinatura
   responde 409.
2. **Confira a agenda do dia** (`/agenda`): navegue ←/Hoje/→, confirme
   ou conclua atendimentos; lembretes de WhatsApp saem sozinhos se a
   antecedência estiver configurada.
3. **Atenda no PDV** (`/pdv`): venda produtos (e dê baixa no estoque
   automaticamente).
4. **No fim do turno, feche o caixa** (`/caixa/fechar`): conte o
   dinheiro fisicamente e informe — o sistema calcula saldo esperado e
   diferença.
5. **Acompanhe os números** (`/dashboard` e `/relatorios`).

### Cadastrar a base (primeira vez)

Na ordem recomendada:

1. **Serviços** (`/servicos`, admin): nome, preço e duração — serão a
   base da agenda e dos relatórios.
2. **Clientes e pets** (`/clientes`, `/pets`): tutor primeiro, depois os
   animais na ficha do tutor.
3. **Produtos** (`/produtos` → categorias e fornecedores, admin):
   cadastre o estoque inicial com uma **entrada** na ficha do produto.
4. **Usuários** (`/usuarios`, admin): crie as contas da equipe com o
   perfil correto.

### Vender no PDV

1. Com o caixa aberto, acesse `/pdv` e busque por **nome, SKU ou código
   de barras**.
2. Adicione itens ao carrinho, ajuste quantidades e (opcional) selecione
   o **cliente**.
3. Escolha a forma de pagamento (dinheiro, cartão, pix, outro), aplique
   desconto se preciso e **finalize**.
4. O comprovante com código único é exibido para impressão; a venda já
   entra no histórico (`/vendas`) e, se em dinheiro, no caixa.
5. Para **cancelar** (`/vendas` → detalhe): admin, com motivo obrigatório
   — o estoque volta automaticamente e o lançamento compensatório é
   registrado (nada é apagado).

### Gerenciar o caixa e o financeiro

- `/caixa` — situação atual, abertura, entradas/saídas manuais (saída
  exige justificativa) e movimentações recentes.
- `/caixa/movimentos` — histórico com filtros e **estorno** auditável de
  lançamentos manuais.
- `/caixa/sessoes` — turnos anteriores com abertura, fechamento e
  diferença.
- `/financeiro` — resumo por período (vendas, entradas, saídas,
  cancelamentos, estornos e líquido).

### Agendar atendimentos

1. `/agenda` → **novo** (`/agenda/novo`): cliente, pet, serviço, data e
   hora — o sistema calcula a duração pelo serviço e **recusa horário
   ocupado** (conflito de toda a empresa, fim-início exato é aceito).
2. No detalhe (`/agenda/[id]`): confirmar, concluir, marcar
   "não compareceu" ou cancelar com motivo.
3. **Lembrete automático**: em `/whatsapp`, selecione um template
   aprovado com exatamente 3 variáveis, defina a antecedência (em
   minutos) e garanta o consentimento (`OPTED_IN`) do cliente na ficha
   dele — sem isso, nenhum lembrete é enfileirado.

### Trabalhar com assinaturas

1. Admin cadastra os pacotes em `/planos` (nome, preço, duração em
   dias).
2. Com o **caixa aberto**, em `/assinaturas` → **nova assinatura**:
   escolha cliente e plano e mantenha marcado *"Registrar pagamento no
   caixa"* para lançar a entrada junto.
3. No detalhe da assinatura (`/assinaturas/[id]`): veja o histórico de
   pagamentos, **renove** (o novo período começa do fim atual ou de
   agora — nunca perde dias) ou **cancele** com motivo.
4. Assinaturas vencidas aparecem como *Expiradas* automaticamente;
   cancelada não é reativada (crie uma nova se o cliente voltar).

### Enviar mensagens no WhatsApp

1. `/whatsapp` → configure as credenciais da Cloud API (somente no
   servidor) e use **Testar conexão**.
2. Cadastre **templates** com variáveis `{{1}}`, `{{2}}`..., aprove e
   ative o desejado.
3. Registre o **consentimento** do cliente (opt-in na ficha do cliente;
   opt-out por qualquer usuário ou respondendo "SAIR").
4. Como **administrador**, envie mensagens em `/whatsapp/mensagens` e
   acompanhe fila, tentativas e status (enviado/entregue/lido/falha) —
   incluindo o lembrete de agendamento.

### Acompanhar resultados

- `/dashboard` — período editável (padrão 30 dias) com vendas, caixa,
  estoque, clientes, mensagens e contagem de agendamentos.
- `/relatorios` — abas de vendas, estoque, caixa, clientes e WhatsApp
  com filtros; botão **CSV** exporta até 5000 linhas.

### Faturamento da sua empresa no SaaS

- `/faturamento` — veja o plano atual da sua empresa (essencial,
  profissional ou completo), período vigente e status; admin pode trocar
  de plano, renovar ou cancelar. A troca reinicia o período.

### Mapa de páginas

| Rota | Para quê | Quem usa |
|---|---|---|
| `/` | Home com cards de todos os módulos | todos |
| `/login`, `/redefinir-senha` | Entrar e definir/recuperar a senha | todos |
| `/usuarios` | Gerenciar contas e perfis | admin |
| `/clientes`, `/pets` | Tutores e animais | todos |
| `/servicos` | Catálogo de serviços (preço/duração) | admin escreve |
| `/produtos`, `/categorias`, `/fornecedores` | Estoque e catálogo | admin escreve; entrada/saída de estoque: todos |
| `/pdv`, `/vendas` | Vender e histórico (cancelar: admin) | todos |
| `/caixa`, `/caixa/*`, `/financeiro` | Turnos, movimentos e resumo | admin opera, todos leem |
| `/agenda` | Agendamentos do dia | todos |
| `/planos`, `/assinaturas` | Planos e assinaturas de clientes | admin escreve |
| `/faturamento` | Plano da empresa no PetFlow | admin |
| `/whatsapp`, `/whatsapp/*` | Config, templates, consentimento e envios | admin (leitura: todos) |
| `/dashboard`, `/relatorios` | Indicadores, relatórios e CSV | todos |

---

## Estrutura do repositório

```
apps/
  web/       interface web (Next.js)
  api/       API (NestJS)
  worker/    tarefas em segundo plano
packages/
  shared/    tipos e validações compartilhados (Zod)
  config/    configurações comuns (TypeScript)
database/    schema Prisma, migrations e seeds
docs/        PRD, arquitetura, banco de dados e operação
tests/       testes de integração (Vitest + Supertest)
Etapas_projeto/   prompts oficiais das etapas
automação do whatsapp/   base existente (preservada, fora do monorepo)
```

## Tecnologias

| Camada | Stack |
|---|---|
| Frontend | Next.js 15 · React 19 · Tailwind CSS 4 |
| Backend | NestJS 11 · TypeScript estrito · Zod |
| Banco | PostgreSQL 17 · Prisma ORM |
| Testes | Vitest · Supertest · PostgreSQL real |
| Processos | npm workspaces (monorepo) |

---

## Documentação

| Documento | Conteúdo |
|---|---|
| [PRD](docs/requirements/PRD.md) | visão, público, módulos e limites do produto |
| [Status do projeto](docs/operations/PROJECT_STATUS.md) | etapa atual, entregas e pendências |
| [Checklist de implementação](docs/operations/IMPLEMENTATION_CHECKLIST.md) | progresso etapa a etapa |
| [Changelog](docs/operations/CHANGELOG.md) | histórico completo de alterações |
| [Arquitetura](docs/architecture/ARCHITECTURE.md) | tecnologias e decisões registradas |
| [API](docs/architecture/API.md) | endpoints, permissões e payloads |
| [Banco de dados](docs/architecture/DATABASE.md) | modelo de dados e diretrizes |
| [Desenvolvimento](docs/operations/DEVELOPMENT.md) | ambiente e execução local |
| [AGENTS.md](AGENTS.md) | regras para agentes de desenvolvimento |

---

**PetFlow** — 9 de 9 etapas entregues (roadmap completo).
