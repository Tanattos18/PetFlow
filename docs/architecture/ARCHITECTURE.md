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
