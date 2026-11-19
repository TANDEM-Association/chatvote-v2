// Format des PV augmentés (consignes v1) : validation de l'en-tête des `.md` et
// de l'index par commune (`<INSEE>/index.json`) que lit le site.
// Partagé entre le script `pnpm pv:index` (exécuté par Node, d'où les imports
// en `.ts`) et le serveur. Aucun import Node.

import { isValidCommuneCode } from "../commune/commune-code.ts";

export const PV_FORMAT_VERSION = 1;

/** Identifiant d'une séance = nom de ses fichiers : date, et `-2` pour une seconde séance le même jour. */
export const SEANCE_ID_REGEX = /^\d{4}-\d{2}-\d{2}(?:-[2-9])?$/;

export const REVIEW_STATUSES = [
  "non relu",
  "relu par agent",
  "relu par une personne",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

const RESUME_MAX_LENGTH = 300;
const SUJET_MAX_LENGTH = 40;
const SUJETS_MIN = 2;
const SUJETS_MAX = 5;

/** Une séance telle que l'affiche le site (carte de la liste et en-tête du détail). */
export interface PvSeance {
  id: string;
  /** Date de la séance, AAAA-MM-JJ. */
  date: string;
  resume: string;
  sujets: string[];
  nbDeliberations: number;
  /** Lien vers le PV officiel, `null` s'il n'est pas en ligne. */
  sourceUrl: string | null;
  statutRelecture: ReviewStatus;
}

export interface PvCommuneIndex {
  formatVersion: typeof PV_FORMAT_VERSION;
  codeInsee: string;
  /** De la plus récente à la plus ancienne. */
  seances: PvSeance[];
}

export class PvFormatError extends Error {
  // Pas de propriété de paramètre (`readonly problems` dans le constructeur) :
  // Node, en simple suppression des types, ne la prend pas en charge.
  readonly problems: string[];

  constructor(message: string, problems: string[] = []) {
    super(problems.length ? `${message}\n- ${problems.join("\n- ")}` : message);
    this.name = "PvFormatError";
    this.problems = problems;
  }
}

export function isValidSeanceId(value: unknown): value is string {
  return typeof value === "string" && SEANCE_ID_REGEX.test(value);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/** Un parseur YAML peut rendre `2025-01-29` sous forme de Date. */
function toIsoDate(value: unknown): unknown {
  return value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString().slice(0, 10)
    : value;
}

export interface ParsedFrontmatter {
  seance: PvSeance;
  /** Écarts aux consignes qui n'empêchent pas l'affichage. */
  warnings: string[];
}

/**
 * Valide l'en-tête d'un `.md` (déjà converti de YAML en objet) contre les
 * consignes v1. `expected` vient de l'emplacement du fichier : dossier = code
 * INSEE, nom = identifiant de séance. Lève une PvFormatError listant tous les
 * problèmes bloquants.
 */
export function parsePvFrontmatter(
  data: unknown,
  expected: { codeInsee: string; id: string },
): ParsedFrontmatter {
  if (!isRecord(data)) {
    throw new PvFormatError("En-tête absent ou illisible.");
  }
  const problems: string[] = [];
  const warnings: string[] = [];

  if (data.type !== "pv-augmente") {
    problems.push("`type` doit valoir `pv-augmente`.");
  }
  if (data.format_version !== PV_FORMAT_VERSION) {
    problems.push(`\`format_version\` doit valoir ${PV_FORMAT_VERSION}.`);
  }

  if (!isValidCommuneCode(data.code_insee as string | undefined)) {
    problems.push(
      '`code_insee` doit être un code INSEE entre guillemets (ex. "63396").',
    );
  } else if (data.code_insee !== expected.codeInsee) {
    problems.push(
      `\`code_insee\` (${data.code_insee}) ne correspond pas au dossier (${expected.codeInsee}).`,
    );
  }

  if (!isNonEmptyString(data.commune)) {
    problems.push("`commune` est vide.");
  }

  const date = toIsoDate(data.date_seance);
  if (typeof date !== "string" || !isRealDate(date)) {
    problems.push("`date_seance` doit être une date AAAA-MM-JJ.");
  } else if (date !== expected.id.slice(0, 10)) {
    problems.push(
      `\`date_seance\` (${date}) ne correspond pas au nom du fichier (${expected.id}).`,
    );
  }

  const resume = data.resume;
  if (!isNonEmptyString(resume)) {
    problems.push("`resume` est vide.");
  } else if (resume.length > RESUME_MAX_LENGTH) {
    problems.push(
      `\`resume\` dépasse ${RESUME_MAX_LENGTH} caractères (${resume.length}).`,
    );
  } else if (/[\n\r]/.test(resume)) {
    problems.push("`resume` doit tenir sur une seule ligne.");
  }

  const sujets = data.sujets;
  if (
    !Array.isArray(sujets) ||
    sujets.length < SUJETS_MIN ||
    sujets.length > SUJETS_MAX
  ) {
    problems.push(
      `\`sujets\` doit être une liste de ${SUJETS_MIN} à ${SUJETS_MAX} libellés.`,
    );
  } else if (
    !sujets.every((s) => isNonEmptyString(s) && s.length <= SUJET_MAX_LENGTH)
  ) {
    problems.push(
      `Chaque sujet doit être un texte de ${SUJET_MAX_LENGTH} caractères maximum.`,
    );
  }

  const nb = data.nb_deliberations;
  if (typeof nb !== "number" || !Number.isInteger(nb) || nb < 0) {
    problems.push("`nb_deliberations` doit être un entier positif ou nul.");
  }

  const sourceUrl = data.source_url ?? "";
  if (typeof sourceUrl !== "string") {
    problems.push("`source_url` doit être un texte.");
  } else if (sourceUrl !== "" && !isHttpUrl(sourceUrl)) {
    problems.push('`source_url` doit être une URL http(s) ou `""`.');
  } else if (sourceUrl === "") {
    warnings.push("`source_url` vide (lien du PV officiel absent).");
  }

  for (const field of ["source_titre", "source_fichier", "skill"]) {
    if (!isNonEmptyString(data[field])) problems.push(`\`${field}\` est vide.`);
  }
  // Traçabilité seulement (sans effet sur l'affichage) : vide = avertissement.
  const sha = data.source_sha256 ?? "";
  if (sha === "") {
    warnings.push("`source_sha256` vide.");
  } else if (typeof sha !== "string" || !/^[0-9a-f]{64}$/.test(sha)) {
    problems.push("`source_sha256` doit compter 64 caractères hexadécimaux.");
  }
  if (!isNonEmptyString(data.skill_version)) {
    warnings.push("`skill_version` vide.");
  }

  const statut = data.statut_relecture;
  if (!REVIEW_STATUSES.includes(statut as ReviewStatus)) {
    problems.push(
      `\`statut_relecture\` doit valoir ${REVIEW_STATUSES.map((s) => `« ${s} »`).join(", ")}.`,
    );
  }

  if (problems.length > 0) {
    throw new PvFormatError(
      `${expected.codeInsee}/${expected.id}.md non conforme :`,
      problems,
    );
  }

  return {
    seance: {
      id: expected.id,
      date: date as string,
      resume: (resume as string).trim(),
      sujets: (sujets as string[]).map((s) => s.trim()),
      nbDeliberations: nb as number,
      sourceUrl: sourceUrl === "" ? null : (sourceUrl as string),
      statutRelecture: statut as ReviewStatus,
    },
    warnings,
  };
}

/** Construit l'index d'une commune : séances de la plus récente à la plus ancienne. */
export function buildPvCommuneIndex(
  codeInsee: string,
  seances: PvSeance[],
): PvCommuneIndex {
  const ids = new Set<string>();
  for (const { id } of seances) {
    if (ids.has(id)) throw new PvFormatError(`Séance en double : ${id}.`);
    ids.add(id);
  }
  return {
    formatVersion: PV_FORMAT_VERSION,
    codeInsee,
    seances: [...seances].sort((a, b) => (a.id < b.id ? 1 : -1)),
  };
}

function isSeance(value: unknown): value is PvSeance {
  if (!isRecord(value)) return false;
  return (
    isValidSeanceId(value.id) &&
    typeof value.date === "string" &&
    isRealDate(value.date) &&
    isNonEmptyString(value.resume) &&
    Array.isArray(value.sujets) &&
    value.sujets.every(isNonEmptyString) &&
    typeof value.nbDeliberations === "number" &&
    Number.isInteger(value.nbDeliberations) &&
    value.nbDeliberations >= 0 &&
    (value.sourceUrl === null ||
      (typeof value.sourceUrl === "string" && isHttpUrl(value.sourceUrl))) &&
    REVIEW_STATUSES.includes(value.statutRelecture as ReviewStatus)
  );
}

/**
 * Valide un index lu depuis le stockage (donnée externe, donc non fiable).
 * Les séances mal formées sont écartées une à une plutôt que de tout rejeter.
 */
export function parsePvCommuneIndex(
  data: unknown,
  codeInsee: string,
): PvCommuneIndex {
  if (
    !isRecord(data) ||
    data.formatVersion !== PV_FORMAT_VERSION ||
    data.codeInsee !== codeInsee ||
    !Array.isArray(data.seances)
  ) {
    throw new PvFormatError(`Index des PV de ${codeInsee} invalide.`);
  }
  return {
    formatVersion: PV_FORMAT_VERSION,
    codeInsee,
    seances: data.seances.filter(isSeance),
  };
}
