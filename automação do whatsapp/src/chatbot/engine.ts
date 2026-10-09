import { prisma } from "../db/client";
import { logger } from "../config/logger";
import { env } from "../config/env";
import { welcomeFlow, type FlowDefinition } from "./flows/welcome";

interface BotReply {
  reply: string;
  handoff?: boolean;
  ended?: boolean;
}

const builtinFlows: Record<string, FlowDefinition> = {
  [welcomeFlow.key]: welcomeFlow.definition,
};

async function loadFlow(key: string): Promise<FlowDefinition | null> {
  const stored = await prisma.flow.findUnique({ where: { key } });
  if (stored && stored.active) return stored.definition as unknown as FlowDefinition;
  return builtinFlows[key] ?? null;
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function matchOption(nodeKeyOptions: FlowDefinition["nodes"][string]["options"], text: string) {
  if (!nodeKeyOptions) return undefined;
  const clean = normalize(text);
  return nodeKeyOptions.find((o) => o.label.toLowerCase() === clean);
}

export async function runChatbot(contactId: string, incomingText: string): Promise<BotReply | null> {
  if (!env.CHATBOT_ENABLED) return null;

  const flowKey = env.CHATBOT_WELCOME_FLOW;
  const flow = await loadFlow(flowKey);
  if (!flow) return null;

  let state = await prisma.chatbotState.findUnique({
    where: { contactId_flowKey: { contactId, flowKey } },
  });

  if (!state || !state.active) {
    state = await prisma.chatbotState.upsert({
      where: { contactId_flowKey: { contactId, flowKey } },
      update: { currentNode: flow.start, active: true, context: {} },
      create: { contactId, flowKey, currentNode: flow.start, context: {} },
    });
  }

  const currentNode = flow.nodes[state.currentNode];
  if (!currentNode) {
    await prisma.chatbotState.update({
      where: { id: state.id },
      data: { active: false },
    });
    return null;
  }

  const context = (state.context ?? {}) as Record<string, string>;
  let nextId: string | null = null;
  let handoff = false;
  let ended = false;
  let replyText: string | null = null;

  if (state.currentNode === flow.start && !context.__started) {
    replyText = currentNode.message;
    nextId = currentNode.options ? currentNode.id : (currentNode.input?.next ?? currentNode.next ?? null);
    context.__started = "1";
    if (currentNode.options) nextId = currentNode.id;
  } else {
    const option = matchOption(currentNode.options, incomingText);
    if (currentNode.input) {
      context[currentNode.input.saveAs] = incomingText;
      nextId = currentNode.input.next;
      replyText = flow.nodes[nextId]?.message ?? null;
    } else if (option) {
      nextId = option.next;
      replyText = flow.nodes[nextId]?.message ?? null;
    } else if (currentNode.next) {
      nextId = currentNode.next;
      replyText = flow.nodes[nextId]?.message ?? null;
    } else {
      replyText = "Nao entendi. Responda com uma das opcoes listadas.";
      nextId = currentNode.id;
    }
  }

  if (nextId) {
    const target = flow.nodes[nextId];
    if (target?.action === "end") ended = true;
    if (target?.action === "handoff") handoff = true;
    await prisma.chatbotState.update({
      where: { id: state.id },
      data: {
        currentNode: nextId,
        context,
        active: !ended && !handoff,
        updatedAt: new Date(),
      },
    });
  }

  if (ended) {
    await prisma.chatbotState.update({ where: { id: state.id }, data: { active: false } });
  }

  logger.debug({ contactId, nextId, handoff, ended }, "chatbot executado");

  return replyText ? { reply: replyText, handoff, ended } : null;
}
