import { readFileSync } from "node:fs";

// Lecture de deploy/Caddyfile pour les tests : les `{$VAR:défaut}` sont remplacés
// par leur valeur par défaut (la production), comme le fait Caddy sans variable définie.
const raw = readFileSync(
  new URL("../deploy/Caddyfile", import.meta.url),
  "utf8",
);

export const caddyfile = raw.replace(
  /\{\$\w+:([^}]*)\}/g,
  (_match, fallback: string) => fallback,
);

const unquote = (value: string) => value.trim().replace(/^["`]|["`]$/g, "");

// Valeur d'un en-tête posé sur tout le site (bloc `header { ... }` sans matcher).
export const globalHeader = (key: string) => {
  const block = /^\theader \{\n([\s\S]*?)^\t\}/m.exec(caddyfile)?.[1] ?? "";
  const line = block
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith(`${key} `));
  return line ? unquote(line.slice(key.length)) : "";
};

// Valeur d'un en-tête posé sur un chemin (ligne `header @matcher [>]Clé valeur`).
export const pathHeader = (path: string, key: string) => {
  const matcher = new RegExp(
    `^\\t(@\\w+) path ${path.replace(/[*.]/g, "\\$&")}$`,
    "m",
  ).exec(caddyfile)?.[1];
  if (!matcher) return "";
  const line = new RegExp(`^\\theader ${matcher} >?${key} (.+)$`, "m").exec(
    caddyfile,
  )?.[1];
  return line ? unquote(line) : "";
};
