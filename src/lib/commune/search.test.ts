import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { getCommuneStatus } from "../../data/availability";
import type { CommuneIndex } from "./communes-index";
import { buildCommuneIndex, parseSnapshotMeta } from "./communes-snapshot";
import {
  foldText,
  prepareSearchIndex,
  SEARCH_LIMIT,
  type SearchEntry,
  searchCommunes,
} from "./search";

describe("foldText", () => {
  it("ignore la casse, les accents, les tirets et les apostrophes", () => {
    expect(foldText("Saint-Saturnin-lès-Apt")).toBe("saint saturnin les apt");
    expect(foldText("L’Île-d'Yeu")).toBe("l ile d yeu");
    expect(foldText("  SAINT   saturnin ")).toBe("saint saturnin");
  });

  it("développe les ligatures", () => {
    expect(foldText("Cœuvres-et-Valsery")).toBe("coeuvres et valsery");
  });

  it("transforme les caractères spéciaux en espaces (saisie littérale)", () => {
    expect(foldText("%_\\")).toBe("");
    expect(foldText("a(b)")).toBe("a b");
  });
});

// Index factice : l'ordre voulu (disponible, population, nom) est connu d'avance.
const FIXTURE: CommuneIndex = {
  snapshot: { sha256: "0".repeat(64), retrievedAt: "2026-01-01", count: 6 },
  departments: {
    "63": "Puy-de-Dôme",
    "72": "Sarthe",
    "75": "Paris",
    "2A": "Corse-du-Sud",
  },
  communes: [
    ["63396", "Saint-Saturnin", "63", ["63450"], 1164],
    ["72320", "Saint-Saturnin", "72", ["72650"], 3000],
    ["75056", "Paris", "75", ["75001", "75002"], 2103778],
    ["2A004", "Ajaccio", "2A", ["20000", "20090"], 76320],
    ["63001", "Aubière", "63", ["63170"], null],
    ["63002", "Beaumont", "63", [], 500],
  ],
};

describe("searchCommunes (index factice)", () => {
  const entries = prepareSearchIndex(FIXTURE, (code) =>
    code === "63396" ? "available" : "unfunded",
  );
  const names = (query: string) =>
    searchCommunes(entries, query).map((hit) => `${hit.name} ${hit.code}`);

  it("renvoie [] sous 2 caractères et au-delà de 100", () => {
    expect(searchCommunes(entries, "s")).toEqual([]);
    expect(searchCommunes(entries, "  s  ")).toEqual([]);
    expect(searchCommunes(entries, "--")).toEqual([]);
    expect(searchCommunes(entries, "a".repeat(101))).toEqual([]);
  });

  it("trouve par nom, sans tenir compte des accents ni des tirets", () => {
    expect(names("saint saturnin")).toContain("Saint-Saturnin 63396");
    expect(names("AUBIERE")).toEqual(["Aubière 63001"]);
    expect(names("turn")).toContain("Saint-Saturnin 72320");
  });

  it("trouve par début de code INSEE, corse comprise et sans casse", () => {
    expect(names("633")).toEqual(["Saint-Saturnin 63396"]);
    expect(names("2a0")).toEqual(["Ajaccio 2A004"]);
  });

  it("trouve par début de code postal, pas par un morceau au milieu", () => {
    expect(names("63450")).toEqual(["Saint-Saturnin 63396"]);
    expect(names("63 450")).toEqual(["Saint-Saturnin 63396"]);
    expect(names("3450")).toEqual([]);
  });

  it("met les communes disponibles en premier, puis la population décroissante", () => {
    // Saint-Saturnin (72) a une population plus grande que celle de 63, mais 63396 est ouverte.
    expect(names("saint saturnin")).toEqual([
      "Saint-Saturnin 63396",
      "Saint-Saturnin 72320",
    ]);
    // Aucune ouverte : population décroissante, population absente en dernier.
    expect(names("au")).toEqual(["Beaumont 63002", "Aubière 63001"]);
  });

  it("distingue les homonymes par le département", () => {
    const hits = searchCommunes(entries, "saint-saturnin");
    expect(hits.map((hit) => hit.departmentLabel)).toEqual([
      "Puy-de-Dôme",
      "Sarthe",
    ]);
  });

  it("omet le département quand il porte le même nom que la commune", () => {
    expect(searchCommunes(entries, "paris")[0]?.departmentLabel).toBeNull();
  });

  it("renvoie le premier code postal, ou null s'il n'y en a aucun", () => {
    expect(searchCommunes(entries, "paris")[0]?.postalCode).toBe("75001");
    expect(searchCommunes(entries, "beaumont")[0]?.postalCode).toBeNull();
  });

  it("signale les communes disponibles", () => {
    const hits = searchCommunes(entries, "saint saturnin");
    expect(hits.map((hit) => hit.status)).toEqual(["available", "unfunded"]);
  });

  it("trie par statut : disponible, financée, partiellement financée, non financée", () => {
    const sorted = prepareSearchIndex(
      FIXTURE,
      (code) =>
        (
          ({
            "63450": "unfunded",
            "63002": "partially-funded",
            "63001": "funded",
            "63396": "available",
          }) as const
        )[code as "63450"] ?? "unfunded",
    );
    expect(
      searchCommunes(sorted, "au")
        .map((hit) => hit.status)
        .slice(0, 2),
    ).toEqual(["funded", "partially-funded"]);
  });

  it("traite % _ \\ ( comme du texte, sans erreur", () => {
    expect(searchCommunes(entries, "%%")).toEqual([]);
    expect(() => searchCommunes(entries, "a(b")).not.toThrow();
  });
});

