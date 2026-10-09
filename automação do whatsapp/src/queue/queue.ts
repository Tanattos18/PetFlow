import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env";
import { logger } from "../config/logger";

export const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export interface SendJobData {
  contactPhone: string;
  content: string;
  flowKey?: string;
  conversationId?: string;
  attempts?: number;
}

export const sendQueue = new Queue<SendJobData>("whatsapp-send", { connection });

export async function enqueueSend(data: SendJobData, delayMs = 0): Promise<void> {
  await sendQueue.add("send-text", data, {
    delay: delayMs,
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
}

export type SendJobHandler = (job: Job<SendJobData>) => Promise<void>;

export function createSendWorker(handler: SendJobHandler): Worker<SendJobData> {
  const worker = new Worker<SendJobData>("whatsapp-send", handler, {
    connection,
    concurrency: 5,
  });

  worker.on("completed", (job) => logger.debug({ jobId: job.id }, "job concluido"));
  worker.on("failed", (job, err) => logger.error({ jobId: job?.id, err: err.message }, "job falhou"));

  return worker;
}
