import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isValidCommuneCode } from "../lib/commune/commune-code";
import {
  buildCommuneIndex,
  parseSnapshotMeta,
} from "../lib/commune/communes-snapshot";
import {
  AVAILABLE_INSTITUTIONS,
  COMMUNE_STATUSES,
  getCommuneStatus,
  isCommuneAvailable,
  isInstitutionAvailable,
} from "./availability";

const dir = resolve(import.meta.dirname, "../../data/communes");
const index = buildCommuneIndex(
  readFileSync(resolve(dir, "communes-all.json.gz")),
  parseSnapshotMeta(
    JSON.parse(readFileSync(resolve(dir, "communes-all.meta.json"), "utf8")),
  ),
);
const knownCodes = new Set(index.communes.map((c) => c[0]));

describe("availability", () => {
  it("ouvre au moins Saint-Saturnin", () => {
    expect(isCommuneAvailable("63396")).toBe(true);
  });

  it("ne contient que des codes INSEE valides (faute de frappe)", () => {
    for (const code of Object.keys(COMMUNE_STATUSES)) {
      expect(isValidCommuneCode(code), code).toBe(true);
    }
  });

  it("ne contient que des communes présentes dans le snapshot", () => {
    for (const code of Object.keys(COMMUNE_STATUSES)) {
      expect(knownCodes.has(code), `${code} absent du snapshot`).toBe(true);
    }
  });

  it("ne contient aucun doublon d'institution", () => {
    expect(new Set(AVAILABLE_INSTITUTIONS).size).toBe(
      AVAILABLE_INSTITUTIONS.length,
    );
  });

  it("n'ouvre pas une commune qui n'est pas listée", () => {
    expect(isCommuneAvailable("75056")).toBe(false);
    expect(isCommuneAvailable("")).toBe(false);
  });

  it("donne le statut unfunded par défaut, y compris pour des clés d'objet", () => {
    expect(getCommuneStatus("75056")).toBe("unfunded");
    expect(getCommuneStatus("constructor")).toBe("unfunded");
    expect(getCommuneStatus("__proto__")).toBe("unfunded");
  });

  it("n'accepte que des statuts connus", () => {
    for (const status of Object.values(COMMUNE_STATUSES)) {
      expect(["available", "unfunded", "partially-funded", "funded"]).toContain(
        status,
      );
    }
  });

  it("n'a aucune institution ouverte pour l'instant, et les SIREN listés ont 9 chiffres", () => {
    expect(isInstitutionAvailable("200000000")).toBe(false);
    for (const siren of AVAILABLE_INSTITUTIONS) {
      expect(siren).toMatch(/^\d{9}$/);
    }
  });
});
