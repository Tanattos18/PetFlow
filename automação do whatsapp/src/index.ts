import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { startWorker } from "./queue/worker";

const app = createApp();
const worker = startWorker();

const server = app.listen(env.PORT, () => {
  logger.info(`servidor rodando em http://localhost:${env.PORT}`);
  logger.info(`webhook: ${env.APP_BASE_URL}/webhooks/whatsapp`);
});

function shutdown() {
  logger.info("encerrando...");
  worker.close();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
