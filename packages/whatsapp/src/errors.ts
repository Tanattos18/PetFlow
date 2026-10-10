export type ProviderErrorKind = "TRANSIENT" | "PERMANENT";

export class WhatsAppProviderError extends Error {
  constructor(
    message: string,
    public readonly kind: ProviderErrorKind,
    public readonly code?: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "WhatsAppProviderError";
  }
}

/**
 * Classificação de erros HTTP do provedor:
 * - 429 (rate limit), 408 e 5xx → transitórios (retry com backoff);
 * - demais 4xx → permanentes (não repetir).
 * Falhas de rede também são transitórias.
 */
export function classifyHttpStatus(status: number): ProviderErrorKind {
  if (status === 429 || status === 408 || status >= 500) return "TRANSIENT";
  return "PERMANENT";
}

/**
 * Backoff exponencial com teto: 5s, 10s, 20s ... até maxMs.
 * `attempt` é 1-based (primeira retentativa → baseMs).
 */
export function nextBackoffMs(attempt: number, baseMs = 5_000, maxMs = 300_000): number {
  const exponent = Math.max(attempt - 1, 0);
  const delay = baseMs * 2 ** exponent;
  return Math.min(delay, maxMs);
}

const OPT_OUT_KEYWORDS = ["SAIR", "STOP", "CANCELAR", "CANCEL", "DESCADASTRAR"];

/** Texto inbound que indica descadastro (opt-out) do remetente. */
export function isOptOutText(text: string): boolean {
  const normalized = text.trim().replace(/\s+/g, " ").toUpperCase();
  return OPT_OUT_KEYWORDS.includes(normalized);
}
