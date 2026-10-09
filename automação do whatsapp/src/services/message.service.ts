import { prisma } from "../db/client";
import { logger } from "../config/logger";
import { enqueueSend } from "../queue/queue";
import * as graphApi from "../whatsapp/graphApi";

export async function upsertContact(phone: string, name?: string) {
  return prisma.contact.upsert({
    where: { phone },
    update: name ? { name } : {},
    create: { phone, name },
  });
}

export async function getOrCreateConversation(contactId: string) {
  const open = await prisma.conversation.findFirst({
    where: { contactId, status: { in: ["OPEN", "PENDING"] } },
    orderBy: { startedAt: "desc" },
  });
  if (open) return open;
  return prisma.conversation.create({ data: { contactId } });
}

export async function recordInbound(params: {
  phone: string;
  name?: string;
  content: string;
  type: string;
  waMessageId: string;
}) {
  const contact = await upsertContact(params.phone, params.name);
  const conversation = await getOrCreateConversation(contact.id);

  const existing = await prisma.message.findUnique({ where: { waMessageId: params.waMessageId } });
  if (existing) return { contact, conversation, duplicate: true };

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      contactId: contact.id,
      direction: "INBOUND",
      type: params.type,
      content: params.content,
      waMessageId: params.waMessageId,
      status: "DELIVERED",
    },
  });

  return { contact, conversation, message, duplicate: false };
}

export async function recordOutboundQueued(contactId: string, content: string, conversationId?: string) {
  return prisma.message.create({
    data: {
      contactId,
      conversationId,
      direction: "OUTBOUND",
      type: "text",
      content,
      status: "QUEUED",
    },
  });
}

export async function dispatchText(params: {
  phone: string;
  content: string;
  contactId: string;
  conversationId?: string;
  delayMs?: number;
}) {
  if (params.delayMs && params.delayMs > 0) {
    await recordOutboundQueued(params.contactId, params.content, params.conversationId);
    await enqueueSend({ contactPhone: params.phone, content: params.content }, params.delayMs);
    return { queued: true };
  }

  try {
    const result = await graphApi.sendText(params.phone, params.content);
    await prisma.message.create({
      data: {
        contactId: params.contactId,
        conversationId: params.conversationId,
        direction: "OUTBOUND",
        type: "text",
        content: params.content,
        waMessageId: result.waMessageId,
        status: "SENT",
      },
    });
    return { queued: false, waMessageId: result.waMessageId };
  } catch (err) {
    logger.error({ err, phone: params.phone }, "falha no envio direto");
    await prisma.message.create({
      data: {
        contactId: params.contactId,
        conversationId: params.conversationId,
        direction: "OUTBOUND",
        type: "text",
        content: params.content,
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

export async function applyStatusUpdate(waMessageId: string, status: string, errorMessage?: string) {
  const map: Record<string, "SENT" | "DELIVERED" | "READ" | "FAILED"> = {
    sent: "SENT",
    delivered: "DELIVERED",
    read: "READ",
    failed: "FAILED",
  };

  const mapped = map[status];
  if (!mapped) return;

  await prisma.message.updateMany({
    where: { waMessageId },
    data: { status: mapped, error: errorMessage ?? null },
  });
}
