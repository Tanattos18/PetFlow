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
