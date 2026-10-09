import "dotenv/config";
import { execSync } from "node:child_process";

export async function setup(): Promise<void> {
  process.env.NODE_ENV = "test";

  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error("DATABASE_URL ausente no ambiente para os testes.");
  }

  const testUrl = base.replace(
    /(postgresql:\/\/[^/]+\/)([^?]+)([\s\S]*)$/,
    "$1petflow_test$3",
  );

  process.env.DATABASE_URL = testUrl;

  execSync("npx prisma migrate deploy --schema database/prisma/schema.prisma", {
    stdio: "inherit",
    env: process.env,
  });

  console.log(`Banco de teste pronto: ${testUrl.replace(/:[^:@/]+@/, ":***@")}`);
}
