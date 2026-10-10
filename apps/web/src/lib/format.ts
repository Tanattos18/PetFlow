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
