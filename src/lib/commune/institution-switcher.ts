// Logique de la pastille de commune, sans framework.
// `resolveInstitutionId` remplace les deux `useEffect` de l'app d'origine
// (valeur par défaut et institution périmée).

import { INSTITUTION_TYPE_LABELS } from "./institution-labels";

// Intercommunalités (EPCI). `conseil_municipal` est le conseil de la commune
// elle-même, vue par défaut : il n'est pas répété ici.
export const EPCI_TYPES = new Set([
  "communaute_de_communes",
  "agglomeration",
  "syndicat",
  "communaute_urbaine",
  "metropole",
]);

export interface SwitcherInstitution {
  institutionId: string;
  institutionName: string;
  institutionType: string;
}

export interface SwitcherTriggerDisplay {
  isEpci: boolean;
  label: string;
  name: string;
}

/**
 * Affichage de la pastille fermée, dérivé de `institutionId` (source de vérité
 * unique) et des institutions de la commune. EPCI sélectionné : libellé de son
 * type + son nom ; sinon la commune elle-même.
 */
export function resolveSwitcherTrigger(
  institutions: SwitcherInstitution[] | undefined,
  institutionId: string | null,
  communeName: string,
): SwitcherTriggerDisplay {
  const selected = institutions?.find(
    (institution) => institution.institutionId === institutionId,
  );
  if (selected && EPCI_TYPES.has(selected.institutionType)) {
    const label = INSTITUTION_TYPE_LABELS[selected.institutionType];
    if (!label) {
      // Pas de libellé de secours : un type sans libellé est un vrai manque
      // dans institution-labels.ts, pas un cas à masquer.
      throw new Error(
        `[commune-switcher] Aucun libellé français pour le type d'EPCI « ${selected.institutionType} » : l'ajouter à INSTITUTION_TYPE_LABELS.`,
      );
    }
    return { isEpci: true, label, name: selected.institutionName };
  }
  return { isEpci: false, label: "Commune", name: communeName };
}

export interface InstitutionCorrection {
  institutionId: string;
  /** Toujours vrai : les panneaux de détail doivent être remis à zéro. */
  resetDetail: true;
}

/**
 * Décide si `institutionId` doit être réécrit une fois les institutions de la
 * commune connues. Renvoie `null` quand rien ne doit changer.
 *
 * Couvre deux cas :
 *  - `institutionId` absent : le conseil municipal, sinon le premier EPCI ;
 *  - `institutionId` périmé (resté d'une autre commune, donc absent de la
 *    liste) : même valeur par défaut.
 *
 * Appliquer la correction avec un remplacement d'historique (`replace`), pas
 * un ajout (`push`). Ne jamais écrire `null` : sans conseil ni EPCI, renvoyer
 * `null`.
 */
export function resolveInstitutionId(
  institutions: SwitcherInstitution[] | undefined,
  institutionId: string | null,
): InstitutionCorrection | null {
  if (!institutions || institutions.length === 0) {
    return null;
  }
  if (institutions.some((i) => i.institutionId === institutionId)) {
    return null;
  }
  const council = institutions.find(
    (i) => i.institutionType === "conseil_municipal",
  );
  const firstEpci = institutions.find((i) => EPCI_TYPES.has(i.institutionType));
  const fallback = council ?? firstEpci;
  if (!fallback) {
    return null;
  }
  return { institutionId: fallback.institutionId, resetDetail: true };
}
