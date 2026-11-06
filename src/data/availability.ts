// Communes et institutions ouvertes dans ChatVote.
//
// Une commune absente de cette liste affiche la page « pas encore disponible »,
// sans widget Zaq. Ouvrir une commune = ajouter son code INSEE ici, puis
// redéployer. Un test vérifie que chaque code existe dans le snapshot.

/** Codes INSEE des communes ouvertes. */
export const AVAILABLE_COMMUNES: readonly string[] = [
  "63396", // Saint-Saturnin (Puy-de-Dôme)
];

/** Identifiants (SIREN) des institutions ouvertes, ex. des EPCI. Aucune pour l'instant. */
export const AVAILABLE_INSTITUTIONS: readonly string[] = [];

const availableCommunes = new Set(AVAILABLE_COMMUNES);
const availableInstitutions = new Set(AVAILABLE_INSTITUTIONS);

export function isCommuneAvailable(code: string): boolean {
  return availableCommunes.has(code);
}

export function isInstitutionAvailable(siren: string): boolean {
  return availableInstitutions.has(siren);
}
