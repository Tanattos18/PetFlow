# Instruções para agentes de desenvolvimento — PetFlow

Este repositório contém: (1) o monorepo do **PetFlow** (etapa ativa do
projeto) e (2) a pasta `automação do whatsapp/`, base existente que deve ser
preservada e não confundida com o código do PetFlow.

## Regras obrigatórias

1. **Inspecionar antes de agir**: ler `docs/operations/PROJECT_STATUS.md` e
   `docs/operations/IMPLEMENTATION_CHECKLIST.md` para saber a etapa atual.
2. **Escopo da etapa**: implementar apenas o que a etapa vigente autoriza.
   Nunca avançar para módulos de negócio ou etapas futuras sem autorização
   explícita do proprietário.
3. **Preservar arquivos existentes**: não sobrescrever, apagar ou mover arquivos
   sem antes verificar a finalidade. Preservar o histórico do CHANGELOG.
4. **Não duplicar projetos**: não criar outro projeto dentro do monorepo; usar
   os workspaces existentes (`apps/*`, `packages/*`).
5. **Dependências mínimas**: só instalar bibliotecas justificadas; registrar a
   justificativa no relatório/CHANGELOG quando relevante.
6. **Sem segredos**: nunca gravar senhas, tokens ou credenciais reais em
   código, Git ou documentação. Somente variáveis de ambiente via `.env`
   (não versionado) e `.env.example` com exemplos.
7. **Tipagem forte**: TypeScript estrito; erros tratados explicitamente.
8. **Banco de dados**: qualquer mudança de schema exige migration em
   `database/prisma/migrations/` e atualização de `docs/architecture/DATABASE.md`
   quando as diretrizes mudarem.
9. **Testes**: rodar `npm run lint`, `npm run typecheck` e `npm test` antes de
   concluir qualquer tarefa; não marcar verificação como concluída sem evidência.
10. **Documentação**: atualizar `CHANGELOG.md`, `PROJECT_STATUS.md` e
    `IMPLEMENTATION_CHECKLIST.md` ao final de cada etapa concluída.
11. **Commits**: somente quando solicitado pelo proprietário; mensagem objetiva
    no padrão do repositório.
12. **Pasta `automação do whatsapp/`**: não modificar sem instrução; não é
    parte do monorepo PetFlow (excluída do lint e do build).

## Comandos de verificação

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run db:validate   # requer DATABASE_URL definida
```

## Ao final de cada tarefa

- Relatar: o que foi criado, o que foi alterado, o que foi preservado, testes
  executados e pendências.
- Parar e aguardar autorização antes da próxima etapa.
