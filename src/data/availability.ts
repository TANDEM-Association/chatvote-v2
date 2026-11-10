// Statut des communes et institutions dans ChatVote.
//
// Seul `available` affiche le widget Zaq. Les trois autres statuts affichent
// la page « pas encore disponible » (sans script Zaq) avec un texte propre.
// Une commune absente de la table est `unfunded`. Changer le statut d'une
// commune = modifier son code INSEE ici, puis redéployer. Un test vérifie que
// chaque code existe dans le snapshot.
//
// Ce fichier est embarqué dans le bundle navigateur (recherche) : il est
// public, n'y mettre aucune donnée financière.

export type CommuneStatus =
  /** Ouverte : widget Zaq. */
  | "available"
  /** Non disponible, non financée. */
  | "unfunded"
  /** Non disponible, financement partiel. */
  | "partially-funded"
  /** Non disponible, financée : l'ajout est en cours. */
  | "funded";

/** Codes INSEE des communes dont le statut n'est pas `unfunded`. */
export const COMMUNE_STATUSES: Readonly<Record<string, CommuneStatus>> = {
  "63396": "available", // Saint-Saturnin (Puy-de-Dôme)

  // Financées (250 € payés), en cours d'ajout
  "71309": "funded", // Montcenis (Saône-et-Loire)
  "85163": "funded", // Noirmoutier-en-l'Île (Vendée)
  "22353": "funded", // Trégastel (Côtes-d'Armor)

  // Validées, financement en cours
  "58140": "partially-funded", // Larochemillay (Nièvre)
  "85277": "partially-funded", // Saint-Vincent-sur-Graon (Vendée)
  "83126": "partially-funded", // La Seyne-sur-Mer (Var)
  "27681": "partially-funded", // Vernon (Eure)
  "83009": "partially-funded", // Bandol (Var)
};

/** Identifiants (SIREN) des institutions ouvertes, ex. des EPCI. Aucune pour l'instant. */
export const AVAILABLE_INSTITUTIONS: readonly string[] = [];

const availableInstitutions = new Set(AVAILABLE_INSTITUTIONS);

export function getCommuneStatus(code: string): CommuneStatus {
  // Object.hasOwn : « constructor » ou « __proto__ » ne sont pas des statuts.
  return Object.hasOwn(COMMUNE_STATUSES, code)
    ? (COMMUNE_STATUSES[code] as CommuneStatus)
    : "unfunded";
}

export function isCommuneAvailable(code: string): boolean {
  return getCommuneStatus(code) === "available";
}

export function isInstitutionAvailable(siren: string): boolean {
  return availableInstitutions.has(siren);
}
