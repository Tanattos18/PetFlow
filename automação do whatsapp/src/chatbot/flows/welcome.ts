export interface FlowNode {
  id: string;
  message: string;
  options?: Array<{ label: string; next: string }>;
  next?: string;
  input?: { saveAs: string; next: string };
  action?: "end" | "handoff";
}

export interface FlowDefinition {
  start: string;
  nodes: Record<string, FlowNode>;
}

export interface WelcomeFlow {
  key: string;
  name: string;
  definition: FlowDefinition;
}

export const welcomeFlow: WelcomeFlow = {
  key: "petshop_welcome",
  name: "Boas-vindas PetShop",
  definition: {
    start: "greeting",
    nodes: {
      greeting: {
        id: "greeting",
        message:
          "Oi! Aqui e a Pet Shop Amigo Fiel 🐾\nComo posso ajudar?\n\n1 - Agendar banho e tosa\n2 - Comprar racoes e acessorios\n3 - Falar com um atendente",
        options: [
          { label: "1", next: "schedule" },
          { label: "2", next: "shop" },
          { label: "3", next: "handoff" },
        ],
      },
      schedule: {
        id: "schedule",
        message: "Otimo! Qual o nome do seu pet?",
        input: { saveAs: "petName", next: "schedule_done" },
      },
      schedule_done: {
        id: "schedule_done",
        message: "Anotado! Em breve nosso time confirma o horario com voce. Obrigado!",
        action: "end",
      },
      shop: {
        id: "shop",
        message: "Nossos produtos:\n- Racao premium 15kg\n- Areia higienica\n- Brinquedos\n\nResponda SAIR para encerrar.",
        options: [{ label: "SAIR", next: "bye" }],
      },
      bye: {
        id: "bye",
        message: "Qualquer coisa e so chamar. Bem-vindo(a)!",
        action: "end",
      },
      handoff: {
        id: "handoff",
        message: "Certo, vou chamar um atendente. Ja ja alguem responde por aqui!",
        action: "handoff",
      },
    },
  },
};
