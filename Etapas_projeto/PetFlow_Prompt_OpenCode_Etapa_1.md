# PROMPT PARA OPENCODE — PETFLOW | ETAPA 1
## Autenticação, empresas, usuários, permissões e isolamento multiempresa

Você está trabalhando no projeto **PetFlow**, um SaaS web de gestão para pet shops que deverá evoluir por etapas controladas. A Etapa 0 já foi concluída. Sua tarefa agora é implementar **somente a Etapa 1**, descrita neste documento.

## 1. Contexto atual do projeto

A base existente inclui, conforme a documentação da Etapa 0:

- Monorepo com npm workspaces (`apps/*`, `packages/*`).
- `apps/api`: API NestJS, endpoint `GET /health` e filtro global de exceções.
- `apps/web`: Next.js com Tailwind CSS.
- `apps/worker`: stub para tarefas em segundo plano.
- `packages/shared`: schemas Zod e elementos compartilhados de base.
- `packages/config`: configuração TypeScript compartilhada.
- `database/`: schema Prisma técnico, estrutura para migrations e seeds.
- Testes com Vitest e Supertest.
- Documentação: PRD, arquitetura, banco de dados, desenvolvimento, changelog, status, checklist e `AGENTS.md`.
- Existe uma pasta preexistente `automação do whatsapp/`, que foi preservada na Etapa 0.

A documentação reporta que lint, typecheck, testes e build passaram na Etapa 0. Node.js 24.21.0 e npm 11.19.0 estavam disponíveis. PostgreSQL e Docker não estavam instalados no ambiente descrito. Confirme o estado real antes de agir; não presuma que o ambiente continua igual.

## 2. Regra principal: inspecionar antes de modificar

Antes de escrever código:

1. Leia `AGENTS.md`, `README.md` (se existir), `docs/architecture/ARCHITECTURE.md`, `docs/architecture/DATABASE.md` ou o arquivo equivalente, `docs/operations/DEVELOPMENT.md` ou `DEVELOPMENT.md`, `PROJECT_STATUS.md` e `IMPLEMENTATION_CHECKLIST.md`.
2. Inspecione a estrutura atual, `package.json` da raiz e dos workspaces, schema Prisma, configuração de ambiente, scripts, testes e o estado do Git.
3. Confirme as dependências instaladas e como o projeto realmente executa.
4. Preserve os arquivos e funcionalidades existentes. Não recrie o projeto do zero, não apague configurações e não reorganize diretórios sem necessidade técnica justificada.
5. Se os documentos divergirem do código real, priorize a inspeção do código e registre a divergência na documentação.
6. Não imprima nem exponha valores secretos de `.env`. Confira apenas nomes de variáveis necessárias. Nunca grave segredos reais em código, testes, logs, documentação ou Git.

## 3. Objetivo da Etapa 1

Implementar uma fundação funcional e testável para:

- Configuração inicial de uma empresa/tenant.
- Cadastro e gerenciamento básico de usuários associados à empresa.
- Login e logout.
- Autenticação segura da API.
- Papéis e permissões iniciais.
- Isolamento rigoroso dos dados entre empresas.
- Persistência no PostgreSQL usando Prisma.
- Testes automatizados de autenticação, autorização e isolamento.

**Não implemente ainda** produtos, estoque, fornecedores, vendas/PDV, caixa, contas a pagar/receber, clientes, animais, serviços, agendamentos, WhatsApp, dashboard de negócio ou assinaturas comerciais. Esses módulos ficam para etapas futuras.

## 4. Primeiro, verifique o banco e o ambiente

- Verifique se PostgreSQL já está instalado ou acessível e se existe uma `DATABASE_URL` configurada, sem mostrar o valor.
- Verifique se Docker está disponível, mas não instale ferramentas nem altere o sistema operacional sem autorização.
- Se o banco estiver disponível, prossiga com migrations e testes reais.
- Se não estiver disponível, implemente o código e a configuração necessários, valide tudo o que for possível sem banco e documente claramente o que ainda exige PostgreSQL.
- Não declare migrations, persistência ou testes de integração como aprovados se não tiver executado essas verificações.
- Não use banco em memória como substituto silencioso para afirmar que o PostgreSQL está funcionando.

## 5. Modelo de dados mínimo

Projete o modelo de acordo com a arquitetura e o schema Prisma já existentes. No mínimo, avalie e implemente as seguintes entidades:

### Company
- `id`
- `name`
- `slug` ou identificador equivalente, único
- `status` (por exemplo, ativa/inativa)
- `createdAt`
- `updatedAt`

### User
- `id`
- `companyId` obrigatório
- `name`
- `email` normalizado e único dentro da empresa
- `passwordHash`
- `role`
- `status`
- `createdAt`
- `updatedAt`

