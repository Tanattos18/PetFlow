import "dotenv/config";

const base = process.env.DATABASE_URL;

if (!base) {
  console.error("DATABASE_URL ausente no ambiente para os testes.");
  process.exit(1);
}

export function testDatabaseUrl(): string {
  return base.replace(
    /(postgresql:\/\/[^/]+\/)([^?]+)([\s\S]*)$/,
    "$1petflow_test$3",
  );
}

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = testDatabaseUrl();
process.env.AUTH_COOKIE_SECURE = "false";
