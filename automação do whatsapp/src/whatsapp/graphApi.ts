import { env } from "../config/env";
import { logger } from "../config/logger";
import type { SendTextResult } from "./types";

const GRAPH_API = "https://graph.facebook.com/v20.0";

export async function sendText(to: string, body: string): Promise<SendTextResult> {
  const res = await fetch(`${GRAPH_API}/${env.WA_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });

  const data = (await res.json()) as { messages?: Array<{ id: string }>; error?: unknown };

  if (!res.ok || data.error) {
    logger.error({ to, error: data.error }, "falha ao enviar mensagem");
    throw new Error(JSON.stringify(data.error ?? res.statusText));
  }

  return { waMessageId: data.messages?.[0]?.id ?? "" };
}

export async function markAsRead(messageId: string): Promise<void> {
  await fetch(`${GRAPH_API}/${env.WA_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
  });
}

export async function sendTemplate(to: string, templateName: string, languageCode = "pt_BR"): Promise<SendTextResult> {
  const res = await fetch(`${GRAPH_API}/${env.WA_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: templateName, language: { code: languageCode } },
    }),
  });

  const data = (await res.json()) as { messages?: Array<{ id: string }>; error?: unknown };
  if (!res.ok || data.error) {
    logger.error({ to, error: data.error }, "falha ao enviar template");
    throw new Error(JSON.stringify(data.error ?? res.statusText));
  }

  return { waMessageId: data.messages?.[0]?.id ?? "" };
}
