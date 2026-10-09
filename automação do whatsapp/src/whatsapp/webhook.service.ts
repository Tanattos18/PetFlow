import crypto from "crypto";
import { env } from "../config/env";
import { logger } from "../config/logger";
import type { InboundMessage, StatusUpdate, WebhookPayload } from "./types";

export function verifyWebhook(query: {
  "hub.mode"?: string;
  "hub.verify_token"?: string;
  "hub.challenge"?: string;
}): string | null {
  if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === env.WA_VERIFY_TOKEN) {
    return query["hub.challenge"] ?? "";
  }
  return null;
}

export function verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!env.WA_APP_SECRET) return true;
  if (!signature?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", env.WA_APP_SECRET).update(rawBody).digest("hex");
  const received = signature.slice("sha256=".length);
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function parseInboundMessages(payload: WebhookPayload): InboundMessage[] {
  const result: InboundMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      for (const msg of change.value.messages ?? []) {
        const base = { waMessageId: msg.id, from: msg.from, timestamp: msg.timestamp };

        if (msg.type === "text" && msg.text) {
          result.push({ ...base, type: "text", text: msg.text.body });
          continue;
        }

        const media = msg.image ?? msg.document ?? msg.audio ?? msg.video ?? msg.sticker;
        if (media) {
          result.push({
            ...base,
            type: msg.type,
            mediaId: media.id,
            mimeType: media.mime_type,
            caption: (media as { caption?: string }).caption ?? undefined,
          });
          continue;
        }

        if (msg.type === "button" && msg.button) {
          result.push({ ...base, type: "text", text: msg.button.text });
          continue;
        }

        if (msg.type === "interactive") {
          const reply = msg.interactive?.button_reply ?? msg.interactive?.list_reply;
          result.push({ ...base, type: "text", text: reply?.title ?? "" });
          continue;
        }

        if (msg.type === "location" && msg.location) {
          result.push({ ...base, type: "location", text: `${msg.location.latitude},${msg.location.longitude}` });
        }
      }
    }
  }

  return result;
}

export function parseStatusUpdates(payload: WebhookPayload): StatusUpdate[] {
  const result: StatusUpdate[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      for (const status of change.value.statuses ?? []) {
        result.push({
          waMessageId: status.id,
          status: status.status,
          errorMessage: status.errors?.[0]?.message,
        });
      }
    }
  }

  return result;
}

export function logPayload(payload: WebhookPayload): void {
  logger.debug({ object: payload.object }, "webhook recebido");
}
