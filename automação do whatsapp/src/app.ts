import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "path";
import { logger } from "./config/logger";
import { webhookRouter } from "./routes/webhook.routes";
import { apiRouter } from "./routes/api.routes";

export function createApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(pinoHttp({ logger }));

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      },
    }),
  );

  app.use("/webhooks", webhookRouter);
  app.use("/api", apiRouter);

  app.use(express.static(path.join(__dirname, "..", "web")));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, "erro nao tratado");
    res.status(500).json({ error: "erro interno" });
  });

  return app;
}
