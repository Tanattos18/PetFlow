import { resolve } from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();
// npm run --workspace executa com cwd no workspace; garante achar o .env da raiz
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: resolve(process.cwd(), "../../.env") });
}

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  WHATSAPP_PROVIDER: z.enum(["mock", "meta"]).default("mock"),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default("v21.0"),
  WHATSAPP_COUNTRY_CODE: z
    .string()
    .regex(/^\d{1,3}$/, "Código do país inválido")
    .default("55"),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(250).default(5000),
  WHATSAPP_SEND_MAX_PER_CYCLE: z.coerce.number().int().min(1).max(500).default(20),
  WHATSAPP_SEND_INTERVAL_MS: z.coerce.number().int().min(0).max(60_000).default(250),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "[petflow-worker] Configuração inválida:",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const workerEnv = parsed.data;
