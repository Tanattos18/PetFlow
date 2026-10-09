# PROMPT PARA OPENCODE — PETFLOW | ETAPA 2
## Produtos, estoque, fornecedores e movimentações

Você está trabalhando no **PetFlow**, um SaaS web de gestão para pet shops. A Etapa 0 criou a fundação do projeto; a Etapa 1 deve estabelecer autenticação, usuários, empresas e isolamento multiempresa. Agora implemente **somente a Etapa 2: produtos e estoque**, incluindo fornecedores e rastreabilidade das movimentações.

Repositório GitHub oficial: `https://github.com/Tanattos18/PetFlow.git`

## 1. Inspecionar antes de modificar

1. Leia `AGENTS.md`, `README.md`, `PROJECT_STATUS.md`, `IMPLEMENTATION_CHECKLIST.md`, `CHANGELOG.md`, `DEVELOPMENT.md` e os documentos relevantes em `docs/`.
2. Inspecione o código real de frontend, backend, banco, autenticação, autorização, validação, testes e configurações. Identifique os padrões adotados na Etapa 1.
3. Execute `git status`, confira a branch atual, os últimos commits e o remoto `origin`.
4. Confirme se a Etapa 1 foi implementada e validada. Se estiver incompleta, houver falhas críticas ou não existir autenticação/isolamento multiempresa confiável, **não comece a Etapa 2**. Apresente um diagnóstico e pare para aprovação.
5. Preserve alterações preexistentes e trabalho não commitado. Não descarte, sobrescreva ou inclua alterações alheias à etapa.
6. Nunca mostre valores secretos de `.env`. Não presuma nomes de arquivos, tabelas, endpoints ou scripts: use os existentes e mantenha consistência.

## 2. Objetivo e limites

Entregar uma versão funcional do módulo de **cadastro e controle de produtos e estoque**, com:
- Categorias de produtos.
- Cadastro e edição de produtos.
- Cadastro e manutenção básica de fornecedores.
- Entradas e saídas de estoque rastreáveis.
- Ajustes de inventário com justificativa.
- Consulta de saldo e histórico de movimentações.
- Alertas de estoque baixo.
- Busca, filtros, paginação e validações.
- Interface web integrada à API e ao banco de dados real.

**Não implementar nesta etapa:** vendas/PDV, caixa/financeiro, clientes, animais, serviços, agendamentos, integração WhatsApp, dashboard gerencial ou assinaturas comerciais. Não criar telas demonstrativas com dados falsos como se fossem funcionalidades reais.

## 3. Multiempresa e autorização — requisito crítico

- Derive a empresa do contexto autenticado no servidor. Nunca confie em `companyId` enviado pelo frontend para autorizar acesso.
- Todas as consultas, listagens, contagens, alterações, inativações e movimentações devem ser limitadas ao tenant autenticado.
- Produtos, categorias e fornecedores pertencem a uma empresa e não podem ser acessados por outra.
- Valide a propriedade de todos os IDs relacionados.
- Reutilize os papéis/permissões definidos na Etapa 1; não crie um sistema paralelo.
- Aplique autorização na API, não apenas esconda botões.
- Crie testes que tentem acessar recursos de outra empresa.
- Documente o padrão para os próximos módulos.

## 4. Modelo de dados

Inspecione o schema Prisma existente e amplie-o sem apagar nem recriar tabelas existentes. Adapte nomes e convenções do projeto, considerando:

### Category
- `id`, `companyId`, `name`, `description` opcional, `isActive`/status, `createdAt`, `updatedAt`.
- Nome único por empresa conforme regra de normalização documentada.

### Supplier
- `id`, `companyId`, `name`, `document` opcional, `email` opcional, `phone` opcional, `notes` opcional, status, `createdAt`, `updatedAt`.
- Não exija dados pessoais desnecessários. Se CPF/CNPJ for usado, valide formato quando preenchido.

### Product
- `id`, `companyId`, `categoryId` opcional, `supplierId` opcional ou relação N:N se justificada,
- `sku` ou código interno único por empresa quando preenchido,
- `barcode` opcional e único por empresa quando preenchido,
- `name`, `description` opcional, `unit`,
- `costPrice`, `salePrice`, `minimumStock`,
- status, `createdAt`, `updatedAt`.
- Defina claramente se o saldo será materializado no produto ou calculado pelas movimentações.
- Preços e custo devem usar decimal no banco, nunca ponto flutuante binário. Preço, custo e estoque mínimo não podem ser negativos. Quantidades devem respeitar precisão e unidade definidas.

