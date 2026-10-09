# database/

Organização do banco de dados do PetFlow usando **Prisma**.

## Layout

- `prisma/schema.prisma` — fonte única do schema (Etapa 0: apenas generator + datasource, sem tabelas de negócio).
- `prisma/migrations/` — migrations gerenciadas pelo Prisma.
- `seeds/` — scripts de seed iniciais (criados nas etapas que introduzirem tabelas).

## Adaptação de layout

O Prisma por padrão usa a pasta `prisma/` na raiz do projeto. Como o PetFlow é um
monorepo, o schema fica em `database/prisma/` e todos os comandos usam
`--schema database/prisma/schema.prisma` (scripts `db:*` na raiz).

## Comandos

```bash
npm run db:validate    # valida o schema
npm run db:generate    # gera o client Prisma
npm run db:migrate     # cria/aplica migrations (requer PostgreSQL acessível)
```
