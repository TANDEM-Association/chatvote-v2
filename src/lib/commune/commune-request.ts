// Décide de la réponse de la page d'accueil selon `?commune=`. Fonction pure :
// la recherche de la commune et la disponibilité sont injectées (testable sans
// snapshot ni rendu).

import { isValidCommuneCode } from "./commune-code";
import type { Commune } from "./communes-index";
import { buildPromptContext } from "./prompt-context";

/** Commune ouverte quand `?commune=` est absent (V1 : Saint-Saturnin, Puy-de-Dôme). */
export const DEFAULT_COMMUNE_CODE = "63396";

export interface CommuneRequestDeps {
  find(code: string): Commune | undefined;
  isAvailable(code: string): boolean;
}

export type CommuneRequest =
  /** Format invalide : on repart de l'accueil, la valeur n'est jamais affichée. */
  | { kind: "redirect"; location: "/" }
  /** Format valide mais code inconnu : 404. */
  | { kind: "not-found" }
  /** Commune connue mais pas ouverte : page dédiée, sans widget Zaq. */
  | { kind: "unavailable"; commune: Commune }
  /** Commune ouverte : le chat, avec ce `prompt_context`. */
  | { kind: "available"; commune: Commune; promptContext: string };

export function resolveCommuneRequest(
  param: string | null,
  deps: CommuneRequestDeps,
): CommuneRequest {
  const code = param ?? DEFAULT_COMMUNE_CODE;
  if (!isValidCommuneCode(code)) {
    return { kind: "redirect", location: "/" };
  }
  const commune = deps.find(code);
  if (!commune) {
    return { kind: "not-found" };
  }
  if (!deps.isAvailable(code)) {
    return { kind: "unavailable", commune };
  }
  return {
    kind: "available",
    commune,
    promptContext: buildPromptContext(commune),
  };
}
