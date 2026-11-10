// Recherche de communes sur l'index, sans dépendance : tourne dans le navigateur
// (champ de recherche) comme dans les tests. Aucun import Node ici.
//
// Règles (voir docs/commune-selector-plan.md, §5) :
//  - 2 à 100 caractères, 20 résultats au plus, une entrée par commune ;
//  - par nom (n'importe où dans le nom), code INSEE (début) ou code postal (début) ;
//  - insensible à la casse, aux accents, aux tirets et aux apostrophes ;
//  - par statut (disponible, financée, partiellement financée, non financée), puis population décroissante, puis nom.
//
// Écart avec l'app d'origine : le code postal est comparé au début (comme le
// code INSEE) et non n'importe où, pour que « 63 » ne remonte pas toute la France.

import type { CommuneStatus } from "../../data/availability";
import { type CommuneIndex, toCommune } from "./communes-index";

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;
export const SEARCH_LIMIT = 20;

/**
 * Normalise un texte pour la comparaison : minuscules, sans accents, tout ce
 * qui n'est ni lettre ni chiffre (tirets, apostrophes, %, parenthèses…) devient
 * une espace, espaces regroupées. Une saisie utilisateur est donc toujours du
 * texte littéral.
 */
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Ordre d'affichage : les communes les plus proches de l'ouverture d'abord. */
const STATUS_RANK: Record<CommuneStatus, number> = {
  available: 0,
  funded: 1,
  "partially-funded": 2,
  unfunded: 3,
};

export interface SearchEntry {
  code: string;
  name: string;
  /** Nom normalisé par `foldText`. */
  nameKey: string;
  /** Code INSEE en minuscules (« 2a004 »). */
  codeKey: string;
  departmentName: string;
  postalCodes: readonly string[];
  status: CommuneStatus;
}

export interface SearchHit {
  code: string;
  name: string;
  /** Département à afficher ; `null` quand il porte le même nom que la commune (Paris). */
  departmentLabel: string | null;
  /** Premier code postal, `null` si la commune n'en a aucun. */
  postalCode: string | null;
  status: CommuneStatus;
}

/**
 * Prépare l'index une fois (normalisation et tri) : `searchCommunes` n'a plus
 * qu'à parcourir la liste dans l'ordre et à s'arrêter au 20e résultat.
 */
export function prepareSearchIndex(
  index: CommuneIndex,
  getStatus: (code: string) => CommuneStatus,
): SearchEntry[] {
  const entries = index.communes.map(
    (tuple): SearchEntry & { population: number } => {
      const commune = toCommune(tuple, index.departments);
      return {
        code: commune.code,
        name: commune.name,
        nameKey: foldText(commune.name),
        codeKey: commune.code.toLowerCase(),
        departmentName: commune.departmentName,
        postalCodes: commune.postalCodes,
        status: getStatus(commune.code),
        // Population absente (6 communes) : traitée comme 0 pour le tri uniquement.
        population: commune.population ?? 0,
      };
    },
  );
  entries.sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      b.population - a.population ||
      a.name.localeCompare(b.name, "fr"),
  );
  return entries;
}

function matches(entry: SearchEntry, term: string, compact: string): boolean {
  return (
    entry.nameKey.includes(term) ||
    entry.codeKey.startsWith(compact) ||
    entry.postalCodes.some((postalCode) => postalCode.startsWith(compact))
  );
}

/** Renvoie `[]` si la saisie est trop courte ou trop longue. */
export function searchCommunes(
  entries: readonly SearchEntry[],
  query: string,
): SearchHit[] {
  if (query.trim().length > SEARCH_MAX_LENGTH) {
    return [];
  }
  const term = foldText(query);
  if (term.length < SEARCH_MIN_LENGTH) {
    return [];
  }
  const compact = term.replaceAll(" ", "");

  const hits: SearchHit[] = [];
  for (const entry of entries) {
    if (!matches(entry, term, compact)) {
      continue;
    }
    hits.push({
      code: entry.code,
      name: entry.name,
      departmentLabel:
        foldText(entry.departmentName) === entry.nameKey
          ? null
          : entry.departmentName,
      postalCode: entry.postalCodes[0] ?? null,
      status: entry.status,
    });
    if (hits.length === SEARCH_LIMIT) {
      break;
    }
  }
  return hits;
}
