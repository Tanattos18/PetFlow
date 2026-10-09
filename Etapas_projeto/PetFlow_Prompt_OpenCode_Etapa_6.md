# PetFlow — Prompt para OpenCode — Etapa 6: Integração com WhatsApp

Você está trabalhando no **PetFlow**, um SaaS web multiempresa para pet shops.
**Repositório oficial:** https://github.com/Tanattos18/PetFlow.git

## Objetivo

Implementar a primeira versão do módulo de comunicação e automação via WhatsApp, integrada aos clientes, pets e serviços já existentes. Priorize uma integração oficial, segura, configurável por empresa e com falhas tratadas de forma transparente.

**Não avance para a Etapa 7.** Ao concluir, execute as verificações, atualize a documentação, faça commit e push seguros e aguarde minha aprovação explícita.

## 1. Auditoria antes de alterar

1. Leia `AGENTS.md`, `PROJECT_STATUS`, `IMPLEMENTATION_CHECKLIST`, `CHANGELOG` e a documentação de arquitetura, banco de dados e desenvolvimento.
2. Inspecione a estrutura real do backend, frontend, worker, pacotes compartilhados e banco.
3. Verifique `git status`, branch, commits recentes e `git remote -v`.
4. Confirme o que realmente existe nas Etapas 1 a 5, principalmente autenticação, isolamento multiempresa, clientes, pets e serviços.
5. Execute testes, lint, typecheck e build existentes quando possível.

Se houver falhas críticas, etapas anteriores incompletas ou ausência dos dados necessários, pare e apresente o diagnóstico. Não presuma que módulos existem apenas porque aparecem na documentação.

## 2. Provedor e limites da integração

- Inspecione as integrações e dependências atuais antes de escolher uma implementação.
- Priorize a **WhatsApp Business Platform / Cloud API oficial da Meta** ou uma camada de provedor que permita integração oficial.
- Não automatize WhatsApp Web por scraping, Selenium, sessão pessoal, QR de conta pessoal ou bibliotecas não oficiais que possam comprometer a conta.
- Não invente credenciais, IDs, endpoints ou respostas de API.
- Se credenciais reais não estiverem disponíveis, implemente a estrutura configurável, mocks/adaptadores e testes locais; documente o que depende de configuração externa. Não declare que mensagens reais foram enviadas.
- Tokens e segredos devem ficar apenas em variáveis de ambiente/secret manager; nunca no frontend, Git, logs ou documentação.
- Respeite políticas do WhatsApp, modelos de mensagem aprovados quando necessários, janela de atendimento aplicável, opt-in/consentimento e solicitações de descadastro.

## 3. Escopo funcional inicial

### Configuração por empresa
- Tela/estrutura de configuração da integração por empresa.
- Campos não secretos necessários ao provedor, como estado da integração e identificadores exigidos pelo provedor.
- Segredos apenas no backend por variáveis de ambiente ou mecanismo seguro já adotado.
- Status claro: não configurado, configurado, ativo, erro ou desconectado.
- Teste de configuração/saúde somente se houver endpoint oficial apropriado e credenciais válidas.

### Contatos e consentimento
- Reutilize os clientes existentes e seus telefones; não duplique cadastros sem necessidade.
- Validar e normalizar telefones em formato internacional/E.164 quando aplicável.
- Registrar consentimento/opt-in, origem e data quando o sistema enviar mensagens proativas.
- Permitir registrar descadastro e impedir novos envios proativos para quem recusou.
- Não enviar mensagens para uma lista de contatos sem consentimento adequado.

### Mensagens e modelos
- Criar estrutura para modelos/templates de mensagem, com tipo, conteúdo, variáveis permitidas, estado e referência do modelo aprovado pelo provedor quando aplicável.
- Permitir mensagens transacionais simples, como confirmação ou lembrete de serviço, apenas quando os dados e regras existentes suportarem esse fluxo.
- Validar variáveis no servidor e formatar conteúdo de forma segura.
- Não prometer que um template foi aprovado sem confirmação do provedor.

### Fila de envio e histórico
- Utilizar `apps/worker` ou a arquitetura de filas já existente, sem criar uma segunda infraestrutura desnecessária.
- Criar fila persistente de mensagens com estados como pendente, processando, aceita pelo provedor, entregue, falha e cancelada, conforme os eventos realmente disponíveis.
- Registrar destinatário, empresa, tipo, template, origem, tentativas, timestamps e código/motivo de falha sem gravar tokens.
- Implementar retry limitado com backoff para erros transitórios; não repetir indefinidamente erros permanentes.
- Implementar idempotência para evitar mensagens duplicadas por retries ou cliques repetidos.
- Aplicar limites de envio e evitar rajadas descontroladas.
- Não marcar uma mensagem como entregue apenas porque a API aceitou a solicitação.

