import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../db/client";
import { dispatchText } from "../services/message.service";
import { sendQueue } from "../queue/queue";

export const apiRouter = Router();

apiRouter.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "up" });
  } catch {
    res.status(503).json({ status: "degraded", db: "down" });
  }
});

apiRouter.get("/contacts", async (req: Request, res: Response) => {
  const search = String(req.query.search ?? "");
  const contacts = await prisma.contact.findMany({
    where: search ? { OR: [{ phone: { contains: search } }, { name: { contains: search } }] } : undefined,
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  res.json(contacts);
});

apiRouter.post("/contacts", async (req: Request, res: Response) => {
  const schema = z.object({
    phone: z.string().min(8),
    name: z.string().optional(),
    petName: z.string().optional(),
    tags: z.array(z.string()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const contact = await prisma.contact.upsert({
    where: { phone: parsed.data.phone },
    update: parsed.data,
    create: parsed.data,
  });
  res.status(201).json(contact);
});

apiRouter.get("/conversations", async (_req: Request, res: Response) => {
  const conversations = await prisma.conversation.findMany({
    include: { contact: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  res.json(conversations);
});

apiRouter.get("/conversations/:id/messages", async (req: Request, res: Response) => {
  const messages = await prisma.message.findMany({
    where: { conversationId: req.params.id },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  res.json(messages);
});

apiRouter.post("/conversations/:id/reply", async (req: Request, res: Response) => {
  const schema = z.object({ message: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    include: { contact: true },
  });
  if (!conversation) {
    res.status(404).json({ error: "conversa nao encontrada" });
    return;
  }

  await dispatchText({
    phone: conversation.contact.phone,
    content: parsed.data.message,
    contactId: conversation.contactId,
    conversationId: conversation.id,
  });

  res.status(201).json({ sent: true });
});

apiRouter.post("/messages/broadcast", async (req: Request, res: Response) => {
  const schema = z.object({
    contacts: z.array(z.string()).min(1),
    message: z.string().min(1),
    intervalMs: z.number().int().min(1000).max(60000).default(3000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { contacts, message, intervalMs } = parsed.data;
  for (let i = 0; i < contacts.length; i++) {
    const contact = await prisma.contact.findUnique({ where: { phone: contacts[i] } });
    if (!contact || contact.optedOut) continue;
    await dispatchText({
      phone: contact.phone,
      content: message,
      contactId: contact.id,
      delayMs: i * intervalMs,
    });
  }

  res.status(202).json({ queued: contacts.length });
});

apiRouter.get("/flows", async (_req: Request, res: Response) => {
  const flows = await prisma.flow.findMany({ orderBy: { createdAt: "desc" } });
  res.json(flows);
});

apiRouter.post("/flows", async (req: Request, res: Response) => {
  const schema = z.object({
    key: z.string().min(1),
    name: z.string().min(1),
    definition: z.record(z.unknown()),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const flow = await prisma.flow.upsert({
    where: { key: parsed.data.key },
    update: { name: parsed.data.name, definition: parsed.data.definition as never },
    create: { key: parsed.data.key, name: parsed.data.name, definition: parsed.data.definition as never },
  });
  res.status(201).json(flow);
});

apiRouter.get("/queue/stats", async (_req: Request, res: Response) => {
  const [waiting, active, completed, failed] = await Promise.all([
    sendQueue.getWaitingCount(),
    sendQueue.getActiveCount(),
    sendQueue.getCompletedCount(),
    sendQueue.getFailedCount(),
  ]);
  res.json({ waiting, active, completed, failed });
});
