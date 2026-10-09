# Status do projeto — PetFlow

## Etapa atual

**Etapa 0 — Criação da base do projeto** — CONCLUÍDA (aguardando aprovação do
proprietário para avançar).

Data: 2026-10-09.

## Entregas concluídas

- [x] Inspeção do diretório e do ambiente (Node 24.21.0, npm 11.19.0, sem
      Docker/PostgreSQL, sem repositório Git prévio).
- [x] Monorepo com workspaces e estrutura `apps/`, `packages/`, `database/`,
      `docs/`, `tests/`.
- [x] API NestJS com health check e tratamento global de erros.
- [x] Frontend Next.js + Tailwind mínimo (identidade inicial, sem módulos de
      negócio).
- [x] Worker stub para futuras tarefas em segundo plano.
- [x] Schema Prisma técnico + organização de migrations/seeds.
- [x] Lint, typecheck, build e testes executados com sucesso.
- [x] Documentação obrigatória criada.

## Testes executados

| Verificação | Comando | Resultado |
|---|---|---|
| Schema Prisma válido | `npm run db:validate` | OK (requer `DATABASE_URL` no ambiente) |
| Lint | `npm run lint` | OK (0 erros) |
| Typecheck | `npm run typecheck` | OK (4 workspaces) |
| Testes | `npm test` | 2/2 aprovados |
| Build | `npm run build` | OK (api, web, worker, shared) |
| API no ar | `GET http://localhost:3001/health` | 200 `{"status":"ok",...}` |
| Web no ar | `GET http://localhost:3000` | 200, conteúdo PetFlow renderizado |
| Worker no ar | `npm run dev:worker` | heartbeat registrado no console |

## Pendências conhecidas

- Instalar/configurar PostgreSQL quando a etapa de persistência iniciar.
- Reavaliar integração da pasta `automação do whatsapp/` com o PetFlow em
  etapa própria (fora do escopo da Etapa 0).
- Adicionar CI (lint + typecheck + testes) quando solicitado.
- Definir autenticação e multiempresa (não autorizado nesta etapa).

## Próxima etapa autorizada

**Etapa 1** — a iniciar somente após aprovação explícita do proprietário.
Escopo sugerido para proposta: fundação de dados (empresa piloto, usuários,
autenticação básica) — a ser detalhado e aprovado antes da implementação.