### Webhooks
- Implementar webhooks conforme a documentação oficial do provedor escolhido.
- Validar a verificação inicial e a autenticidade das notificações conforme suportado.
- Tratar eventos repetidos de forma idempotente.
- Não confiar em dados recebidos pelo webhook sem validação.
- Não expor endpoints administrativos sem autenticação/validação apropriada.

### Interface
- Tela de configuração/status da integração.
- Histórico de mensagens com filtros por período, contato, estado e tipo.
- Detalhes de falhas e orientação segura para correção.
- Ações manuais de envio apenas para usuários autorizados e com consentimento/regras aplicáveis.
- Estados de carregamento, vazio, sucesso e erro.
- Reutilizar o layout e os componentes atuais.

## 4. Fora do escopo desta etapa

Não implementar ainda chatbot autônomo com IA, campanhas em massa indiscriminadas, CRM completo, múltiplos provedores complexos sem necessidade, cobrança via WhatsApp ou automações não suportadas pela API oficial. O dashboard analítico pertence à Etapa 7.

Se criar lembretes automáticos de serviços, garanta que sejam opt-in, configuráveis e baseados em dados reais do módulo de serviços. Não invente agendamentos caso eles ainda não existam.

## 5. Banco de dados e arquitetura

- Reutilize Prisma, migrations e padrões já existentes.
- Adapte os modelos ao schema real; conceitos possíveis incluem configuração de integração, template, consentimento, mensagem e tentativa de envio.
- Todo registro de negócio deve estar vinculado à empresa e ter isolamento multiempresa.
- Armazene apenas os dados necessários; limite o acesso ao conteúdo e histórico de mensagens.
- Use transações quando houver múltiplas gravações relacionadas.
- Não faça migration destrutiva nem altere dados de produção.
- Documente variáveis necessárias no `.env.example` com placeholders, nunca credenciais reais.
- Se a configuração segura de credenciais depender de uma ação manual, documente exatamente como configurar sem expor segredos.

## 6. Segurança e isolamento multiempresa

- Derive a empresa do contexto autenticado no servidor; nunca confie em `companyId` fornecido pelo navegador.
- Reutilize autenticação e permissões existentes.
- Impeça que uma empresa consulte configurações, contatos, mensagens ou templates de outra.
- Proteja segredos e dados pessoais; não registre tokens nem conteúdo sensível desnecessário nos logs.
- Valide permissões para configurar a integração, gerenciar templates e solicitar envios.
- Valide entradas e normalize telefones no backend.
- Considere rate limiting, validação de autenticidade de webhook e proteção contra replay, conforme o provedor.

## 7. Testes obrigatórios

Criar/atualizar testes para:
- configuração sem credenciais e tratamento seguro de credenciais inválidas;
- isolamento entre empresas e permissões;
- validação/normalização de telefone;
- opt-in e bloqueio após descadastro;
- validação de templates e variáveis;
- criação e processamento da fila;
- idempotência e retries limitados;
- classificação de erros transitórios e permanentes;
- webhook autêntico, inválido e repetido, conforme a implementação;
- estados de mensagens sem alegar entrega não confirmada;
- proteção contra envio duplicado.

Execute testes, lint, typecheck e build. Informe resultados reais. Se a integração real não puder ser testada sem credenciais, deixe isso explícito e cubra o adaptador com mocks.

## 8. Documentação

Atualize `PROJECT_STATUS`, `IMPLEMENTATION_CHECKLIST`, `CHANGELOG`, arquitetura e banco de dados, documentação dos endpoints e webhooks, `.env.example`, instruções de configuração e limitações conhecidas. Separe claramente o que funciona localmente do que depende de configuração da Meta/provedor.

## 9. GitHub — obrigatório

Repositório: https://github.com/Tanattos18/PetFlow.git

1. Antes e depois do trabalho, confira branch, `git status`, histórico e remoto.
2. Preserve mudanças existentes; não use `git reset --hard`, `git clean -fd` ou `push --force`.
3. Revise `git diff` e `git diff --check`.
4. Garanta que tokens, segredos, `.env` real e credenciais não serão commitados.
5. Faça stage apenas dos arquivos relacionados à Etapa 6.
6. Execute os testes, lint, typecheck e build disponíveis.
7. Crie um commit semelhante a `feat(etapa-6): implementa integracao WhatsApp`.
8. Faça push apenas para a branch correta e se o estado remoto estiver seguro. Se houver conflito ou divergência, pare e relate sem sobrescrever o remoto.
9. Informe hash do commit, branch, resultado real do push e estado final do Git. Não declare push concluído se falhar.

## 10. Relatório final e encerramento

Informe funcionalidades implementadas, arquivos e migrations alterados, provedor/adaptador utilizado e o que depende de credenciais, testes executados e resultados, limitações, passos para configurar e validar, hash do commit, branch, resultado do push e estado do Git.

**Pare após concluir a Etapa 6. Não inicie a Etapa 7 até receber minha aprovação explícita.**
