# Changelog — PetFlow

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Etapa 0] — 2026-10-09

### Adicionado

- Monorepo com npm workspaces (`apps/*`, `packages/*`).
- `apps/api`: aplicação NestJS mínima com `GET /health` e filtro global de
  exceções.
- `apps/web`: aplicação Next.js mínima com Tailwind CSS, layout de boas-vindas
  e listagem informativa dos módulos planejados (sem funcionalidades).
- `apps/worker`: processo stub de background tasks com heartbeat e shutdown
  gracioso.
- `packages/shared`: pacote com constantes e schemas Zod de base
  (paginação, formato de erro de API).
- `packages/config`: `tsconfig.base.json` compartilhado.
- `database/`: schema Prisma técnico (sem tabelas de negócio), pastas de
  migrations e seeds documentadas.
- `tests/health.test.ts`: testes Vitest + Supertest do health check e do 404
  tratado.
- Documentação: PRD, ARCHITECTURE, DATABASE (diretrizes), DEVELOPMENT,
  CHANGELOG, PROJECT_STATUS, IMPLEMENTATION_CHECKLIST e AGENTS.md.
- Configuração de ESLint 9 (flat config), Vitest e `.env.example`.

### Preservado

- Pasta `automação do whatsapp/` (base existente de automação WhatsApp)
  mantida intacta, sem alterações.
- Documento `PETFLOW — ETAPA 0.txt` (entrada do processo) mantido na raiz.

### Notas

- Nenhum módulo de negócio implementado (regra da Etapa 0).
- Nenhum segredo real presente nos arquivos criados.
