export interface PhoneNormalizationOptions {
  countryCode?: string;
}

/**
 * Normaliza um telefone para E.164 (apenas dígitos, sem "+").
 *
 * Regras (documentadas em docs/architecture/API.md):
 * - descarta tudo que não for dígito e remove um "0" de tronco quando couber;
 * - 10–11 dígitos (DDD + número) recebem o código do país (padrão 55);
 * - 12+ dígitos são considerados internacionais e mantidos;
 * - menos de 10 ou mais de 15 dígitos resultam em null (não enviável).
 */
export function toE164(raw: string, countryCode = "55"): string | null {
  const digits = (raw ?? "").replace(/\D+/g, "");
  if (!digits) return null;

  let value = digits;
  if (value.startsWith("0") && value.length >= 10) {
    value = value.slice(1);
  }

  if (value.length < 10 || value.length > 15) return null;

  if (value.length === 10 || value.length === 11) {
    const withCountry = `${countryCode}${value}`;
    return withCountry.length <= 15 ? withCountry : null;
  }

  return value;
}

export function isE164(value: string): boolean {
  return /^\d{10,15}$/.test(value);
}
