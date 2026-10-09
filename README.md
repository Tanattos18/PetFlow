# PetFlow

SaaS web de gestão para pet shops de pequeno porte: produtos e estoque, vendas
e PDV, caixa, clientes e animais, serviços e agendamentos, automação WhatsApp e
relatórios gerenciais.

> **Status:** Etapa 0 (fundação técnica) concluída. Nenhum módulo de negócio
> implementado ainda. Acompanhe em
> [`docs/operations/PROJECT_STATUS.md`](docs/operations/PROJECT_STATUS.md).

## Stack

- **Frontend:** Next.js 15 + React 19 + Tailwind CSS 4 (`apps/web`)
- **Backend:** NestJS 11 + TypeScript (`apps/api`)
- **Worker:** processo de background tasks (`apps/worker`)
- **Banco:** PostgreSQL + Prisma (`database/`)
- **Compartilhado:** Zod (`packages/shared`), tsconfig base (`packages/config`)
- **Testes:** Vitest + Supertest (`tests/`)

## Estrutura

```
apps/
  web/       interface Next.js
  api/       API NestJS
  worker/    tarefas em segundo plano
packages/
  shared/    tipos e validações compartilhados
  config/    configurações comuns
database/    schema Prisma, migrations e seeds
docs/        PRD, arquitetura e operação
tests/       testes compartilhados
automação do whatsapp/   base existente (preservada, fora do monorepo)
```

## Início rápido

```bash
npm install
cp .env.example .env

npm run dev:api      # http://localhost:3001/health
npm run dev:web      # http://localhost:3000
npm run dev:worker
```

Verificações:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Detalhes de ambiente e pré-requisitos em
[`docs/operations/DEVELOPMENT.md`](docs/operations/DEVELOPMENT.md).

## Documentação

| Documento | Conteúdo |
|---|---|
| [PRD](docs/requirements/PRD.md) | visão, público, módulos e limites do MVP |
| [Arquitetura](docs/architecture/ARCHITECTURE.md) | tecnologias e regras de evolução |
| [Banco de dados](docs/architecture/DATABASE.md) | diretrizes do modelo de dados |
| [Desenvolvimento](docs/operations/DEVELOPMENT.md) | como rodar localmente |
| [Changelog](docs/operations/CHANGELOG.md) | histórico de alterações |
| [Status](docs/operations/PROJECT_STATUS.md) | etapa atual e pendências |
| [Checklist](docs/operations/IMPLEMENTATION_CHECKLIST.md) | progresso geral |
| [AGENTS.md](AGENTS.md) | regras para agentes de desenvolvimento |
