import type { PrismaClient } from "@prisma/client";
import {
  WhatsAppProviderError,
  nextBackoffMs,
  type WhatsAppProvider,
} from "@petflow/whatsapp";

export interface ProcessorDeps {
  prisma: PrismaClient;
  provider: WhatsAppProvider;
  /** Limite de envios por ciclo (rate limit). */
  maxPerCycle?: number;
  /** Pausa entre envios dentro de um ciclo (evita rajadas). */
  intervalMs?: number;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

export interface CycleResult {
  due: number;
  claimed: number;
  accepted: number;
  retried: number;
  failed: number;
  cancelled: number;
}

const emptyResult = (): CycleResult => ({
  due: 0,
  claimed: 0,
  accepted: 0,
  retried: 0,
  failed: 0,
  cancelled: 0,
});

function errorMessage(error: unknown): { code: string; message: string; httpStatus?: number } {
  if (error instanceof WhatsAppProviderError) {
    return {
      code: error.code ?? "PROVIDER_ERROR",
      message: error.message.slice(0, 300),
      httpStatus: error.httpStatus,
    };
  }
  const message = error instanceof Error ? error.message : "Erro inesperado no envio";
  return { code: "UNEXPECTED", message: message.slice(0, 300) };
}

function isTransient(error: unknown): boolean {
  return error instanceof WhatsAppProviderError && error.kind === "TRANSIENT";
}

/**
 * Processa a fila persistente de mensagens (WhatsAppMessage).
 *
 * Máquina de estados:
 * - PENDING → claim atômico (updateMany condicional) → PROCESSING;
 * - provedor aceitou → ACCEPTED (nunca DELIVERED: entrega só via webhook);
 * - erro transitório → tentativa registrada e retorno a PENDING com backoff
 *   (limitado por maxAttempts);
 * - erro permanente ou tentativas esgotadas → FAILED;
 * - consentimento revogado/integração indisponível entre o enqueue e o
 *   envio → CANCELLED (nada sai para quem descadastrou).
 */
export async function processDueMessages(deps: ProcessorDeps): Promise<CycleResult> {
  const result = emptyResult();
  const now = deps.now?.() ?? new Date();
  const maxPerCycle = deps.maxPerCycle ?? 20;
  const intervalMs = deps.intervalMs ?? 250;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const due = await deps.prisma.whatsAppMessage.findMany({
    where: {
      status: "PENDING",
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: maxPerCycle,
  });
  result.due = due.length;

  const configCache = new Map<
    string,
    { phoneNumberId: string | null; status: string } | null
  >();

  for (const candidate of due) {
    const claim = await deps.prisma.whatsAppMessage.updateMany({
      where: { id: candidate.id, status: "PENDING" },
      data: { status: "PROCESSING" },
    });
    if (claim.count !== 1) continue; // outro worker venceu a corrida
    result.claimed += 1;

    const message = await deps.prisma.whatsAppMessage.findUnique({
      where: { id: candidate.id },
      include: { consent: { select: { status: true } } },
    });
    if (!message || message.status !== "PROCESSING") continue;

    let config = configCache.get(message.companyId);
    if (config === undefined) {
      config = await deps.prisma.whatsAppConfig.findUnique({
        where: { companyId: message.companyId },
        select: { phoneNumberId: true, status: true },
      });
      configCache.set(message.companyId, config);
    }

    const blocked =
      !config || config.status === "DISCONNECTED" || !config.phoneNumberId
        ? "Integração indisponível ou desconectada"
        : message.consent?.status === "OPTED_OUT"
          ? "Cliente realizou descadastro após o enfileiramento"
          : null;

    if (blocked) {
      await deps.prisma.whatsAppMessage.update({
        where: { id: message.id },
        data: {
          status: "CANCELLED",
          cancelReason: blocked,
          nextAttemptAt: null,
        },
      });
      result.cancelled += 1;
      continue;
    }

    const attemptNumber = message.attempts + 1;
    const startedAt = deps.now?.() ?? new Date();

    try {
      const sent = await deps.provider.sendTemplate({
        phoneNumberId: config!.phoneNumberId!,
        to: message.toPhone,
        templateName: message.templateNameSnapshot,
        language: message.templateLanguageSnapshot,
        variables: (message.variables as string[] | null) ?? [],
      });

      await deps.prisma.$transaction([
        deps.prisma.whatsAppMessageAttempt.create({
          data: {
            messageId: message.id,
            attemptNumber,
            outcome: "ACCEPTED",
            providerMessageId: sent.providerMessageId,
            startedAt,
            finishedAt: deps.now?.() ?? new Date(),
          },
        }),
        deps.prisma.whatsAppMessage.update({
          where: { id: message.id },
          data: {
            status: "ACCEPTED",
            attempts: attemptNumber,
            providerMessageId: sent.providerMessageId,
            lastAttemptAt: deps.now?.() ?? new Date(),
            nextAttemptAt: null,
            failureReason: null,
            failureDetail: null,
          },
        }),
      ]);
      result.accepted += 1;
    } catch (error) {
      const info = errorMessage(error);
      const transient = isTransient(error);
      const exhausted = attemptNumber >= message.maxAttempts;
      const willRetry = transient && !exhausted;

      await deps.prisma.$transaction([
        deps.prisma.whatsAppMessageAttempt.create({
          data: {
            messageId: message.id,
            attemptNumber,
            outcome: transient ? "TRANSIENT_ERROR" : "PERMANENT_ERROR",
            errorCode: info.code,
            errorMessage: info.message,
            httpStatus: info.httpStatus ?? null,
            startedAt,
            finishedAt: deps.now?.() ?? new Date(),
          },
        }),
        deps.prisma.whatsAppMessage.update({
          where: { id: message.id },
          data: {
            attempts: attemptNumber,
            lastAttemptAt: deps.now?.() ?? new Date(),
            ...(willRetry
              ? {
                  status: "PENDING" as const,
                  nextAttemptAt: new Date(
                    (deps.now?.() ?? new Date()).getTime() +
                      nextBackoffMs(attemptNumber),
                  ),
                }
              : {
                  status: "FAILED" as const,
                  nextAttemptAt: null,
                  failureReason: info.code,
                  failureDetail: info.message,
                }),
          },
        }),
      ]);

      if (willRetry) result.retried += 1;
      else result.failed += 1;
    }

    if (intervalMs > 0) await sleep(intervalMs);
  }

  return result;
}
