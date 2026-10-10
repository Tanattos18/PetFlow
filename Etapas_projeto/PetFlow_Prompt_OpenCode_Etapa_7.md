# PetFlow — Prompt para OpenCode — Etapa 7: Dashboard e Relatórios

Você está trabalhando no **PetFlow**, um SaaS web multiempresa para pet shops.
**Repositório oficial:** https://github.com/Tanattos18/PetFlow.git

## Objetivo

Implementar o dashboard operacional e os relatórios iniciais do PetFlow, usando somente dados reais persistidos pelos módulos anteriores. O painel deve ajudar o responsável pelo pet shop a acompanhar vendas, estoque, caixa/financeiro, clientes, pets, serviços e WhatsApp, conforme os módulos realmente disponíveis.

**Não avance para a Etapa 8.** Ao concluir, execute testes, atualize a documentação, faça commit e push seguros para o GitHub e aguarde minha aprovação explícita.

## 1. Auditoria antes de implementar

1. Leia `AGENTS.md`, `PROJECT_STATUS`, `IMPLEMENTATION_CHECKLIST`, `CHANGELOG` e a documentação de arquitetura, banco de dados e desenvolvimento.
2. Inspecione a estrutura real do backend, frontend, worker e banco.
3. Confira `git status`, branch, histórico recente e `git remote -v`.
4. Verifique o estado real das Etapas 1 a 6: autenticação, empresas/usuários, estoque, vendas, caixa/financeiro, clientes/pets/serviços e WhatsApp.
5. Execute os testes, lint, typecheck e build existentes, quando possível.

Se houver módulos anteriores incompletos ou dados insuficientes para produzir indicadores confiáveis, pare e apresente o diagnóstico. Não invente dados, não use valores fictícios como se fossem reais e não marque módulos incompletos como concluídos.

## 2. Dashboard principal

Criar um dashboard responsivo, coerente com o layout existente, com indicadores relevantes para a operação do pet shop. Exiba somente cartões cujas fontes de dados existam e tenham sido validadas.

Indicadores possíveis, conforme os módulos existentes:
- vendas do dia e do período selecionado;
- quantidade de vendas;
- ticket médio, com regra de cálculo documentada;
- total de cancelamentos;
- entradas, saídas e saldo do caixa, respeitando o modelo financeiro existente;
- status do caixa aberto/fechado;
- produtos com estoque baixo e produtos sem estoque;
- movimentações recentes de estoque;
- novos clientes cadastrados;
- pets cadastrados;
- serviços realizados ou agendados, somente se o módulo realmente armazenar esses estados;
- estado/falhas de envio de mensagens WhatsApp, somente se a integração registrar esses dados.

Cada indicador deve exibir período e definição claros. Se uma fonte ainda não existir, oculte o indicador ou apresente um estado explícito de “módulo não disponível”, sem fabricar números.

## 3. Filtros e atualização

- Permitir selecionar um intervalo de datas com controles consistentes com o projeto.
- Aplicar filtros no backend, não apenas ocultar dados no frontend.
- Definir claramente o fuso horário utilizado nas consultas e nos limites de data.
- Evitar intervalos inválidos ou excessivamente grandes, conforme regras documentadas.
- Oferecer atualização manual do dashboard.
- Mostrar quando os dados foram carregados, além de estados de carregamento, erro e ausência de dados.
- Não implementar atualização em tempo real sem necessidade ou infraestrutura existente.

## 4. Relatórios iniciais

Criar relatórios e tabelas filtráveis somente para dados existentes, conforme módulos concluídos:

### Vendas
- lista de vendas por período;
- total bruto, descontos, cancelamentos e total líquido, respeitando os estados reais de venda;
- filtros por período e status;
- detalhes e forma de pagamento, conforme dados disponíveis.

### Estoque
- produtos com estoque baixo ou zerado;
- histórico de movimentações;
- filtros por produto, tipo e período, se suportados pelos dados atuais.

### Caixa e financeiro
- movimentações por período;
- entradas, saídas e estornos separados;
- resumo de sessões de caixa e diferenças de fechamento, se o módulo de caixa já tiver sido implementado.

### Clientes e serviços
- novos clientes e pets por período, caso haja datas de criação confiáveis;
- relatório de serviços realizados/agendados somente se tais informações existirem e seus estados forem definidos.

### WhatsApp
- quantidade e estado das mensagens por período;
- falhas e motivos disponíveis;
- não confundir mensagens aceitas pela API com mensagens entregues.

Não implemente ainda emissão fiscal, contabilidade completa, DRE, conciliação bancária ou exportações complexas sem necessidade. Se for simples e seguro, pode oferecer exportação CSV dos relatórios existentes, protegendo contra CSV injection e respeitando o escopo por empresa.

