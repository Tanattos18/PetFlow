# Desenvolvimento — PetFlow

## Pré-requisitos

| Ferramenta | Versão usada no ambiente | Observação |
|---|---|---|
| Node.js | 24.21.0 (mínimo 20) | `node -v` |
| npm | 11.19.0 | workspaces nativos |
| Git | 2.55 | versionamento |
| PostgreSQL | não instalado neste ambiente | necessário apenas quando houver persistência; ver abaixo |

> O ambiente atual (máquina de desenvolvimento) **não possui Docker nem
> PostgreSQL instalados**. A Etapa 0 funciona sem banco; quando a Etapa que
> introduzir persistência chegar, será preciso instalar o PostgreSQL (ex.:
> instalador oficial, WSL ou Docker Desktop) e criar o banco `petflow`.

## Instalação

```bash
npm install
cp .env.example .env    # ajuste as variáveis conforme necessário
```

O `.env` não é versionado. O `.env.example` contém apenas exemplos não secretos.

## Inicialização (3 terminais)

```bash
npm run dev:api      # NestJS em http://localhost:3001
npm run dev:web      # Next.js em http://localhost:3000
npm run dev:worker   # worker de background (stub na Etapa 0)
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

## Estrutura rápida

Ver `docs/architecture/ARCHITECTURE.md` e o `README.md` na raiz.

## Padrões

- TypeScript estrito em todos os projetos.
- Erros tratados de forma explícita (filtro global de exceções na API).
- Logs estruturados do NestJS (`Logger`).
- Nunca commitar `.env` ou credenciais reais.
