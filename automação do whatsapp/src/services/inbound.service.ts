import { logger } from "../config/logger";
import { prisma } from "../db/client";
import { runChatbot } from "../chatbot/engine";
import { recordInbound, dispatchText } from "./message.service";
import type { InboundMessage, StatusUpdate } from "../whatsapp/types";
import { applyStatusUpdate } from "./message.service";
import * as graphApi from "../whatsapp/graphApi";

export async function handleInbound(msg: InboundMessage, profileName?: string): Promise<void> {
  const isText = msg.type === "text" && typeof msg.text === "string";
  const content = isText ? (msg.text as string) : `[${msg.type}]`;

  const { contact, conversation, duplicate } = await recordInbound({
    phone: msg.from,
    name: profileName,
    content,
    type: msg.type,
    waMessageId: msg.waMessageId,
  });

  if (duplicate) {
    logger.debug({ waMessageId: msg.waMessageId }, "mensagem duplicada ignorada");
    return;
  }

  await graphApi.markAsRead(msg.waMessageId).catch(() => undefined);

  if (!isText) return;

  const bot = await runChatbot(contact.id, msg.text as string);
  if (!bot?.reply) return;

  await dispatchText({
    phone: contact.phone,
    content: bot.reply,
    contactId: contact.id,
    conversationId: conversation.id,
  });

  if (bot.handoff) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "PENDING" },
    });
    logger.info({ conversationId: conversation.id }, "conversa marcada para atendimento humano");
  }
}

export async function handleStatus(updates: StatusUpdate[]): Promise<void> {
  for (const update of updates) {
    await applyStatusUpdate(update.waMessageId, update.status, update.errorMessage);
  }
}
