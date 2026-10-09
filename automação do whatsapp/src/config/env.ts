import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  WA_PHONE_NUMBER_ID: z.string().min(1),
  WA_TOKEN: z.string().min(1),
  WA_BUSINESS_ACCOUNT_ID: z.string().min(1),
  WA_VERIFY_TOKEN: z.string().min(1),
  WA_APP_SECRET: z.string().optional(),
  APP_BASE_URL: z.string().url(),
  CHATBOT_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  CHATBOT_WELCOME_FLOW: z.string().default("petshop_welcome"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Configuracao invalida:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
