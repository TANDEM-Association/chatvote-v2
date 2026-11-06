import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { type Commune, toCommune } from "./communes-index";
import { buildCommuneIndex, parseSnapshotMeta } from "./communes-snapshot";
import { buildPromptContext } from "./prompt-context";

const base = { name: "Testville", departmentName: "Testdep" };

describe("buildPromptContext (cas du plan)", () => {
  it("un code postal : phrase historique de Saint-Saturnin conservée", () => {
    expect(
      buildPromptContext({
        name: "Saint-Saturnin",
        departmentName: "Puy-de-Dôme",
        postalCodes: ["63450"],
      }),
    ).toBe(
      "Je vais te poser des questions sur la ville de Saint-Saturnin dont le code postal est 63450",
    );
  });

  it("deux codes postaux", () => {
    expect(
      buildPromptContext({ ...base, postalCodes: ["01190", "01380"] }),
    ).toBe(
      "Je vais te poser des questions sur la ville de Testville dont les codes postaux sont 01190 et 01380",
    );
  });

  it("trois codes postaux", () => {
    expect(
      buildPromptContext({ ...base, postalCodes: ["31000", "31100", "31200"] }),
    ).toBe(
      "Je vais te poser des questions sur la ville de Testville dont les codes postaux sont 31000, 31100 et 31200",
    );
  });

  it("plus de trois codes postaux : le département à la place", () => {
    expect(
      buildPromptContext({
        ...base,
        postalCodes: ["1", "2", "3", "4"],
      }),
    ).toBe(
      "Je vais te poser des questions sur la ville de Testville (département : Testdep)",
    );
  });

  it("aucun code postal : le département à la place", () => {
    expect(buildPromptContext({ ...base, postalCodes: [] })).toBe(
      "Je vais te poser des questions sur la ville de Testville (département : Testdep)",
    );
  });
});

describe("buildPromptContext (snapshot réel)", () => {
  const dir = resolve(import.meta.dirname, "../../../data/communes");
  const index = buildCommuneIndex(
    readFileSync(resolve(dir, "communes-all.json.gz")),
    parseSnapshotMeta(
      JSON.parse(readFileSync(resolve(dir, "communes-all.meta.json"), "utf8")),
    ),
  );
  const byCode = new Map(
    index.communes.map((tuple) => [
      tuple[0],
      toCommune(tuple, index.departments),
    ]),
  );
  const get = (code: string): Commune => {
    const commune = byCode.get(code);
    if (!commune) throw new Error(`Commune ${code} absente du snapshot`);
    return commune;
  };

  it("Saint-Saturnin (63)", () => {
    expect(buildPromptContext(get("63396"))).toContain("code postal est 63450");
  });

  it("Paris : le département, pas 75001", () => {
    const context = buildPromptContext(get("75056"));
    expect(context).toBe(
      "Je vais te poser des questions sur la ville de Paris (département : Paris)",
    );
    expect(context).not.toContain("75001");
  });

  it("Ajaccio : trois codes postaux", () => {
    expect(buildPromptContext(get("2A004"))).toContain(
      "codes postaux sont 20000, 20090 et 20167",
    );
  });

  it("deux « Saint-Saturnin » donnent deux contextes différents", () => {
    expect(buildPromptContext(get("63396"))).not.toBe(
      buildPromptContext(get("72320")),
    );
  });

  it("chaque commune du snapshot produit une phrase non vide (y compris sans code postal)", () => {
    for (const commune of byCode.values()) {
      expect(buildPromptContext(commune)).toMatch(
        /^Je vais te poser des questions sur la ville de .+/,
      );
    }
  });
});
