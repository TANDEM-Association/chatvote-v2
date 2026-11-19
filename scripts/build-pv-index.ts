// Valide les PV augmentés d'un dossier et génère l'index de chaque commune.
// `pnpm pv:index [dossier]` (par défaut pv-data/pv). Exécuté par Node directement
// (type stripping).
//
// Organisation attendue (identique au stockage Scaleway) :
//   <dossier>/<INSEE>/<AAAA-MM-JJ>.md + .pdf  →  <dossier>/<INSEE>/index.json
//
// Une commune dont un PV est non conforme n'a pas d'index écrit : on ne publie
// pas une liste incomplète sans le savoir. Code de sortie 1 si une erreur.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { isValidCommuneCode } from "../src/lib/commune/commune-code.ts";
import {
  buildPvCommuneIndex,
  isValidSeanceId,
  PvFormatError,
  type PvSeance,
  parsePvFrontmatter,
} from "../src/lib/pv/pv-format.ts";

const root = resolve(import.meta.dirname, "..");
const dir = resolve(root, process.argv[2] ?? "pv-data/pv");

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

function readFrontmatter(path: string): unknown {
  const match = readFileSync(path, "utf8").match(FRONTMATTER);
  if (!match) throw new PvFormatError(`${path} : en-tête --- introuvable.`);
  try {
    return parseYaml(match[1] ?? "");
  } catch (error) {
    throw new PvFormatError(
      `${path} : YAML invalide (${error instanceof Error ? error.message : String(error)}).`,
    );
  }
}

/** Retourne le nombre d'erreurs de la commune. */
function indexCommune(code: string): number {
  const communeDir = join(dir, code);
  const files = readdirSync(communeDir).filter((f) => f !== "index.json");
  const errors: string[] = [];
  const seances: PvSeance[] = [];

  for (const file of files) {
    const match = file.match(/^(.+)\.(md|pdf)$/);
    if (!match || !isValidSeanceId(match[1])) {
      errors.push(`${file} : nom invalide (attendu AAAA-MM-JJ.md ou .pdf).`);
    }
  }

  for (const file of files.filter((f) => f.endsWith(".md"))) {
    const id = file.slice(0, -3);
    if (!isValidSeanceId(id)) continue;
    if (!existsSync(join(communeDir, `${id}.pdf`))) {
      errors.push(`${file} : PDF ${id}.pdf manquant.`);
    }
    try {
      const { seance, warnings } = parsePvFrontmatter(
        readFrontmatter(join(communeDir, file)),
        { codeInsee: code, id },
      );
      seances.push(seance);
      for (const warning of warnings)
        console.warn(`  ⚠ ${code}/${file} : ${warning}`);
    } catch (error) {
      if (!(error instanceof PvFormatError)) throw error;
      errors.push(error.message);
    }
  }
  for (const file of files.filter((f) => f.endsWith(".pdf"))) {
    if (!files.includes(file.replace(/\.pdf$/, ".md"))) {
      errors.push(`${file} : .md correspondant manquant.`);
    }
  }

  if (errors.length > 0) {
    console.error(`✗ ${code} : index non écrit`);
    for (const error of errors)
      console.error(`  ${error.replaceAll("\n", "\n  ")}`);
    return errors.length;
  }
  const index = buildPvCommuneIndex(code, seances);
  writeFileSync(
    join(communeDir, "index.json"),
    `${JSON.stringify(index, null, 2)}\n`,
  );
  console.log(
    `✓ ${code} : ${index.seances.length} séance(s) → ${code}/index.json`,
  );
  return 0;
}

if (!existsSync(dir)) {
  console.error(`Dossier introuvable : ${dir}`);
  process.exit(1);
}

let errorCount = 0;
for (const entry of readdirSync(dir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  if (!isValidCommuneCode(entry.name)) {
    console.error(`✗ ${entry.name} : le dossier doit porter un code INSEE.`);
    errorCount++;
    continue;
  }
  errorCount += indexCommune(entry.name);
}
process.exit(errorCount > 0 ? 1 : 0);
