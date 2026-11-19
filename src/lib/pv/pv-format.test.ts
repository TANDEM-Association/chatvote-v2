import { describe, expect, it } from "vitest";
import {
  buildPvCommuneIndex,
  isValidSeanceId,
  PvFormatError,
  type PvSeance,
  parsePvCommuneIndex,
  parsePvFrontmatter,
} from "./pv-format";

const VALID = {
  type: "pv-augmente",
  format_version: 1,
  code_insee: "63396",
  commune: "Saint-Saturnin",
  date_seance: "2025-01-29",
  resume: "Le conseil demande des subventions pour la mairie.",
  sujets: ["Mairie", "Subventions"],
  nb_deliberations: 2,
  source_titre:
    "Procès-verbal du Conseil Municipal du mercredi 29 janvier 2025",
  source_url: "https://www.saint-saturnin63.fr/pv.pdf",
  source_fichier: "Janvier-2025.pdf",
  source_sha256:
    "b3b6aa3d46b23242ed62ac46d65d7462c8f590ee46040c644c0c5c1ce9afde34",
  skill: "rediger-pv-augmente",
  skill_version: "2.1.0",
  statut_relecture: "relu par agent",
};
const EXPECTED = { codeInsee: "63396", id: "2025-01-29" };

const problemsOf = (data: unknown, expected = EXPECTED): string[] => {
  try {
    parsePvFrontmatter(data, expected);
    return [];
  } catch (error) {
    if (error instanceof PvFormatError) return error.problems;
    throw error;
  }
};

describe("isValidSeanceId", () => {
  it.each(["2025-01-29", "2026-03-21-2"])("accepte %s", (id) => {
    expect(isValidSeanceId(id)).toBe(true);
  });
  it.each([
    "PV-augmente_Saint-Saturnin_2025-01-29",
    "2025-1-29",
    "2025-01-29-1",
    "../2025-01-29",
    "",
  ])("refuse %s", (id) => {
    expect(isValidSeanceId(id)).toBe(false);
  });
});

describe("parsePvFrontmatter", () => {
  it("convertit un en-tête conforme", () => {
    expect(parsePvFrontmatter(VALID, EXPECTED)).toEqual({
      seance: {
        id: "2025-01-29",
        date: "2025-01-29",
        resume: VALID.resume,
        sujets: ["Mairie", "Subventions"],
        nbDeliberations: 2,
        sourceUrl: VALID.source_url,
        statutRelecture: "relu par agent",
      },
      warnings: [],
    });
  });

  it("accepte une date déjà convertie en Date par le parseur YAML", () => {
    const { seance } = parsePvFrontmatter(
      { ...VALID, date_seance: new Date("2025-01-29T00:00:00Z") },
      EXPECTED,
    );
    expect(seance.date).toBe("2025-01-29");
  });

  it("accepte une seconde séance le même jour", () => {
    const { seance } = parsePvFrontmatter(VALID, {
      codeInsee: "63396",
      id: "2025-01-29-2",
    });
    expect(seance.id).toBe("2025-01-29-2");
  });

  it("signale sans bloquer source_url et skill_version vides", () => {
    const { seance, warnings } = parsePvFrontmatter(
      { ...VALID, source_url: "", skill_version: "" },
      EXPECTED,
    );
    expect(seance.sourceUrl).toBeNull();
    expect(warnings).toHaveLength(2);
  });

  it("refuse un code INSEE vide ou différent du dossier", () => {
    expect(problemsOf({ ...VALID, code_insee: "" })).toHaveLength(1);
    expect(problemsOf({ ...VALID, code_insee: "63450" })[0]).toContain(
      "ne correspond pas au dossier",
    );
  });

  it("refuse un code INSEE numérique (zéro initial perdu)", () => {
    expect(problemsOf({ ...VALID, code_insee: 63396 })).toHaveLength(1);
  });

  it("refuse une date différente du nom du fichier", () => {
    expect(problemsOf({ ...VALID, date_seance: "2025-01-30" })[0]).toContain(
      "nom du fichier",
    );
  });

  it("refuse une date impossible", () => {
    expect(
      problemsOf(
        { ...VALID, date_seance: "2025-02-30" },
        { codeInsee: "63396", id: "2025-02-30" },
      ),
    ).toHaveLength(1);
  });

  it("contrôle le résumé et les sujets", () => {
    expect(problemsOf({ ...VALID, resume: "x".repeat(301) })).toHaveLength(1);
    expect(problemsOf({ ...VALID, resume: "a\nb" })).toHaveLength(1);
    expect(problemsOf({ ...VALID, sujets: ["Seul"] })).toHaveLength(1);
    expect(
      problemsOf({ ...VALID, sujets: ["A", "x".repeat(41)] }),
    ).toHaveLength(1);
  });

  it("refuse un lien source non http(s)", () => {
    expect(
      problemsOf({ ...VALID, source_url: "javascript:alert(1)" }),
    ).toHaveLength(1);
  });

  it("refuse un statut de relecture inconnu", () => {
    expect(problemsOf({ ...VALID, statut_relecture: "relu" })).toHaveLength(1);
  });

  it("liste tous les problèmes d'un coup", () => {
    expect(
      problemsOf({ ...VALID, type: "autre", format_version: 2, commune: "" }),
    ).toHaveLength(3);
  });

  it("refuse un en-tête absent", () => {
    expect(() => parsePvFrontmatter(null, EXPECTED)).toThrow(PvFormatError);
  });
});

const seance = (id: string): PvSeance => ({
  id,
  date: id.slice(0, 10),
  resume: "Résumé.",
  sujets: ["A", "B"],
  nbDeliberations: 1,
  sourceUrl: null,
  statutRelecture: "relu par agent",
});

describe("buildPvCommuneIndex", () => {
  it("trie les séances de la plus récente à la plus ancienne", () => {
    const index = buildPvCommuneIndex("63396", [
      seance("2025-01-29"),
      seance("2026-03-21"),
      seance("2026-03-21-2"),
    ]);
    expect(index.seances.map((s) => s.id)).toEqual([
      "2026-03-21-2",
      "2026-03-21",
      "2025-01-29",
    ]);
  });

  it("refuse une séance en double", () => {
    expect(() =>
      buildPvCommuneIndex("63396", [
        seance("2025-01-29"),
        seance("2025-01-29"),
      ]),
    ).toThrow(PvFormatError);
  });
});

describe("parsePvCommuneIndex", () => {
  const index = buildPvCommuneIndex("63396", [seance("2025-01-29")]);

  it("relit un index produit par buildPvCommuneIndex", () => {
    expect(
      parsePvCommuneIndex(JSON.parse(JSON.stringify(index)), "63396"),
    ).toEqual(index);
  });

  it("refuse l'index d'une autre commune", () => {
    expect(() => parsePvCommuneIndex(index, "2A004")).toThrow(PvFormatError);
  });

  it("écarte une séance mal formée sans rejeter les autres", () => {
    const tampered = {
      ...index,
      seances: [...index.seances, { ...seance("2025-03-26"), id: "../etc" }],
    };
    expect(parsePvCommuneIndex(tampered, "63396").seances).toHaveLength(1);
  });

  it("écarte un lien source dangereux", () => {
    const tampered = {
      ...index,
      seances: [{ ...seance("2025-03-26"), sourceUrl: "javascript:alert(1)" }],
    };
    expect(parsePvCommuneIndex(tampered, "63396").seances).toHaveLength(0);
  });
});