### StockMovement
- `id`, `companyId`, `productId`,
- `type` (entrada, saída, ajuste positivo ou ajuste negativo),
- `quantity` positiva, com a direção definida pelo tipo,
- `reason`/`notes` obrigatório para ajustes,
- `reference` opcional,
- `createdByUserId`, `createdAt`.
- Cada movimento deve ser rastreável por empresa, produto, usuário e data.
- Não permita editar/apagar o histórico por operações comuns; correções devem ser compensatórias ou auditáveis.

### Integridade
- Use chaves estrangeiras, índices e restrições adequadas.
- Evite relacionamentos entre entidades de empresas diferentes.
- Crie migration versionada; não edite migrations já aplicadas.
- Não apague dados existentes.
- Documente as decisões adotadas.

## 5. Regras de estoque e consistência

1. Entradas aumentam o saldo e saídas diminuem.
2. Ajustes exigem motivo.
3. Por padrão, bloqueie saída que resulte em estoque negativo.
4. Rejeite quantidade zero ou negativa.
5. Atualização do saldo e criação do movimento devem ocorrer na mesma transação se o saldo for materializado.
6. Proteja contra movimentações concorrentes que poderiam gerar saldo incorreto ou negativo.
7. Nunca altere o saldo sem gerar histórico auditável.
8. Calcule alertas de estoque baixo quando saldo for menor ou igual ao mínimo, com regra para produtos inativos documentada.
9. Garanta consistência mesmo quando ocorrer erro parcial.
10. Documente unidades de medida e precisão aceitas.

## 6. API

Organize módulos conforme a arquitetura NestJS existente e use os padrões atuais de DTOs, validação, guards e erros.

Implemente endpoints equivalentes para:
- Categorias: listar, consultar, criar, editar e inativar.
- Fornecedores: listar, consultar, criar, editar e inativar.
- Produtos: listar com filtros/paginação, consultar, criar, editar e inativar.
- Estoque: entrada, saída, ajuste, saldo e histórico.
- Alertas: produtos com estoque baixo.

Os caminhos exatos podem seguir as convenções existentes; documente os caminhos reais. Implemente busca por nome/SKU/código de barras, filtros por categoria/fornecedor/status/estoque baixo, paginação limitada e ordenação segura. Nunca aceite saldo enviado pelo cliente como fonte de verdade. Retorne códigos HTTP e erros consistentes.

## 7. Frontend

Implemente interfaces responsivas e funcionais para:
1. Listagem de produtos com busca, filtros, paginação e alerta visual de estoque baixo.
2. Cadastro e edição de produto.
3. Detalhes do produto com saldo e histórico de movimentações.
4. Cadastro/listagem/edição de categorias.
5. Cadastro/listagem/edição de fornecedores.
6. Formulários de entrada, saída e ajuste; motivo obrigatório para ajustes.
7. Estados de carregamento, vazio, sucesso e erro; validação de campos.
8. Confirmação antes de inativar registros.

Reutilize layout, componentes, identidade visual, sessão e cliente de API existentes. Todas as telas devem usar API real, não arrays fixos simulando persistência. Trate sessão expirada e erros de autorização.

## 8. Auditoria e segurança

- Registre autoria de alterações relevantes.
- Não exclua fisicamente produtos com movimentações; use inativação.
- Não exclua categorias/fornecedores em uso sem regra segura.
- Normalize e valide dados no servidor.
- Não revele se um ID de outra empresa existe.
- Não registre tokens ou dados sensíveis em logs.
- Não enfraqueça proteções da Etapa 1.
- Não adicione dependências sem necessidade; justifique novas dependências.

## 9. Testes obrigatórios

