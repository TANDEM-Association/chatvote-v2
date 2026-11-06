// Lecture et validation du snapshot de communes (build uniquement, importe Node).
//
// Les imports portent l'extension `.ts` : ce module est exécuté directement par
// Node (scripts/build-communes-index.ts), qui ne résout pas les imports sans extension.

import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { isValidCommuneCode } from "./commune-code.ts";
import type { CommuneIndex, CommuneTuple } from "./communes-index.ts";

export interface SnapshotMeta {
  sourceUrl: string;
  retrievedAt: string;
  count: number;
  sha256: string;
}

/** Le snapshot est absent, altéré ou invalide : le build doit s'arrêter. */
export class SnapshotError extends Error {
  constructor(message: string, meta?: SnapshotMeta) {
    super(
      meta
        ? `${message}\nLa source de référence est ${meta.sourceUrl} (récupérée le ${meta.retrievedAt}). Pour la régénérer, voir data/communes/README.md.`
        : message,
    );
    this.name = "SnapshotError";
  }
}

const SHA256_RE = /^[0-9a-f]{64}$/;
const POSTAL_CODE_RE = /^\d{5}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSnapshotMeta(raw: unknown): SnapshotMeta {
  if (
    !isRecord(raw) ||
    typeof raw.sourceUrl !== "string" ||
    typeof raw.retrievedAt !== "string" ||
    typeof raw.count !== "number" ||
    !Number.isInteger(raw.count) ||
    typeof raw.sha256 !== "string" ||
    !SHA256_RE.test(raw.sha256)
  ) {
    throw new SnapshotError(
      "communes-all.meta.json est invalide (attendu : sourceUrl, retrievedAt, count entier, sha256 hexadécimal).",
    );
  }
  return {
    sourceUrl: raw.sourceUrl,
    retrievedAt: raw.retrievedAt,
    count: raw.count,
    sha256: raw.sha256,
  };
}

function expectString(value: unknown, what: string): string {
  if (typeof value !== "string" || value === "") {
    throw new SnapshotError(`Snapshot invalide : ${what} manquant ou vide.`);
  }
  return value;
}

/**
 * Vérifie le sha256 du fichier compressé, puis valide chaque commune et la
 * convertit en tuple. Aucune valeur de secours : la moindre anomalie arrête le build.
 */
export function buildCommuneIndex(
  compressed: Buffer,
  meta: SnapshotMeta,
): CommuneIndex {
  const sha256 = createHash("sha256").update(compressed).digest("hex");
  if (sha256 !== meta.sha256) {
    throw new SnapshotError(
      `Le snapshot ne correspond pas à communes-all.meta.json (sha256 attendu ${meta.sha256}, obtenu ${sha256}).`,
      meta,
    );
  }

  let rows: unknown;
  try {
    rows = JSON.parse(gunzipSync(compressed).toString("utf8"));
  } catch (error) {
    throw new SnapshotError(
      `Le snapshot n'est pas un JSON compressé lisible : ${error instanceof Error ? error.message : String(error)}`,
      meta,
    );
  }
  if (!Array.isArray(rows)) {
    throw new SnapshotError(
      "Snapshot invalide : un tableau est attendu.",
      meta,
    );
  }
  if (rows.length !== meta.count) {
    throw new SnapshotError(
      `Le snapshot contient ${rows.length} communes, communes-all.meta.json en annonce ${meta.count}.`,
      meta,
    );
  }

  const departments: Record<string, string> = {};
  const seen = new Set<string>();
  const communes: CommuneTuple[] = [];

  for (const row of rows) {
    if (!isRecord(row)) {
      throw new SnapshotError(
        "Snapshot invalide : une commune n'est pas un objet.",
      );
    }
    const code = expectString(row.code, "code INSEE");
    if (!isValidCommuneCode(code)) {
      throw new SnapshotError(
        `Snapshot invalide : code INSEE « ${code} » mal formé.`,
      );
    }
    if (seen.has(code)) {
      throw new SnapshotError(
        `Snapshot invalide : code INSEE ${code} en double.`,
      );
    }
    seen.add(code);

    const name = expectString(row.nom, `nom (commune ${code})`);

    const department = row.departement;
    if (!isRecord(department)) {
      throw new SnapshotError(
        `Snapshot invalide : département manquant (commune ${code}).`,
      );
    }
    const departmentCode = expectString(
      department.code,
      `code de département (commune ${code})`,
    );
    const departmentName = expectString(
      department.nom,
      `nom de département (commune ${code})`,
    );
    const known = departments[departmentCode];
    if (known !== undefined && known !== departmentName) {
      throw new SnapshotError(
        `Snapshot invalide : le département ${departmentCode} porte deux noms (« ${known} » et « ${departmentName} »).`,
      );
    }
    departments[departmentCode] = departmentName;

    const postalCodes = row.codesPostaux;
    if (
      !Array.isArray(postalCodes) ||
      !postalCodes.every((p) => typeof p === "string" && POSTAL_CODE_RE.test(p))
    ) {
      throw new SnapshotError(
        `Snapshot invalide : codes postaux mal formés (commune ${code}).`,
      );
    }

    const population = row.population;
    if (
      population !== undefined &&
      population !== null &&
      (typeof population !== "number" ||
        !Number.isFinite(population) ||
        population < 0)
    ) {
      throw new SnapshotError(
        `Snapshot invalide : population mal formée (commune ${code}).`,
      );
    }

    communes.push([
      code,
      name,
      departmentCode,
      postalCodes as string[],
      population ?? null,
    ]);
  }

  return {
    snapshot: { sha256, retrievedAt: meta.retrievedAt, count: communes.length },
    departments,
    communes,
  };
}
