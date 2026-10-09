import "dotenv/config";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { normalizeEmail } from "@petflow/shared";

const BCRYPT_ROUNDS = 12;

const schema = z.object({
  BOOTSTRAP_COMPANY_NAME: z.string().trim().min(2),
  BOOTSTRAP_COMPANY_SLUG: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug deve conter apenas letras minúsculas, números e hífens")
    .optional(),
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(2),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().transform(normalizeEmail),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(72),
});

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    console.error("Bootstrap inválido. Variáveis ausentes ou inválidas:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    console.error(`
Variáveis obrigatórias:
  BOOTSTRAP_COMPANY_NAME   Nome da empresa (ex.: "Pet Shop Amigo Fiel")
  BOOTSTRAP_ADMIN_NAME     Nome do administrador
  BOOTSTRAP_ADMIN_EMAIL    Email do administrador
  BOOTSTRAP_ADMIN_PASSWORD Senha forte (min. 12 caracteres)
Opcionais:
  BOOTSTRAP_COMPANY_SLUG   Slug da empresa (padrão: gerado do nome)

Exemplo de execução (PowerShell):
  $env:BOOTSTRAP_COMPANY_NAME="Pet Shop Amigo Fiel"
  $env:BOOTSTRAP_ADMIN_NAME="Dono"
  $env:BOOTSTRAP_ADMIN_EMAIL="dono@exemplo.com"
  $env:BOOTSTRAP_ADMIN_PASSWORD="senha-forte-aqui"
  npm run bootstrap:admin`);
    process.exit(1);
  }

  const { BOOTSTRAP_COMPANY_NAME, BOOTSTRAP_COMPANY_SLUG, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD } = parsed.data;

  const prisma = new PrismaClient();
  const slug = BOOTSTRAP_COMPANY_SLUG ?? slugify(BOOTSTRAP_COMPANY_NAME);

  try {
    let company = await prisma.company.findUnique({ where: { slug } });
    let companyCreated = false;

    if (!company) {
      company = await prisma.company.create({
        data: { name: BOOTSTRAP_COMPANY_NAME, slug },
      });
      companyCreated = true;
      console.log(`Empresa criada: ${company.name} (slug: ${company.slug})`);
    } else {
      console.log(`Empresa já existente: ${company.name} (slug: ${company.slug}) — nada foi alterado.`);
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        companyId_email: { companyId: company.id, email: BOOTSTRAP_ADMIN_EMAIL },
      },
    });

    if (existingUser) {
      console.log(
        `Usuário administrador já existente: ${existingUser.email} (role: ${existingUser.role}, status: ${existingUser.status}) — senha NÃO foi alterada.`,
      );
      console.log("Bootstrap concluído (idempotente).");
      return;
    }

    const passwordHash = await bcrypt.hash(BOOTSTRAP_ADMIN_PASSWORD, BCRYPT_ROUNDS);
    const admin = await prisma.user.create({
      data: {
        companyId: company.id,
        name: BOOTSTRAP_ADMIN_NAME,
        email: BOOTSTRAP_ADMIN_EMAIL,
        passwordHash,
        role: "ADMIN",
      },
    });

    console.log(`Administrador criado: ${admin.email} na empresa ${company.name}.`);
    console.log(`Empresa criada nesta execução: ${companyCreated ? "sim" : "não"}`);
    console.log("Próximo passo: faça login em http://localhost:3000/login");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Falha no bootstrap:");
  console.error(error);
  process.exit(1);
});
