import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const vercel = JSON.parse(read("../vercel.json")) as {
  headers: { headers: { key: string; value: string }[] }[];
};
const csp =
  vercel.headers
    .flatMap((h) => h.headers)
    .find((h) => h.key === "Content-Security-Policy")?.value ?? "";
const directive = (name: string) =>
  csp.split(";").find((d) => d.trim().startsWith(`${name} `)) ?? "";

describe("CSP et Matomo", () => {
  const raw = /^PUBLIC_MATOMO_URL=(.*)$/m.exec(read("../.env.example"))?.[1];
  const configured = Boolean(raw?.trim());

  // Sans URL dans .env.example, le suivi est désactivé : rien à contrôler.
  it.skipIf(!configured)(
    "autorise l'origine Matomo de .env.example (script, API, image)",
    () => {
      const origin = new URL((raw ?? "").trim()).origin;
      expect(directive("script-src")).toContain(origin);
      expect(directive("connect-src")).toContain(origin);
      expect(directive("img-src")).toContain(origin);
    },
  );

  it.skipIf(!configured)(
    "n'autorise pas Matomo en iframe (l'opposition passe par une case, pas par un module Matomo)",
    () => {
      const origin = new URL((raw ?? "").trim()).origin;
      expect(directive("frame-src")).not.toContain(origin);
    },
  );
});
