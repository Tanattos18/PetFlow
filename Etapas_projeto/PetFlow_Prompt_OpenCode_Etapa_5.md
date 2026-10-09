# PetFlow — Prompt para OpenCode — Etapa 5: Clientes, Pets e Serviços

Você está trabalhando no **PetFlow**, um SaaS web multiempresa para pet shops.

**Repositório oficial:** https://github.com/Tanattos18/PetFlow.git

## Objetivo desta etapa

Implementar o módulo de **Clientes, Pets e Serviços**, integrado à autenticação, às empresas e às funcionalidades já existentes de produtos, estoque, vendas e caixa/financeiro.

O pet shop deverá conseguir cadastrar e administrar clientes, vincular um ou mais pets a cada cliente, manter informações úteis sobre os animais e cadastrar os serviços oferecidos. A estrutura deve preparar futuras integrações, mas não implemente agendamento completo, WhatsApp ou automações nesta etapa.

**Não avance para a Etapa 6.** Ao terminar, execute as verificações, atualize a documentação, faça commit e push seguros para o repositório indicado e aguarde minha aprovação explícita.

## 1. Auditoria obrigatória antes de alterar

1. Leia `AGENTS.md`, `PROJECT_STATUS`, `IMPLEMENTATION_CHECKLIST`, `CHANGELOG` e a documentação de arquitetura, banco de dados e desenvolvimento.
2. Inspecione a estrutura real de `apps/api`, `apps/web`, `apps/worker`, `packages/shared` e `database`.
3. Confira `git status`, branch atual, commits recentes, `git remote -v` e estado de sincronização com o remoto.
4. Verifique o estado real das Etapas 1 a 4: autenticação, isolamento multiempresa, produtos/estoque, vendas e caixa/financeiro.
5. Execute os testes, lint, typecheck e build existentes, quando possível.

Se houver falhas críticas nas etapas anteriores, problemas de isolamento entre empresas ou incompatibilidade com a implementação existente, pare e apresente o diagnóstico antes de implementar. Não presuma que algo existe apenas porque está documentado e não reescreva módulos estáveis sem necessidade.

## 2. Clientes

Implementar cadastro e gerenciamento de clientes com, conforme o padrão atual do projeto:

- Nome completo ou nome de identificação.
- Telefone e celular, se forem campos separados no padrão do sistema.
- E-mail opcional.
- CPF opcional, se houver justificativa de negócio; não exigir sem necessidade.
- Endereço opcional, estruturado de forma consistente.
- Observações internas opcionais.
- Estado ativo/inativo, sem apagar fisicamente históricos relacionados.
- Data de criação e atualização e usuário responsável quando fizer sentido.

Requisitos:

- Criar, visualizar, editar, pesquisar e listar clientes.
- Pesquisar por nome, telefone e e-mail, com paginação e limites adequados.
- Validar e normalizar dados no servidor. Evitar duplicidades óbvias dentro da mesma empresa sem bloquear indevidamente famílias que compartilhem telefone ou e-mail; definir uma estratégia apropriada e documentá-la.
- Não exigir dados que não sejam necessários para o funcionamento básico.
- Desativar clientes preservando histórico de vendas e atendimentos já existentes.

## 3. Pets vinculados a clientes

Permitir que cada cliente tenha um ou mais pets. Implementar, quando aplicável:

- Nome do pet.
- Espécie.
- Raça opcional.
- Sexo opcional.
- Data de nascimento ou idade aproximada opcional.
- Peso opcional, sem tratar como dado obrigatório.
- Cor/características físicas opcionais.
- Observações importantes e cuidados especiais.
- Estado ativo/inativo.
- Datas de criação e atualização.

Requisitos:

- Criar, visualizar, editar, pesquisar e listar pets.
- Exibir o cliente responsável por cada pet.
- Permitir atualizar o responsável do pet com validação e autorização, se essa operação fizer sentido no modelo.
- Validar que o cliente e o pet pertencem à mesma empresa.
- Preservar o histórico relacionado ao pet ao desativá-lo; não excluir registros financeiros ou de vendas.
- Não inventar prontuário veterinário, diagnóstico médico ou prescrições nesta etapa. O campo de observações serve apenas para informações operacionais do pet shop.

## 4. Catálogo de serviços

Implementar um catálogo básico dos serviços oferecidos pelo pet shop:

- Nome do serviço.
- Descrição opcional.
- Duração estimada em minutos, se aplicável.
- Preço padrão usando tipo decimal monetário.
- Estado ativo/inativo.
- Datas de criação e atualização.

Permitir criar, consultar, editar, listar, pesquisar e desativar serviços. Validar preço e duração. Não permitir que o frontend seja a fonte confiável do preço.

**Fora do escopo desta etapa:** agenda/calendário, reserva de horários, disponibilidade de profissionais, recorrência, comissões, WhatsApp, lembretes e automação de atendimento. Esses recursos pertencem a etapas posteriores ou precisam de aprovação separada.

## 5. Integração com vendas e financeiro

- Inspecione o modelo de vendas da Etapa 3 e o caixa/financeiro da Etapa 4 antes de fazer alterações.
- Permita associar uma venda a um cliente, se o modelo atual comportar isso sem quebrar vendas rápidas sem cadastro.
- Permita associar itens de serviço a uma venda somente se isso puder ser feito de forma coerente com o modelo atual; não construa agendamento ou execução de serviços nesta etapa.
- Preserve snapshots de nome e preço no histórico da venda, para que alterações posteriores no cadastro não modifiquem vendas antigas.
- Não altere silenciosamente os totais, movimentos de caixa ou históricos financeiros existentes.
- Caso a associação a clientes exija migration, implemente-a de forma compatível e documentada.

