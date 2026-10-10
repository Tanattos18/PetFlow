import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  AUTH_COOKIE_NAME: z.string().default("petflow_session"),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  AUTH_COOKIE_SECURE: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().nonnegative().default(5),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(15 * 60 * 1000),
  // Redefinição de senha pelo painel (/redefinir-senha) — desabilitada por
  // padrão; habilitar apenas em ambiente local/controllado (sem verificação
  // por token de e-mail nesta versão)
  PASSWORD_RESET_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  APP_ORIGINS: z.string().default("http://localhost:3000"),
  // WhatsApp (Etapa 6) — segredos somente aqui, nunca no frontend/Git
  WHATSAPP_PROVIDER: z.enum(["mock", "meta"]).default("mock"),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default("v21.0"),
  WHATSAPP_COUNTRY_CODE: z.string().regex(/^\d{1,3}$/, "Código do país inválido").default("55"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Configuração da API inválida:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const allowedOrigins = env.APP_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
