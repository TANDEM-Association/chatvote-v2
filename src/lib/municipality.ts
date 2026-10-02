// 5 chiffres, ou format corse (2A/2B + 3 chiffres).
const MUNICIPALITY_CODE_RE = /^(\d{5}|2[AB]\d{3})$/;

export function isValidMunicipalityCode(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && MUNICIPALITY_CODE_RE.test(value);
}

/** Code demandé s'il est valide, sinon le code par défaut. */
export function resolveMunicipalityCode(
  requested: string | null | undefined,
  fallback: string,
): string {
  return isValidMunicipalityCode(requested) ? requested : fallback;
}
