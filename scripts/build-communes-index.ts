// Génère src/data/generated/communes-index.json depuis le snapshot de communes.
// Exécuté par Node directement (type stripping) : `pnpm build:data`, et
// automatiquement avant dev, build et check.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildCommuneIndex,
  parseSnapshotMeta,
  SnapshotError,
} from "../src/lib/commune/communes-snapshot.ts";

const root = resolve(import.meta.dirname, "..");
const snapshotPath = resolve(root, "data/communes/communes-all.json.gz");
const metaPath = resolve(root, "data/communes/communes-all.meta.json");
const outPath = resolve(root, "src/data/generated/communes-index.json");

function read(path: string): Buffer {
  try {
    return readFileSync(path);
  } catch (error) {
    throw new SnapshotError(
      `Fichier introuvable ou illisible : ${path} (${error instanceof Error ? error.message : String(error)}). Voir data/communes/README.md.`,
    );
  }
}

try {
  const meta = parseSnapshotMeta(JSON.parse(read(metaPath).toString("utf8")));
  const index = buildCommuneIndex(read(snapshotPath), meta);
  mkdirSync(resolve(outPath, ".."), { recursive: true });
  writeFileSync(outPath, JSON.stringify(index));
  console.log(
    `communes-index : ${index.communes.length} communes, ${Object.keys(index.departments).length} départements → src/data/generated/communes-index.json`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
