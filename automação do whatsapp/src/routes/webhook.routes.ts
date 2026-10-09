import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { verifyWebhook, verifySignature, parseInboundMessages, parseStatusUpdates } from "../whatsapp/webhook.service";
import { handleInbound, handleStatus } from "../services/inbound.service";
import { logger } from "../config/logger";
import type { WebhookPayload } from "../whatsapp/types";

export const webhookRouter = Router();

webhookRouter.get("/whatsapp", (req: Request, res: Response) => {
  const challenge = verifyWebhook(req.query as Record<string, string | undefined>);
  if (challenge === null) {
    res.status(403).json({ error: "token invalido" });
    return;
  }
  res.status(200).type("text/plain").send(challenge);
});

webhookRouter.post(
  "/whatsapp",
  async (req: Request, res: Response) => {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const signature = req.header("x-hub-signature-256");

    if (rawBody && !verifySignature(rawBody, signature)) {
      logger.warn("assinatura do webhook invalida");
      res.status(401).json({ error: "assinatura invalida" });
      return;
    }

    res.status(200).json({ status: "ok" });

    const payload = req.body as WebhookPayload;

    try {
      const messages = parseInboundMessages(payload);
      const statuses = parseStatusUpdates(payload);

      for (const msg of messages) {
        const contact = payload.entry?.[0]?.changes?.[0]?.value?.contacts?.find(
          (c) => c.wa_id === msg.from,
        );
        await handleInbound(msg, contact?.profile?.name);
      }

      if (statuses.length) await handleStatus(statuses);
    } catch (err) {
      logger.error({ err }, "erro ao processar webhook");
    }
  },
);

const sendSchema = z.object({
  to: z.string().min(8),
  message: z.string().min(1),
  delayMs: z.number().int().min(0).max(86400000).optional(),
});

webhookRouter.post("/send", async (req: Request, res: Response) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  res.status(202).json({ accepted: true });
  logger.info({ to: parsed.data.to }, "envio manual aceito");
});
