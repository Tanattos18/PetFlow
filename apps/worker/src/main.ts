import { PrismaClient } from "@prisma/client";
import { createWhatsAppProvider } from "@petflow/whatsapp";
import { workerEnv } from "./env";
import { processDueMessages } from "./whatsapp/processor";

const HEARTBEAT_INTERVAL_MS = 60_000;

function log(message: string) {
  console.log(`[petflow-worker] ${new Date().toISOString()} ${message}`);
}

async function main() {
  const prisma = new PrismaClient();

  let provider;
  try {
    provider = createWhatsAppProvider({
      provider: workerEnv.WHATSAPP_PROVIDER,
      accessToken: workerEnv.WHATSAPP_ACCESS_TOKEN,
      apiVersion: workerEnv.WHATSAPP_API_VERSION,
    });
  } catch (error) {
    log(
      `falha ao criar o provedor: ${error instanceof Error ? error.message : "erro desconhecido"}`,
    );
    process.exit(1);
  }

  log(
    `worker iniciado (fila WhatsApp, provedor=${provider.name}, poll=${workerEnv.WORKER_POLL_INTERVAL_MS}ms, máx=${workerEnv.WHATSAPP_SEND_MAX_PER_CYCLE}/ciclo, intervalo=${workerEnv.WHATSAPP_SEND_INTERVAL_MS}ms)`,
  );

  let running = false;

  const cycle = async () => {
    if (running) return;
    running = true;
    try {
      const result = await processDueMessages({
        prisma,
        provider,
        maxPerCycle: workerEnv.WHATSAPP_SEND_MAX_PER_CYCLE,
        intervalMs: workerEnv.WHATSAPP_SEND_INTERVAL_MS,
      });
      if (result.claimed > 0) {
        log(
          `ciclo: devidas=${result.due} reivindicadas=${result.claimed} aceitas=${result.accepted} reagendadas=${result.retried} falhas=${result.failed} canceladas=${result.cancelled}`,
        );
      }
    } catch (error) {
      log(`erro no ciclo: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    } finally {
      running = false;
    }
  };

  const poll = setInterval(() => void cycle(), workerEnv.WORKER_POLL_INTERVAL_MS);
  const heartbeat = setInterval(() => log("heartbeat"), HEARTBEAT_INTERVAL_MS);

  const shutdown = async (signal: string) => {
    log(`sinal ${signal} recebido, encerrando`);
    clearInterval(poll);
    clearInterval(heartbeat);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await cycle();
}

main().catch((error) => {
  log(`falha ao iniciar: ${error instanceof Error ? error.message : "erro desconhecido"}`);
  process.exit(1);
});
