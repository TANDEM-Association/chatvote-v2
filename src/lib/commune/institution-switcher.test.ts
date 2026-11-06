import { describe, expect, it, vi } from "vitest";
import {
  EPCI_TYPES,
  resolveInstitutionId,
  resolveSwitcherTrigger,
  type SwitcherInstitution,
} from "./institution-switcher";

const MISSING_LABEL_ERROR_PATTERN = /metropole/i;

const CONSEIL: SwitcherInstitution = {
  institutionId: "conseil-1",
  institutionType: "conseil_municipal",
  institutionName: "Conseil municipal de Test",
};

const CC: SwitcherInstitution = {
  institutionId: "epci-1",
  institutionType: "communaute_de_communes",
  institutionName: "CC du Pays de Test",
};

// Table volontairement recopiée (et non importée de institution-labels.ts) :
// le test échoue si un libellé change sans que personne ne s'en aperçoive.
const EXPECTED_EPCI_LABELS: Record<string, string> = {
  communaute_de_communes: "Communauté de communes",
  agglomeration: "Agglomération",
  syndicat: "Syndicat",
  communaute_urbaine: "Communauté urbaine",
  metropole: "Métropole",
};

describe("resolveSwitcherTrigger", () => {
  it("affiche la commune quand son propre conseil est sélectionné", () => {
    expect(
      resolveSwitcherTrigger([CONSEIL, CC], "conseil-1", "Commune de Test"),
    ).toEqual({ isEpci: false, label: "Commune", name: "Commune de Test" });
  });

  it("affiche la commune tant que les institutions ne sont pas connues", () => {
    expect(resolveSwitcherTrigger(undefined, null, "Commune de Test")).toEqual({
      isEpci: false,
      label: "Commune",
      name: "Commune de Test",
    });
  });

  it("a un libellé pour chaque valeur de EPCI_TYPES", () => {
    expect(new Set(Object.keys(EXPECTED_EPCI_LABELS))).toEqual(EPCI_TYPES);
  });

  for (const [institutionType, expectedLabel] of Object.entries(
    EXPECTED_EPCI_LABELS,
  )) {
    it(`traduit « ${institutionType} » en « ${expectedLabel} »`, () => {
      const institution: SwitcherInstitution = {
        institutionId: "epci-x",
        institutionType,
        institutionName: "EPCI de Test",
      };
      expect(
        resolveSwitcherTrigger(
          [CONSEIL, institution],
          "epci-x",
          "Commune de Test",
        ),
      ).toEqual({ isEpci: true, label: expectedLabel, name: "EPCI de Test" });
    });
  }

  it("lève une erreur si un type d'EPCI n'a pas de libellé (pas de repli silencieux)", async () => {
    vi.resetModules();
    vi.doMock("./institution-labels", () => ({
      INSTITUTION_TYPE_LABELS: {
        communaute_de_communes: "Communauté de communes",
        agglomeration: "Agglomération",
        syndicat: "Syndicat",
        communaute_urbaine: "Communauté urbaine",
        // « metropole » est omis pour prouver le chemin d'échec.
      },
    }));

    try {
      const { resolveSwitcherTrigger: resolveWithGap } = await import(
        "./institution-switcher"
      );
      const metropole: SwitcherInstitution = {
        institutionId: "epci-x",
        institutionType: "metropole",
        institutionName: "Métropole de Test",
      };
      expect(() =>
        resolveWithGap([CONSEIL, metropole], "epci-x", "Commune de Test"),
      ).toThrow(MISSING_LABEL_ERROR_PATTERN);
    } finally {
      vi.doUnmock("./institution-labels");
      vi.resetModules();
    }
  });
});

describe("resolveInstitutionId", () => {
  it("renvoie null pendant le chargement ou si la liste est vide", () => {
    expect(resolveInstitutionId(undefined, null)).toBeNull();
    expect(resolveInstitutionId([], null)).toBeNull();
  });

  it("renvoie null quand l'institution courante appartient à la commune", () => {
    expect(resolveInstitutionId([CONSEIL, CC], "epci-1")).toBeNull();
  });

  it("prend le conseil de la commune quand institutionId est absent", () => {
    expect(resolveInstitutionId([CC, CONSEIL], null)).toEqual({
      institutionId: "conseil-1",
      resetDetail: true,
    });
  });

  it("prend le premier EPCI quand la commune n'a pas de conseil", () => {
    expect(resolveInstitutionId([CC], null)).toEqual({
      institutionId: "epci-1",
      resetDetail: true,
    });
  });

  it("remplace un institutionId resté d'une autre commune", () => {
    expect(resolveInstitutionId([CONSEIL, CC], "old-commune-inst")).toEqual({
      institutionId: "conseil-1",
      resetDetail: true,
    });
  });

  it("ne propose jamais de valeur sans conseil ni EPCI", () => {
    const other: SwitcherInstitution = {
      institutionId: "dep-1",
      institutionType: "departement",
      institutionName: "Département de Test",
    };
    expect(resolveInstitutionId([other], null)).toBeNull();
  });
});
