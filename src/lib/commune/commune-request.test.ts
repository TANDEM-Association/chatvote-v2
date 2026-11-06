import { describe, expect, it } from "vitest";
import { isCommuneAvailable } from "../../data/availability";
import {
  type CommuneRequestDeps,
  DEFAULT_COMMUNE_CODE,
  resolveCommuneRequest,
} from "./commune-request";
import type { Commune } from "./communes-index";

const SAINT_SATURNIN: Commune = {
  code: "63396",
  name: "Saint-Saturnin",
  departmentCode: "63",
  departmentName: "Puy-de-Dôme",
  postalCodes: ["63450"],
  population: 1164,
};
const AJACCIO: Commune = {
  code: "2A004",
  name: "Ajaccio",
  departmentCode: "2A",
  departmentName: "Corse-du-Sud",
  postalCodes: ["20000", "20090", "20167"],
  population: 76320,
};

const deps: CommuneRequestDeps = {
  find: (code) =>
    [SAINT_SATURNIN, AJACCIO].find((commune) => commune.code === code),
  isAvailable: (code) => code === "63396",
};

describe("resolveCommuneRequest", () => {
  it("ouvre la commune par défaut quand le paramètre est absent", () => {
    expect(resolveCommuneRequest(null, deps)).toMatchObject({
      kind: "available",
      commune: { code: DEFAULT_COMMUNE_CODE },
    });
  });

  it("renvoie le chat et le contexte d'une commune ouverte", () => {
    expect(resolveCommuneRequest("63396", deps)).toEqual({
      kind: "available",
      commune: SAINT_SATURNIN,
      promptContext:
        "Je vais te poser des questions sur la ville de Saint-Saturnin dont le code postal est 63450",
    });
  });

  it("renvoie la page dédiée pour une commune connue mais fermée (Corse comprise)", () => {
    expect(resolveCommuneRequest("2A004", deps)).toEqual({
      kind: "unavailable",
      commune: AJACCIO,
    });
  });

  it("renvoie not-found pour un code bien formé mais inconnu", () => {
    expect(resolveCommuneRequest("99999", deps)).toEqual({ kind: "not-found" });
  });

  it.each([
    "",
    "abc",
    "6339",
    "633960",
    "2a004",
    " 63396",
    "63396\n",
    "<script>",
    "../etc",
  ])("redirige vers l'accueil pour le format invalide %j", (value) => {
    expect(resolveCommuneRequest(value, deps)).toEqual({
      kind: "redirect",
      location: "/",
    });
  });

  it("ne cherche la commune qu'après avoir validé le format", () => {
    const calls: string[] = [];
    resolveCommuneRequest("abc", {
      find: (code) => {
        calls.push(code);
        return undefined;
      },
      isAvailable: () => false,
    });
    expect(calls).toEqual([]);
  });

  it("la commune par défaut est bien ouverte", () => {
    expect(isCommuneAvailable(DEFAULT_COMMUNE_CODE)).toBe(true);
  });
});
