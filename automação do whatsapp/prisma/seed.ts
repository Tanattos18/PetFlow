import { PrismaClient } from "@prisma/client";
import { welcomeFlow } from "../src/chatbot/flows/welcome";

const prisma = new PrismaClient();

async function main() {
  await prisma.flow.upsert({
    where: { key: welcomeFlow.key },
    update: { name: welcomeFlow.name, definition: welcomeFlow.definition as never },
    create: {
      key: welcomeFlow.key,
      name: welcomeFlow.name,
      definition: welcomeFlow.definition as never,
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
