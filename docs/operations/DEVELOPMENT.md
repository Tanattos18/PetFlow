# Desenvolvimento — PetFlow

## Pré-requisitos

| Ferramenta | Versão usada no ambiente | Observação |
|---|---|---|
| Node.js | 24.21.0 (mínimo 20) | `node -v` |
| npm | 11.19.0 | workspaces nativos |
| Git | 2.55 | versionamento |
| PostgreSQL | 17 local (serviço `postgresql-x64-17`, porta 5432) | necessário desde a Etapa 1; **sem Docker** neste ambiente |

> A Etapa 1 exige PostgreSQL real. Bancos usados: `petflow` (dev) e
> `petflow_test` (testes). `psql` disponível em
> `C:\Program Files\PostgreSQL\17\bin`.

## Instalação

```bash
npm install
cp .env.example .env    # ajuste as variáveis conforme necessário
```

O `.env` não é versionado. O `.env.example` contém apenas exemplos não secretos.

### Variáveis de ambiente (Etapa 1)

| Variável | Finalidade |
|---|---|
| `DATABASE_URL` | conexão com o PostgreSQL (obrigatória) |
| `API_PORT` / `WEB_PORT` | portas da API (3001) e do web (3000) |
| `APP_ORIGINS` | allowlist de CORS (ex.: `http://localhost:3000`) |
| `AUTH_RATE_LIMIT_MAX` | máximo de tentativas de login (padrão 5/15min) |
| `AUTH_SESSION_TTL_HOURS` | validade da sessão (padrão 12h) |
| `AUTH_COOKIE_SECURE` | `true` em produção (cookie `Secure`) |
| `BOOTSTRAP_COMPANY_NAME`, `BOOTSTRAP_COMPANY_SLUG` | empresa do bootstrap |
| `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | primeiro administrador |

### Banco e migrations

```bash
npm run db:migrate      # aplica migrations pendentes (usa DATABASE_URL)
npm run db:validate     # valida o schema Prisma
```

Testes criam/aplicam migrations no banco `petflow_test` automaticamente
(`tests/global-setup.ts`).

### Bootstrap do primeiro administrador

```bash
# com as variáveis BOOTSTRAP_* definidas no .env ou no ambiente:
npm run bootstrap:admin
```

- Idempotente: não duplica empresa/usuário já existentes.
- Sem senha padrão: a senha vem de `BOOTSTRAP_ADMIN_PASSWORD` e não é
  versionada. Recuperação de acesso: reexecutar o comando com as variáveis
  adequadas ou redefinir a senha via SQL direto no banco.

## Inicialização (3 terminais)

```bash
npm run dev:api      # NestJS em http://localhost:3001 (rota: /api/...)
npm run dev:web      # Next.js em http://localhost:3000 (proxy /api → 3001)
npm run dev:worker   # worker de background (stub)
```

## Comandos de verificação

```bash
npm run lint         # ESLint em todo o monorepo
npm run typecheck    # TypeScript em todos os workspaces
npm test             # Vitest (testes compartilhados em tests/)
npm run build        # build de todos os workspaces
npm run db:validate  # valida o schema Prisma (requer DATABASE_URL no .env ou no ambiente)
```

## Health check

```bash
curl http://localhost:3001/health
# {"status":"ok","service":"petflow-api","timestamp":"...","uptimeSeconds":...}
```

Observação: o health fica fora do prefixo `/api` por decisão registrada na
Etapa 1; os demais endpoints ficam em `/api/...`.

## Produtos e estoque (Etapa 2)

- Endpoints, filtros e permissões: `docs/architecture/API.md`.
- Testes de estoque (incluindo concorrência) rodam no `petflow_test` via
  `npm test`; a migration é aplicada automaticamente no setup dos testes.
- Saldo é sempre calculado no servidor (transação + lock); não existe
  endpoint para "setar" saldo diretamente.

## Vendas e PDV (Etapa 3)

- Endpoints, payloads e permissões: `docs/architecture/API.md`.
- `/pdv` busca produtos via `GET /api/products?search=&status=ACTIVE`;
  o carrinho é estado local — valores exibidos são calculados para UX, mas
  o servidor recalcula tudo na finalização.
- `clientRequestId` (UUID por intenção de venda) é reutilizado em caso de
  falha de rede e regenerado após o sucesso — assim o retry não duplica a
  venda e o clique duplo recebe 409.
- Testes de vendas (transações, concorrência, cancelamento) rodam no
  `petflow_test` via `npm test`; a migration é aplicada no setup.

## Caixa e financeiro (Etapa 4)

- Endpoints, payloads e permissões: `docs/architecture/API.md`.
- Vendas, cancelamentos e movimentações manuais exigem sessão de caixa
  aberta (409) — no frontend o `/pdv` verifica
  `GET /api/cash/sessions/current` (404 = caixa fechado) e exibe banner
  com link para `/caixa`.
- Saldo esperado/diferença e resumo financeiro são calculados no
  servidor; `inCash` separa dinheiro físico (saldo do caixa) das demais
  formas de pagamento (resumo financeiro).
- Testes do caixa (`tests/cash.test.ts`) rodam no `petflow_test` via
  `npm test`; a migration é aplicada no setup. `tests/sales.test.ts`
  abre uma sessão de caixa no `beforeAll`.

## Estrutura rápida

Ver `docs/architecture/ARCHITECTURE.md` e o `README.md` na raiz.

## Padrões

- TypeScript estrito em todos os projetos.
- Erros tratados de forma explícita (filtro global de exceções na API).
- Logs estruturados do NestJS (`Logger`).
- Nunca commitar `.env` ou credenciais reais.
