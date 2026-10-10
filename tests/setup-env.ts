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
// Redefinição de senha pelo painel: habilitada nos testes
process.env.PASSWORD_RESET_ENABLED = "true";
// Cadastro aberto (/cadastro): habilitado nos testes
process.env.REGISTRATION_ENABLED = "true";
// WhatsApp (Etapa 6): provedor mock + segredos locais conhecidos para os
// testes assinarem os webhooks (nunca valores reais)
process.env.WHATSAPP_PROVIDER = "mock";
process.env.WHATSAPP_VERIFY_TOKEN = "petflow-test-verify-token";
process.env.WHATSAPP_APP_SECRET = "petflow-test-app-secret";
process.env.WHATSAPP_COUNTRY_CODE = "55";
