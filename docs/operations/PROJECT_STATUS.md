# Status do projeto — PetFlow

## Etapa atual

**Etapa 5 — Clientes, pets e serviços** — CONCLUÍDA
(aguardando aprovação do proprietário para avançar).

Data: 2026-10-09.

Etapas anteriores: Etapa 0 (2026-10-09), Etapa 1 (2026-10-09),
Etapa 2 (2026-10-09), Etapa 3 (2026-10-09), Etapa 4 (2026-10-09).

## Entregas concluídas (Etapa 5)

- [x] Migration aditiva `20261009222638_etapa5_clients_pets_services`
      aplicada em `petflow` (dev) e `petflow_test` (testes); schema
      validado; nenhum dado existente alterado.
- [x] Modelos: `Client` (contatos normalizados, endereço estruturado,
      `nameKey` com índice — sem unique, política de duplicidade suave),
      `Pet` (espécie/sexo/nascimento/peso, FK `Restrict` ao responsável)
      e `Service` (nome único por empresa via `nameKey`, preço
      `Decimal(12,2)`, duração opcional 1..1440 min);
      `Sale.clientId` opcional (FK `SetNull` + índice); enums
      `PetSpecies` e `PetSex`.
- [x] API módulos `clients`, `pets` e `services` (prefixo `/api`):
      listagem com busca/filtros/paginação, detalhe, criação, edição e
      `PATCH /:id/status`; `GET /clients/:id/pets`; escrita de
      clientes/pets autenticada (MEMBER), escrita de serviços restrita
      a ADMIN; leitura de tudo autenticada; recursos de outra empresa →
      404.
- [x] Anti-duplicidade de clientes: `nameKey` + contato igual com
      cliente `ACTIVE` → 409 `"Cliente possivelmente duplicado"`;
      homônimos sem contato e famílias com mesmo telefone são permitidos;
      pre-check documentado no serviço (sem unique duro no banco).
- [x] Integração venda–cliente: `POST /sales` aceita `clientId`
      opcional validado no servidor (ativo + mesma empresa; caso
      contrário 400); listagem e detalhe retornam `client`; venda rápida
      sem cliente continua funcionando; snapshots/totais preservados.
- [x] Schemas Zod compartilhados (`@petflow/shared`) de clientes, pets
      e serviços + enums/labels; `createSaleSchema` com `clientId`
      opcional; validações de data futura, peso e duração.
- [x] Frontend: `/clientes` (lista com busca e contagem de pets,
      cadastro/endereço completo, ativar/inativar),
      `/clientes/[id]` (ficha + gestão de pets),
      `/pets` (listagem global com filtros e cadastro/edição),
      `/servicos` (catálogo, escrita só ADMIN); `/pdv` com seletor
      opcional de cliente; `/vendas` e detalhe exibem o cliente; home
      com "Clientes e animais" e "Serviços" disponíveis; badge
      "Etapa 5".

## Testes executados

| Verificação | Comando | Resultado |
|---|---|---|
| Schema Prisma válido | `npm run db:validate` | OK |
| Lint | `npm run lint` | OK (0 erros) |
| Typecheck | `npm run typecheck` | OK (4 workspaces) |
| Testes (PostgreSQL real) | `npm test` | 190/190 aprovados (11 arquivos) |
| Build | `npm run build` | OK (shared, api, web, worker; 22 rotas) |
| E2E API + web | script `e2e-etapa5.ps1` | 40/40 verificações OK |

Cobertura dos testes novos (49): clientes (normalização de telefone/
email/CPF, duplicidade 409 vs. homônimos e famílias, cliente inativo
não bloqueia novo cadastro, busca/paginação, isolamento multiempresa,
contagem de pets/vendas, permissão MEMBER), pets (sexo padrão,
formatação de peso/nascimento, responsável inválido/inativo, espécie/
data/peso inválidos, filtros, troca de responsável dentro da empresa e
recusa entre empresas, status), serviços (criação ADMIN, 403 MEMBER na
escrita e leitura liberada, nome duplicado 409, validações de preço/
duração, ordenação por preço, edição/inativação) e vendas com cliente
(vínculo no recibo e detalhe, venda rápida sem cliente, `clientId` de
outra empresa e cliente inativo rejeitados).

## Pendências conhecidas

- CI (lint + typecheck + testes) quando solicitado.
- Validação de dígitos verificadores de CPF/CNPJ (hoje CPF valida
  apenas 11 dígitos) — avaliar em etapa avançada.
- Duplicidade de clientes: janela de corrida aceita (sem unique duro de
  `nameKey`) — se necessária garantia forte, migrar para tabela de
  identidade/contato deduplicada.
- Itens de serviço em vendas: fora do escopo da Etapa 5 (catálogo de
  serviços é preparação para agendamentos da Etapa 6).
- Estoque negativo nunca é permitido por padrão; backorder seria decisão
  explícita.
- Formas de pagamento configuráveis além de Dinheiro/Cartão/Pix/Outro.
- Vendas anteriores à Etapa 4 (sem `cashSessionId`/lançamento) ficam fora
  do financeiro — limitação de dados de desenvolvimento.
- Integração da pasta `automação do whatsapp/` em etapa própria.

## Git

- Branch: `main`; remoto: `origin` → `https://github.com/Tanattos18/PetFlow.git`.
- `3b77828` feat(etapa-1): autenticação, usuários, permissões e multiempresa
- `6a36407` feat(etapa-2): implementa produtos e controle de estoque
- `e305d52` docs: registra hashes dos commits e push da etapa 2
- `912d1c8` feat(etapa-3): implementa vendas e ponto de venda
- `6ae287d` feat(etapa-4): implementa caixa e financeiro
- `bf2d5a9` docs: registra hash do commit da etapa 4
- `398ad85` docs: registra push da etapa 4
- `59ef5a2` docs: reescreve README com roadmap das 9 etapas
- Push confirmado até `59ef5a2` antes da Etapa 5; hash do commit da
  Etapa 5 registrado nesta seção após o push.

## Próxima etapa autorizada

**Etapa 6 — a definir** — a iniciar somente após aprovação explícita do
proprietário.
