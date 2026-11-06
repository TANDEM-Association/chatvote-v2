import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { toCommune } from "./communes-index";
import {
  buildCommuneIndex,
  parseSnapshotMeta,
  SnapshotError,
  type SnapshotMeta,
} from "./communes-snapshot";

function snapshotOf(rows: unknown[]): {
  compressed: Buffer;
  meta: SnapshotMeta;
} {
  const compressed = gzipSync(JSON.stringify(rows));
  return {
    compressed,
    meta: {
      sourceUrl: "https://example.test/communes",
      retrievedAt: "2026-01-01",
      count: rows.length,
      sha256: createHash("sha256").update(compressed).digest("hex"),
    },
  };
}

const SAINT_SATURNIN = {
  code: "63396",
  nom: "Saint-Saturnin",
  codesPostaux: ["63450"],
  population: 1164,
  departement: { code: "63", nom: "Puy-de-Dôme" },
  region: { code: "84", nom: "Auvergne-Rhône-Alpes" },
};
const AJACCIO = {
  code: "2A004",
  nom: "Ajaccio",
  codesPostaux: ["20000", "20090", "20167"],
  population: 76320,
  departement: { code: "2A", nom: "Corse-du-Sud" },
};

describe("buildCommuneIndex (données factices)", () => {
  it("convertit chaque commune en tuple et dédoublonne les départements", () => {
    const { compressed, meta } = snapshotOf([SAINT_SATURNIN, AJACCIO]);
    const index = buildCommuneIndex(compressed, meta);
    expect(index.communes).toEqual([
      ["63396", "Saint-Saturnin", "63", ["63450"], 1164],
      ["2A004", "Ajaccio", "2A", ["20000", "20090", "20167"], 76320],
    ]);
    expect(index.departments).toEqual({
      "63": "Puy-de-Dôme",
      "2A": "Corse-du-Sud",
    });
    expect(index.snapshot).toEqual({
      sha256: meta.sha256,
      retrievedAt: "2026-01-01",
      count: 2,
    });
  });

  it("garde la population absente à null, sans l'inventer", () => {
    const { population: _omitted, ...withoutPopulation } = SAINT_SATURNIN;
    const { compressed, meta } = snapshotOf([withoutPopulation]);
    expect(buildCommuneIndex(compressed, meta).communes[0]?.[4]).toBeNull();
  });

  it("refuse un snapshot dont le sha256 ne correspond pas, en citant la source", () => {
    const { compressed, meta } = snapshotOf([SAINT_SATURNIN]);
    const tampered = { ...meta, sha256: "0".repeat(64) };
    expect(() => buildCommuneIndex(compressed, tampered)).toThrow(
      SnapshotError,
    );
    expect(() => buildCommuneIndex(compressed, tampered)).toThrow(
      /https:\/\/example\.test\/communes/,
    );
  });

  it("refuse un nombre de communes différent de celui annoncé", () => {
    const { compressed, meta } = snapshotOf([SAINT_SATURNIN]);
    expect(() => buildCommuneIndex(compressed, { ...meta, count: 2 })).toThrow(
      /annonce 2/,
    );
  });

  it.each([
    ["code INSEE mal formé", { ...SAINT_SATURNIN, code: "6339" }, /6339/],
    ["nom manquant", { ...SAINT_SATURNIN, nom: "" }, /nom/],
    [
      "département manquant",
      { ...SAINT_SATURNIN, departement: undefined },
      /département/,
    ],
    [
      "code postal mal formé",
      { ...SAINT_SATURNIN, codesPostaux: ["6345"] },
      /codes postaux/,
    ],
    [
      "population négative",
      { ...SAINT_SATURNIN, population: -1 },
      /population/,
    ],
  ])("refuse une commune invalide : %s", (_label, row, pattern) => {
    const { compressed, meta } = snapshotOf([row]);
    expect(() => buildCommuneIndex(compressed, meta)).toThrow(pattern);
  });

  it("refuse deux communes avec le même code", () => {
    const { compressed, meta } = snapshotOf([SAINT_SATURNIN, SAINT_SATURNIN]);
    expect(() => buildCommuneIndex(compressed, meta)).toThrow(/en double/);
  });

  it("refuse un département qui porte deux noms", () => {
    const other = {
      ...AJACCIO,
      code: "63001",
      departement: { code: "63", nom: "Autre nom" },
    };
    const { compressed, meta } = snapshotOf([SAINT_SATURNIN, other]);
    expect(() => buildCommuneIndex(compressed, meta)).toThrow(/deux noms/);
  });

  it("refuse un contenu qui n'est pas un JSON compressé", () => {
    const compressed = Buffer.from("pas du gzip");
    const meta: SnapshotMeta = {
      sourceUrl: "https://example.test/communes",
      retrievedAt: "2026-01-01",
      count: 1,
      sha256: createHash("sha256").update(compressed).digest("hex"),
    };
    expect(() => buildCommuneIndex(compressed, meta)).toThrow(/lisible/);
  });
});

describe("parseSnapshotMeta", () => {
  it("refuse un fichier de métadonnées incomplet", () => {
    expect(() => parseSnapshotMeta({ sourceUrl: "x" })).toThrow(SnapshotError);
    expect(() => parseSnapshotMeta(null)).toThrow(SnapshotError);
  });
});

describe("snapshot réel (data/communes)", () => {
  const dir = resolve(import.meta.dirname, "../../../data/communes");
  const meta = parseSnapshotMeta(
    JSON.parse(readFileSync(resolve(dir, "communes-all.meta.json"), "utf8")),
  );
  const index = buildCommuneIndex(
    readFileSync(resolve(dir, "communes-all.json.gz")),
    meta,
  );
  const byCode = new Map(index.communes.map((c) => [c[0], c]));

  it("se construit sans anomalie et contient 34 969 communes", () => {
    expect(index.communes).toHaveLength(34969);
  });

  it("contient Saint-Saturnin avec son département", () => {
    const tuple = byCode.get("63396");
    expect(tuple).toBeDefined();
    if (!tuple) return;
    expect(toCommune(tuple, index.departments)).toMatchObject({
      name: "Saint-Saturnin",
      departmentName: "Puy-de-Dôme",
      postalCodes: ["63450"],
    });
  });

  it("contient les 360 communes corses", () => {
    const corsica = index.communes.filter((c) => /^2[AB]/.test(c[0]));
    expect(corsica).toHaveLength(360);
  });

  it("couvre les cas de codes postaux du plan : plusieurs, nombreux, aucun", () => {
    const postalCounts = index.communes.map((c) => c[3].length);
    expect(byCode.get("75056")?.[3]).toHaveLength(21);
    expect(postalCounts.filter((n) => n > 1)).toHaveLength(387);
    expect(postalCounts.filter((n) => n === 0)).toHaveLength(5);
  });
});
