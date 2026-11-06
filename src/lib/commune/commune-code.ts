// Un code INSEE de commune compte cinq caractères : cinq chiffres (ex. 75056 pour
// Paris) ou « 2A » / « 2B » suivi de trois chiffres pour la Corse (ex. 2A004).
// Tout le reste dans `?commune=` est une entrée non fiable : jamais affichée
// telle quelle, jamais utilisée avant validation.
//
// Écart voulu avec ChatVote, qui valide avec /^\d{5}$/ et rend donc
// inaccessibles les 360 communes corses de son propre snapshot.
export const INSEE_COMMUNE_CODE_REGEX = /^(?:\d{5}|2[AB]\d{3})$/;

export function isValidCommuneCode(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && INSEE_COMMUNE_CODE_REGEX.test(value);
}