## 5. API, consultas e desempenho

- Reutilize o padrão de API, validação e autorização existente.
- Crie endpoints de leitura apropriados para os indicadores e relatórios, seguindo a nomenclatura do projeto.
- Faça agregações no banco/backend, evitando carregar todas as linhas para calcular totais no navegador.
- Aplique `companyId` obtido do contexto autenticado em todas as consultas multiempresa.
- Use paginação para listagens e limites de consulta razoáveis.
- Revise índices existentes e proponha/crie apenas índices justificados pelos filtros implementados.
- Evite consultas N+1 e consultas repetidas desnecessárias.
- Mantenha valores monetários com precisão decimal no backend; formate para exibição no frontend sem alterar a precisão persistida.
- Não introduza cache complexo ou dependências grandes sem justificativa documentada.

## 6. Gráficos e experiência de uso

- Reutilize a biblioteca de gráficos já instalada, caso exista. Se não houver, avalie uma opção leve compatível com o projeto antes de adicionar dependências.
- Use gráficos somente quando ajudarem a interpretar os dados; tabelas continuam disponíveis para detalhes.
- Garanta layout responsivo em desktop e dispositivos móveis.
- Use rótulos claros, unidades, períodos e legendas.
- Não use gráficos para mascarar ausência de dados ou comparar métricas incompatíveis.
- Respeite autenticação, permissões e o design system atual.
- Não reconstrua o frontend inteiro.

## 7. Segurança e isolamento multiempresa

- Derive a empresa a partir do contexto autenticado no servidor. Nunca confie em `companyId` enviado pelo cliente.
- Aplique as permissões existentes para dashboard e relatórios.
- Garanta que filtros, IDs e parâmetros não permitam consultar dados de outra empresa.
- Proteja endpoints de exportação e evite incluir dados pessoais além do necessário.
- Se houver CSV, neutralize células que possam ser interpretadas como fórmulas por planilhas.
- Valide filtros, datas, paginação e parâmetros no backend.
- Não exponha stack traces ou detalhes internos em respostas de erro.

## 8. Testes obrigatórios

Crie ou atualize testes para:
- agregações e totais por período;
- limites de datas e fuso horário;
- cálculos de ticket médio, cancelamentos e valores líquidos;
- filtros e paginação;
- ausência de dados;
- módulos indisponíveis ou sem fonte de dados;
- isolamento entre empresas em todos os endpoints;
- permissões;
- consistência dos relatórios com vendas, estoque e caixa;
- desempenho razoável das consultas principais, quando houver infraestrutura de teste;
- exportação CSV e proteção contra CSV injection, se implementada.

Execute os testes, lint, typecheck e build. Informe resultados reais; não declare que algo passou sem executar.

## 9. Documentação

Atualize os arquivos existentes:
- `PROJECT_STATUS`;
- `IMPLEMENTATION_CHECKLIST`;
- `CHANGELOG`;
- documentação de arquitetura e banco de dados, se alterados;
- documentação dos endpoints;
- guia de desenvolvimento;
- definições e regras de cálculo de cada indicador;
- limitações e indicadores que dependem de módulos ainda não implementados.

## 10. GitHub — obrigatório

Repositório: https://github.com/Tanattos18/PetFlow.git

1. Confira branch, `git status`, histórico e remoto antes e depois do trabalho.
2. Preserve mudanças locais/remotas existentes. Não use `git reset --hard`, `git clean -fd` ou `git push --force`.
3. Revise `git diff` e `git diff --check`.
4. Garanta que nenhum segredo, `.env` real ou arquivo sensível seja incluído.
5. Faça stage apenas dos arquivos da Etapa 7.
6. Execute os testes, lint, typecheck e build disponíveis.
7. Crie um commit semelhante a `feat(etapa-7): implementa dashboard e relatorios`.
8. Faça push para a branch correta somente se o estado remoto estiver seguro e a autenticação estiver disponível. Se houver divergência/conflito, pare e relate sem sobrescrever o remoto.
9. Informe hash do commit, branch, resultado do push e estado final do Git. Não declare push concluído se falhar.

## 11. Relatório final e encerramento

Informe:
- indicadores e relatórios implementados;
- fontes de dados reais usadas;
- arquivos e migrations alterados;
- testes executados e resultados;
- limitações e módulos ainda indisponíveis;
- instruções para executar e validar localmente;
- hash do commit, branch, resultado do push e estado final do Git.

**Pare ao concluir a Etapa 7 e aguarde minha aprovação explícita antes de iniciar a Etapa 8.**
