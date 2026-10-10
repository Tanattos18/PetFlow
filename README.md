# PetFlow

**SaaS de gestão para pet shops de pequeno porte.**
Cadastros de clientes e animais, catálogo de serviços, produtos e estoque,
vendas e ponto de venda, caixa e financeiro — com permissões por perfil,
isolamento total entre empresas e trilha de auditoria em cada operação.

> **Status:** 7 de 9 etapas concluídas (mais a fundação técnica do projeto).
> Etapas 1–7 entregues e verificadas em 09/10/2026 (aguardando aprovação).
> Próxima etapa: **Etapa 8 — Agendamentos** (escopo a definir na abertura).
> Detalhes em [`docs/operations/PROJECT_STATUS.md`](docs/operations/PROJECT_STATUS.md).

---

## Sumário

1. [O que já está disponível](#o-que-já-está-disponível)
2. [Roadmap — as 9 etapas](#roadmap--as-9-etapas)
3. [Qualidade, segurança e auditoria](#qualidade-segurança-e-auditoria)
4. [Passo a passo — como executar o projeto](#passo-a-passo--como-executar-o-projeto)
5. [Estrutura do repositório](#estrutura-do-repositório)
6. [Tecnologias](#tecnologias)
7. [Documentação](#documentação)

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
- **Serviços realizados ficam indisponíveis** até a Etapa 8 — o
  dashboard nunca inventa dado que o sistema ainda não registra.
- **Mesmas regras de segurança do restante:** leitura exige sessão,
  cada empresa enxerga apenas os próprios números e o `companyId`
  vem sempre da sessão.

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
| **8** | Agendamentos | **Próxima** |
| **8** | Agendamentos | Planejada |
| **9** | Assinaturas e gestão comercial | Planejada |

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

**Evidências de verificação (Etapa 7):**

- `292` testes automatizados em PostgreSQL real — **292 aprovados**
  (41 novos de relatórios: agregações, fronteiras UTC, CSV, isolamento)
- `npm run lint` — 0 erros · `npm run typecheck` — 4 workspaces OK
- `npm run build` — API, web e worker compilando · `npm run db:validate` — schema válido

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

**PetFlow** — 7 de 9 etapas entregues. Próxima: agendamentos.
