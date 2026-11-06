// Contexte transmis au chat via `updateContext({ prompt_context })`. Zaq ne
// l'applique qu'à la première question d'une nouvelle conversation.
//
// Toutes les valeurs viennent de NOS données (snapshot des communes), jamais
// directement de l'URL : le code de l'URL ne sert qu'à retrouver la commune.

import type { Commune } from "./communes-index";

/** Au-delà, la liste de codes postaux ne désigne plus la commune (Paris : 21) : on donne le département. */
const MAX_POSTAL_CODES = 3;

function joinWithAnd(values: readonly string[]): string {
  if (values.length <= 1) return values.join("");
  return `${values.slice(0, -1).join(", ")} et ${values.at(-1)}`;
}

export function buildPromptContext(
  commune: Pick<Commune, "name" | "postalCodes" | "departmentName">,
): string {
  const intro = `Je vais te poser des questions sur la ville de ${commune.name}`;
  const { postalCodes } = commune;
  if (postalCodes.length === 1) {
    return `${intro} dont le code postal est ${postalCodes[0]}`;
  }
  if (postalCodes.length >= 2 && postalCodes.length <= MAX_POSTAL_CODES) {
    return `${intro} dont les codes postaux sont ${joinWithAnd(postalCodes)}`;
  }
  // Plus de trois codes postaux, ou aucun : le département lève l'ambiguïté
  // (il existe plusieurs « Saint-Saturnin »).
  return `${intro} (département : ${commune.departmentName})`;
}
