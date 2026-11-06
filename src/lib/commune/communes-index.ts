// Format de l'index des communes, partagé build / serveur / navigateur.
// Aucun import Node ici : ce fichier est importé côté navigateur.
//
// L'index est généré au build par scripts/build-communes-index.ts depuis le
// snapshot de geo.api.gouv.fr (data/communes/). Format compact : un tuple par
// commune, une table des départements pour ne pas répéter leur nom 35 000 fois.

export type CommuneTuple = readonly [
  code: string,
  name: string,
  departmentCode: string,
  postalCodes: readonly string[],
  /** `null` quand la source ne renseigne pas la population (6 communes). */
  population: number | null,
];

export interface CommuneIndex {
  snapshot: { sha256: string; retrievedAt: string; count: number };
  /** Code de département → nom. */
  departments: Record<string, string>;
  communes: readonly CommuneTuple[];
}

export interface Commune {
  code: string;
  name: string;
  departmentCode: string;
  departmentName: string;
  postalCodes: readonly string[];
  population: number | null;
}

/** Développe un tuple. Lève une erreur si le département est inconnu (index corrompu). */
export function toCommune(
  tuple: CommuneTuple,
  departments: Record<string, string>,
): Commune {
  const [code, name, departmentCode, postalCodes, population] = tuple;
  const departmentName = departments[departmentCode];
  if (departmentName === undefined) {
    throw new Error(
      `[communes-index] Département « ${departmentCode} » absent de la table des départements (commune ${code}).`,
    );
  }
  return {
    code,
    name,
    departmentCode,
    departmentName,
    postalCodes,
    population,
  };
}
