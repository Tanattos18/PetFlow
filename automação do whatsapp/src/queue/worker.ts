import { createSendWorker, type SendJobData } from "./queue";
import { logger } from "../config/logger";
import { prisma } from "../db/client";
import * as graphApi from "../whatsapp/graphApi";

async function handleSendJob(job: { data: SendJobData }): Promise<void> {
  const { contactPhone, content } = job.data;

  const result = await graphApi.sendText(contactPhone, content);

  const contact = await prisma.contact.findUnique({ where: { phone: contactPhone } });
  if (contact) {
    await prisma.message.create({
      data: {
        contactId: contact.id,
        conversationId: job.data.conversationId,
        direction: "OUTBOUND",
        type: "text",
        content,
        waMessageId: result.waMessageId,
        status: "SENT",
      },
    });
  }
}

export function startWorker() {
  const worker = createSendWorker(async (job) => {
    try {
      await handleSendJob(job);
    } catch (err) {
      logger.error({ jobId: job.id, err }, "worker: falha ao processar envio");
      throw err;
    }
  });

  logger.info("worker de envio iniciado");
  return worker;
}

if (require.main === module) {
  startWorker();
}