### Session ou mecanismo de sessão
Use a abordagem de autenticação mais apropriada à arquitetura existente. Se usar sessões persistidas, modele revogação e expiração. Se usar tokens, defina expiração, estratégia de renovação e revogação de forma segura, sem inventar uma implementação parcial que não possa ser testada.

Regras:
- Um usuário pertence a uma empresa nesta etapa.
- Email deve ser normalizado antes de validar unicidade e autenticar.
- Defina índices e restrições adequados.
- Não armazene senhas em texto puro; use uma biblioteca de hash apropriada, com parâmetros seguros.
- Não inclua senha, hash ou tokens em respostas da API ou logs.
- Prefira exclusão lógica/inativação quando necessário para preservar rastreabilidade.
- Não crie tabelas de negócio fora do escopo desta etapa.

## 6. Autenticação e segurança

Implemente fluxos reais, integrados ao frontend e à API:

1. Inicialização segura da primeira empresa e do primeiro usuário administrador.
2. Login com email e senha.
3. Logout com invalidação efetiva da sessão/token, conforme a estratégia escolhida.
4. Endpoint para consultar o usuário autenticado (`me` ou equivalente).
5. Proteção dos endpoints privados.
6. Gestão mínima de usuários da mesma empresa, apenas por um usuário com permissão administrativa.
7. Validação de entrada no backend e mensagens de erro consistentes.
8. Limitação básica de tentativas de login, se compatível com a arquitetura, ou documentar explicitamente a proteção pendente para não alegar que existe.
9. Configuração segura de CORS, cookies e/ou tokens, conforme a estratégia selecionada.
10. Segredos apenas via variáveis de ambiente, com validação de configuração na inicialização.

Escolha **uma única estratégia coerente de autenticação**, documente a decisão e implemente-a integralmente. Para uma aplicação web própria, considere sessão segura com cookie `HttpOnly`, `Secure` em produção, `SameSite` apropriado e proteção CSRF quando aplicável. Não misture JWT, cookies e armazenamento no browser sem uma necessidade clara.

Nunca armazene credenciais de autenticação no `localStorage`. Não exponha tokens em URLs. Não registre senhas, tokens ou cookies em logs.

## 7. Inicialização do primeiro administrador

O processo de bootstrap precisa ser seguro e documentado.

- Não crie uma conta administrativa com senha padrão conhecida.
- Não deixe endpoint público que permita a qualquer pessoa registrar a primeira empresa ou tomar controle do sistema.
- Implemente um comando/script administrativo de bootstrap protegido, ou outro fluxo seguro apropriado à arquitetura.
- Solicite as credenciais por variáveis de ambiente ou entrada segura; nunca grave credenciais reais em seeds versionados.
- Garanta que o bootstrap não crie duplicatas se executado novamente.
- Documente como executar, verificar e recuperar o acesso administrativo sem enfraquecer a segurança.

## 8. Multiempresa e isolamento de dados — requisito crítico

A aplicação será SaaS e poderá atender várias pet shops. A separação de dados não pode depender apenas de o frontend esconder informações.

- Derive o `companyId` do contexto autenticado no servidor, nunca confie no `companyId` enviado pelo navegador para autorizar operações.
- Todas as consultas e alterações de usuários devem ser limitadas à empresa autenticada.
- Usuários de uma empresa não podem consultar, alterar, desativar ou administrar usuários de outra empresa.
- Não aceite o `companyId` enviado pelo cliente como autoridade.
- Crie testes que tentem acessar recursos de outra empresa e confirmem a negação.
- Se houver helpers/guards para tenant, use-os de modo consistente e documentado.
- Evite confiar em IDs difíceis de adivinhar como medida de segurança.
- Ao criar novos recursos, estabeleça um padrão que torne obrigatório aplicar o escopo de empresa. Documente o padrão para os módulos futuros.
- Se identificar risco de acesso cruzado, corrija antes de considerar a etapa concluída.

## 9. Frontend

No `apps/web`, implemente somente telas necessárias para esta etapa:

- Tela de login responsiva e coerente com a identidade visual inicial do PetFlow.
- Estados de carregamento, erro de autenticação e campos inválidos.
- Área inicial protegida após login, exibindo o nome da empresa e o usuário autenticado.
- Ação de logout.
- Interface mínima para um administrador listar e cadastrar usuários da própria empresa, se isso couber no escopo sem introduzir complexidade desnecessária.
- Tratamento de sessão expirada e redirecionamento para login.

Use componentes e padrões já presentes no projeto. Evite instalar bibliotecas novas se as dependências existentes forem suficientes. Não crie telas fictícias que pareçam funcionar sem integração real à API.

## 10. API e contratos

Organize os módulos de acordo com os padrões NestJS existentes. Defina e documente os endpoints efetivamente implementados. Considere, conforme a arquitetura final:

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- Endpoint seguro de bootstrap administrativo, preferencialmente via CLI/script e não público
- Endpoints administrativos para listar/criar/inativar usuários da mesma empresa

