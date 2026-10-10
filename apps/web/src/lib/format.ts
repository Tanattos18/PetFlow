export function formatBrl(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayUtc(): string {
  return isoDay(new Date());
}

export function daysAgoUtc(days: number): string {
  return isoDay(new Date(Date.now() - days * 86_400_000));
}

// ---------------------------------------------------------------------------
// Etapa 8 — agendamentos (datas locais do navegador, sem passar por UTC)
// ---------------------------------------------------------------------------

/** Dia local (YYYY-MM-DD) no fuso do navegador. */
export function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayLocal(): string {
  return localDayKey(new Date());
}

/** Soma dias a uma chave de dia local (meio-dia para não sofrer com DST). */
export function shiftDay(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  return localDayKey(new Date(year, month - 1, day + days, 12));
}

export function formatDayTitle(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** "startLocal" (hora de parede) → "10:30". */
export function formatLocalTime(startLocal: string): string {
  return startLocal.slice(11, 16);
}

/** "startLocal" → "10/10/2026". */
export function formatLocalDateShort(startLocal: string): string {
  const [year, month, day] = startLocal.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

/** Valor padrão para datetime-local: amanhã às 09:00 (hora local). */
export function defaultStartLocal(): string {
  return `${localDayKey(new Date(Date.now() + 86_400_000))}T09:00`;
}
