# SaaS PetShop - Automação WhatsApp

Estrutura base de um sistema de automação no WhatsApp usando **Node.js + TypeScript**, **WhatsApp Business Cloud API (Meta)**, fila com **BullMQ/Redis**, chatbot por fluxo e painel web.

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 20+ / TypeScript |
| API | Express + Zod |
| Banco | PostgreSQL + Prisma |
| Fila | BullMQ + Redis |
| WhatsApp | WhatsApp Business Cloud API (Graph API v20) |
| Painel | HTML/CSS/JS estático (servido pelo Express) |

## Estrutura

```
├── prisma/
│   ├── schema.prisma        # Contact, Conversation, Message, Flow, ChatbotState
│   └── seed.ts              # carrega os fluxos de chatbot
├── src/
│   ├── config/              # env (zod) e logger (pino)
│   ├── db/client.ts         # PrismaClient
│   ├── whatsapp/
│   │   ├── graphApi.ts      # sendText, sendTemplate, markAsRead
│   │   ├── webhook.service.ts  # verificação, assinatura, parsing
│   │   └── types.ts
│   ├── services/
│   │   ├── message.service.ts   # persistência + dispatch
│   │   └── inbound.service.ts   # inbound → chatbot → resposta
│   ├── chatbot/
│   │   ├── engine.ts        # máquina de estados salva em ChatbotState
│   │   └── flows/welcome.ts # definição de fluxo de exemplo
│   ├── queue/
│   │   ├── queue.ts         # BullMQ (fila whatsapp-send)
│   │   └── worker.ts        # consumidor dos envios
│   ├── routes/              # /webhooks e /api
│   ├── app.ts               # montagem do Express
│   └── index.ts             # bootstrap
└── web/                     # painel de atendimento
```

## Como rodar

```bash
npm install
cp .env.example .env       # preencha as credenciais da Meta
docker compose up -d       # postgres + redis
npm run prisma:migrate
npm run prisma:seed        # (script seed roda via prisma db seed)
npm run dev                # API + worker + painel em http://localhost:3000
```

Suba um túnel público (ngrok / cloudflare tunnel) e configure no app da Meta:

- **URL de callback**: `https://SEU_DOMINIO/webhooks/whatsapp`
- **Verify token**: valor de `WA_VERIFY_TOKEN`
- **Campos assinados**: `messages`

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/webhooks/whatsapp` | verificação do webhook (Meta) |
| POST | `/webhooks/whatsapp` | recebe mensagens e status |
| POST | `/webhooks/send` | envio simples (aceita e processa) |
| GET | `/api/health` | health com checagem de banco |
| GET/POST | `/api/contacts` | lista/cadastro de contatos |
| GET | `/api/conversations` | conversas recentes |
| GET | `/api/conversations/:id/messages` | mensagens da conversa |
| POST | `/api/conversations/:id/reply` | resposta do atendente |
| POST | `/api/messages/broadcast` | disparo em massa com intervalo |
| GET/POST | `/api/flows` | fluxos do chatbot |
| GET | `/api/queue/stats` | métricas da fila |

## Chatbot

O fluxo `petshop_welcome` é definido em `src/chatbot/flows/welcome.ts` e gravado no banco pelo seed. O estado de cada contato fica em `ChatbotState` (nó atual + contexto). Fluxos também podem ser criados via `POST /api/flows` com JSON no formato `{ start, nodes }`.

Quando o fluxo pede `action: "handoff"`, a conversa muda para `PENDING` e o painel permite resposta humana.

## Próximos passos sugeridos

- Campanhas agendadas (tabela Campaign + jobs recorrentes)
- Multi-usuário / permissões no painel
- Webhook de saída para integrations (CRM)
- Upload de mídia via Graph API (`/media` + `media_id`)