## 6. Banco de dados e arquitetura

- Reutilize Prisma, migrations, validação e padrões de API já adotados.
- Inspecione o schema existente antes de adicionar modelos. Adapte nomes e relações às convenções reais do repositório.
- Associe todos os clientes, pets e serviços à empresa correta (`companyId` ou equivalente existente).
- Use índices apropriados para consultas por empresa, nome, telefone e relações relevantes.
- Use tipos adequados para datas e valores monetários; preço de serviço deve usar `Decimal` no banco.
- Defina as relações e regras de exclusão para preservar o histórico. Prefira desativação lógica para registros referenciados por vendas ou outros registros históricos.
- Use transações para operações que alterem múltiplos registros.
- Não execute comandos destrutivos nem altere dados de produção.

## 7. Segurança e isolamento multiempresa

- Obtenha a empresa a partir do contexto autenticado no servidor; nunca confie em `companyId` enviado pelo navegador.
- Reutilize autenticação e permissões existentes. Não crie um login paralelo.
- Valide no servidor a propriedade do cliente, do pet e do serviço em cada operação.
- Um usuário de uma empresa não pode consultar, editar ou associar registros de outra empresa manipulando IDs ou parâmetros.
- Verifique permissões para criar, editar, desativar e consultar cadastros conforme os papéis já definidos.
- Valide entradas no servidor usando os padrões e schemas compartilhados existentes.
- Não exponha dados pessoais em logs desnecessários nem inclua segredos no código.

## 8. API e frontend

Adapte rotas e nomes às convenções reais do projeto. Implementar operações de API para:

- Criar, listar, pesquisar, consultar, editar e desativar clientes.
- Criar, listar, pesquisar, consultar, editar e desativar pets.
- Listar os pets de um cliente e consultar o responsável de um pet.
- Criar, listar, pesquisar, consultar, editar e desativar serviços.

Frontend:

- Criar telas responsivas de clientes, detalhes do cliente, pets vinculados e catálogo de serviços.
- Incluir formulários com validação e mensagens claras.
- Incluir pesquisa, paginação e estados de carregamento, vazio, sucesso e erro.
- Permitir navegar do cliente para seus pets e voltar ao cadastro do cliente.
- Seguir o design system, componentes, navegação e padrões existentes do PetFlow.
- Evitar reconstruir telas ou navegação que já funcionam.

## 9. Testes obrigatórios

Criar ou atualizar testes para cobrir, no mínimo:

1. Criação, consulta, edição, pesquisa e desativação de clientes.
2. Validação de campos e tratamento de duplicidades conforme a regra definida.
3. Criação e edição de pets e vínculo com cliente.
4. Rejeição de pet associado a cliente de outra empresa.
5. Criação, edição, pesquisa e desativação de serviços.
6. Validação de preço e duração de serviço.
7. Isolamento multiempresa em todas as rotas relevantes.
8. Permissões dos diferentes papéis de usuário.
9. Preservação do histórico de vendas ao editar/desativar cliente, pet ou serviço.
10. Compatibilidade de vendas sem cliente cadastrado, caso essa funcionalidade seja suportada atualmente.
11. Validação de paginação, pesquisa e parâmetros inválidos.
12. Integridade das relações e migrations.

Execute os testes, lint, typecheck e build. Não declare testes aprovados sem executá-los. Se houver bloqueio por falta de banco ou serviço, explique-o e execute o restante possível.

## 10. Documentação

Atualize a documentação existente, incluindo:

- `PROJECT_STATUS`.
- `IMPLEMENTATION_CHECKLIST`.
- `CHANGELOG`.
- Documentação de arquitetura e banco de dados.
- Guia de desenvolvimento e configuração local.
- Documentação das rotas, validações e regras de negócio.

Registre as decisões relevantes sobre campos opcionais, duplicidade, desativação lógica e associação de clientes às vendas.

## 11. GitHub — obrigatório ao final

Repositório: https://github.com/Tanattos18/PetFlow.git

1. Antes de editar, verifique branch, `git status`, histórico e `git remote -v`.
2. Preserve alterações locais e remotas preexistentes. Não descarte trabalho do usuário.
3. Não use `git reset --hard`, `git clean -fd` ou `git push --force`.
4. Execute testes, lint, typecheck e build e revise `git diff` e `git diff --check`.
5. Confira que nenhum `.env` real, token, senha ou segredo será incluído.
6. Faça stage apenas dos arquivos relacionados à Etapa 5, sem incluir mudanças não relacionadas.
7. Crie um commit com mensagem semelhante a `feat(etapa-5): implementa clientes pets e serviços`.
8. Faça push para a branch correta somente se o estado remoto estiver seguro e a autenticação estiver disponível.
9. Se houver conflito, divergência ou risco de sobrescrever alterações, pare e relate o problema; não force o push.
10. Informe hash do commit, branch, resultado do push e estado final do Git. Se o push falhar, explique o motivo sem alegar que foi concluído.

## 12. Relatório final e limite da etapa

Ao terminar, informe:

- Funcionalidades implementadas.
- Arquivos e migrations relevantes.
- Regras de negócio adotadas.
- Testes executados e resultados reais.
- Pendências e limitações.
- Como executar e validar localmente.
- Hash do commit, branch, resultado do push e estado final do repositório.

**Finalize somente a Etapa 5. Atualize a documentação, faça commit e push seguros e aguarde minha aprovação explícita antes de iniciar a Etapa 6.**