Inclua testes para:
- CRUD válido e validação de campos.
- Rejeitar preços, estoque mínimo e quantidades negativos.
- SKU/código de barras duplicados na mesma empresa.
- Validar que categoria e fornecedor pertencem à empresa do produto.
- Entrada aumenta saldo; saída reduz saldo.
- Saída superior ao saldo é rejeitada.
- Ajustes exigem justificativa.
- Quantidade zero/negativa é rejeitada.
- Falha transacional não deixa saldo e histórico divergentes.
- Movimentações concorrentes não causam saldo incorreto.
- Histórico inclui usuário, data, tipo, quantidade e motivo.
- Alertas de estoque baixo funcionam.
- Acesso sem autenticação/permissão é negado.
- Tentativas de acessar, editar ou movimentar dados de outra empresa são negadas.

Execute testes unitários e, quando possível, testes de integração com PostgreSQL real. Não afirme que transações/concorrência reais foram testadas se só usou mocks. Registre testes pendentes quando o banco não estiver disponível.

## 10. Documentação

Atualize sem apagar histórico:
- `IMPLEMENTATION_CHECKLIST.md`: marque apenas itens com evidência.
- `PROJECT_STATUS.md`: entregas, testes reais e pendências.
- `CHANGELOG.md`: mudanças da etapa.
- Documentação do banco: entidades, relações, índices e migration.
- Documentação da API: endpoints, filtros e permissões.
- Guia de desenvolvimento: variáveis, migrations, execução e testes.
- `AGENTS.md` somente se surgir padrão permanente importante.

Documente estratégia do saldo, regra de estoque negativo, unidades, normalização de SKU/barcode e limitações conhecidas.

## 11. Critérios de aceite

A etapa só pode ser marcada como concluída se:
- [ ] A Etapa 1 funciona e suas proteções continuam ativas.
- [ ] Migration criada e validada; aplicação real confirmada se PostgreSQL estiver disponível.
- [ ] CRUD de produtos, categorias e fornecedores funciona pela API e frontend.
- [ ] Entradas, saídas e ajustes atualizam saldo e histórico consistentemente.
- [ ] Saídas não permitem saldo negativo por padrão.
- [ ] Histórico é rastreável e não editável por operações comuns.
- [ ] Alertas de estoque baixo funcionam.
- [ ] Isolamento multiempresa coberto por testes.
- [ ] Testes, lint, typecheck e build executados e resultados registrados.
- [ ] Documentação reflete o estado real.
- [ ] Commit criado e push confirmado, conforme seção Git.

Se houver falha crítica de segurança, inconsistência de saldo ou testes obrigatórios falhando, não declare a etapa concluída.

## 12. Git e GitHub — obrigatório ao final

Repositório oficial: `https://github.com/Tanattos18/PetFlow.git`

1. Antes e depois das alterações, confira `git status`, branch, histórico e `origin`.
2. Preserve alterações locais/remotas existentes; não sobrescreva trabalho.
3. Revise `git diff` e arquivos novos.
4. Verifique que `.env`, credenciais, tokens, builds e arquivos indevidos não serão commitados.
5. Execute validações antes de commitar.
6. Adicione apenas arquivos relacionados à Etapa 2 e sua documentação. Prefira caminhos específicos; evite `git add .` se houver risco de incluir alterações alheias.
7. Crie um commit claro, por exemplo: `feat(etapa-2): implementa produtos e controle de estoque`.
8. Faça `git push` para a branch correta quando autenticado e seguro.
9. Confirme hash do commit, branch, resultado do push e estado final do Git.
10. Se houver conflito, divergência remota, falha de autenticação ou risco de sobrescrever trabalho, pare e explique; não force push e não descarte alterações.

Não afirme que commit/push foi realizado sem confirmação. Registre hash, branch e resultado na documentação.

## 13. Relatório final obrigatório

Apresente:
1. Resumo do implementado.
2. Arquivos criados/alterados por frontend, API, banco, testes e documentação.
3. Migration e alterações do schema.
4. Endpoints reais.
5. Regras de saldo, unidades, ajustes e alertas.
6. Resultados exatos de testes, lint, typecheck e build.
7. Resultados dos testes de isolamento multiempresa.
8. Pendências e testes não executados.
9. Hash do commit, branch e confirmação do push — ou motivo exato se não concluído.
10. Estado atualizado do checklist e status.

**Pare ao concluir a Etapa 2 e aguarde aprovação explícita. Não inicie a Etapa 3 (Vendas e PDV) automaticamente.** Priorize integridade do estoque, rastreabilidade, segurança e isolamento entre empresas.