Não é obrigatório usar exatamente esses caminhos se o projeto tiver convenções diferentes; documente os caminhos reais.

Requisitos:
- DTOs e validação de entrada.
- Códigos HTTP adequados.
- Respostas sem dados sensíveis.
- Erros previsíveis e consistentes.
- Autorização aplicada no servidor, não apenas na interface.
- Testes dos caminhos de sucesso e falha.

## 11. Testes obrigatórios

Crie testes adequados às ferramentas já existentes. Inclua, no mínimo:

- Login válido.
- Senha incorreta.
- Usuário inexistente.
- Usuário inativo.
- Acesso privado sem autenticação.
- Logout e confirmação de que a sessão não pode mais ser usada.
- Acesso autorizado de administrador.
- Usuário comum sem permissão administrativa.
- Tentativa de administrar usuário de outra empresa.
- Consultas/alterações com isolamento de tenant.
- Normalização de email.
- Bootstrap idempotente e sem senha padrão.

Use mocks apenas onde fizer sentido. Para afirmar que a persistência real funciona, execute testes de integração com PostgreSQL. Se o ambiente não permitir, separe claramente testes unitários dos testes pendentes de integração.

## 12. Documentação que deve ser atualizada

Atualize, de acordo com o que realmente foi implementado:

- `IMPLEMENTATION_CHECKLIST.md`: marcar apenas itens concluídos com evidência.
- `PROJECT_STATUS.md`: registrar a Etapa 1, entregas, comandos executados, resultados reais e pendências.
- `CHANGELOG.md`: mudanças relevantes da etapa.
- `docs/architecture/ARCHITECTURE.md`: autenticação, autorização e estratégia multiempresa.
- `docs/architecture/DATABASE.md` ou arquivo equivalente: modelos, índices, restrições e migrations.
- `DEVELOPMENT.md` ou `docs/operations/DEVELOPMENT.md`: configuração do PostgreSQL, variáveis necessárias, migrations, bootstrap seguro e execução local.
- `AGENTS.md`: somente se forem necessários novos padrões permanentes para agentes/futuras etapas.

Não reescreva documentos inteiros sem necessidade; mantenha histórico e organização existentes.

## 13. Critérios de aceite

A Etapa 1 só pode ser marcada como concluída se:

- [ ] O schema de dados está coerente e validado.
- [ ] Migrations foram criadas e aplicadas em um banco de desenvolvimento real, ou a pendência é declarada explicitamente sem marcar a etapa como concluída.
- [ ] O primeiro administrador pode ser criado por um fluxo seguro e documentado.
- [ ] Login, consulta de sessão/usuário e logout funcionam.
- [ ] O frontend usa a autenticação real da API.
- [ ] Endpoints privados exigem autenticação.
- [ ] Permissões administrativas são verificadas no backend.
- [ ] Isolamento entre empresas foi testado.
- [ ] Testes, lint, typecheck e build foram executados, com resultados documentados.
- [ ] Documentação e checklist correspondem ao estado real.

Não marque a Etapa 1 como concluída se houver falhas críticas de segurança ou se os critérios centrais não tiverem evidência.

## 14. Restrições de escopo

- Não implementar módulos de negócio das etapas 2 em diante.
- Não desenvolver integração com WhatsApp nesta etapa.
- Não adicionar cobrança/assinatura comercial.
- Não migrar ou alterar o conteúdo de `automação do whatsapp/`.
- Não instalar Docker, PostgreSQL ou outros programas no sistema operacional sem autorização explícita.
- Não apagar dados, arquivos ou configurações existentes.
- Não fazer refatorações amplas não relacionadas à etapa.
- Não afirmar que algo funciona sem executar testes que comprovem isso.
- Não avançar para a Etapa 2 automaticamente.

## 15. Relatório final obrigatório

Ao terminar, apresente:

1. Resumo do que foi implementado.
2. Arquivos novos e alterados, agrupados por frontend, backend, banco e documentação.
3. Decisões técnicas tomadas e motivos.
4. Endpoints reais disponíveis.
5. Como configurar o ambiente e criar o primeiro administrador.
6. Comandos de validação executados e resultados exatos.
7. Testes de isolamento multiempresa e seus resultados.
8. Pendências, riscos ou validações que não puderam ser executadas.
9. Estado atualizado do `IMPLEMENTATION_CHECKLIST.md` e `PROJECT_STATUS.md`.
10. Confirmação explícita de que **parou na Etapa 1** e aguarda revisão/autorização antes de começar a Etapa 2.

Implemente com cuidado, em incrementos pequenos, seguindo os padrões existentes. Priorize segurança, isolamento de dados e clareza. **Não avance além do escopo autorizado da Etapa 1.**
