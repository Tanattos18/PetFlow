# Checklist geral de implementação — PetFlow

## Etapa 0 — Base do projeto

- [x] Inspecionar diretório, Git, dependências e configurações existentes
- [x] Preservar arquivos preexistentes (`automação do whatsapp/`, documento da etapa)
- [x] Criar monorepo (npm workspaces)
- [x] `apps/api` — NestJS mínimo com health check e tratamento de erros
- [x] `apps/web` — Next.js + Tailwind mínimo
- [x] `apps/worker` — stub de tarefas em segundo plano
- [x] `packages/shared` — tipos/validações compartilhados (base)
- [x] `packages/config` — tsconfig base
- [x] `database/` — schema Prisma técnico + migrations/seeds organizados
- [x] Scripts de dev, build, lint e testes
- [x] `.env.example` sem segredos
- [x] `.gitignore` adequado
- [x] Testes (health check via Vitest + Supertest)
- [x] Documentação: PRD, ARCHITECTURE, DATABASE, DEVELOPMENT, CHANGELOG, PROJECT_STATUS, AGENTS.md
- [x] Validações executadas com evidência

## Etapa 1 — (a definir e aprovar)

- [ ] Definir escopo detalhado com o proprietário
- [ ] Implementar fundação de dados/autenticação (se aprovado)
- [ ] Atualizar documentação e checklist

## Etapas futuras — módulos de negócio

- [ ] Cadastro de clientes e animais
- [ ] Produtos e estoque
- [ ] Vendas e PDV
- [ ] Caixa e financeiro
- [ ] Serviços e agendamentos
- [ ] Automação WhatsApp
- [ ] Dashboard e relatórios
- [ ] Assinaturas/multiempresa comercial

> Regra: nenhuma etapa é iniciada sem autorização explícica; marcar itens aqui
> apenas com evidência de execução.