describe("searchCommunes (snapshot réel)", () => {
  let entries: SearchEntry[] = [];
  beforeAll(() => {
    const dir = resolve(import.meta.dirname, "../../../data/communes");
    const index = buildCommuneIndex(
      readFileSync(resolve(dir, "communes-all.json.gz")),
      parseSnapshotMeta(
        JSON.parse(
          readFileSync(resolve(dir, "communes-all.meta.json"), "utf8"),
        ),
      ),
    );
    entries = prepareSearchIndex(index, getCommuneStatus);
  });

  it("limite à 20 résultats", () => {
    expect(searchCommunes(entries, "sain")).toHaveLength(SEARCH_LIMIT);
  });

  it("met Saint-Saturnin (63) en premier pour « saint-sat »", () => {
    const [first] = searchCommunes(entries, "saint-sat");
    expect(first).toMatchObject({
      code: "63396",
      departmentLabel: "Puy-de-Dôme",
      postalCode: "63450",
      status: "available",
    });
  });

  it("distingue les « Saint-Saturnin » homonymes", () => {
    const exact = searchCommunes(entries, "saint-saturnin").filter(
      (hit) => hit.name === "Saint-Saturnin",
    );
    expect(exact.length).toBeGreaterThan(1);
    expect(new Set(exact.map((hit) => hit.departmentLabel)).size).toBe(
      exact.length,
    );
  });

  it("trouve avec ou sans accents et ligatures", () => {
    expect(
      searchCommunes(entries, "saint saturnin les apt").map((h) => h.code),
    ).toContain("84118");
    expect(searchCommunes(entries, "coeuvres").map((h) => h.name)).toContain(
      "Cœuvres-et-Valsery",
    );
  });

  it("trouve Ajaccio par son code corse et par un de ses codes postaux", () => {
    expect(searchCommunes(entries, "2A004")[0]?.name).toBe("Ajaccio");
    expect(searchCommunes(entries, "20090").map((h) => h.name)).toContain(
      "Ajaccio",
    );
  });

  it("n'affiche pas le département de Paris", () => {
    const paris = searchCommunes(entries, "paris").find(
      (h) => h.code === "75056",
    );
    expect(paris).toBeDefined();
    expect(paris?.departmentLabel).toBeNull();
  });

  it("renvoie null pour le code postal d'une commune qui n'en a aucun", () => {
    const noPostal = entries.find((e) => e.postalCodes.length === 0);
    expect(noPostal).toBeDefined();
    if (!noPostal) return;
    const hit = searchCommunes(entries, noPostal.code).find(
      (h) => h.code === noPostal.code,
    );
    expect(hit?.postalCode).toBeNull();
  });
});
