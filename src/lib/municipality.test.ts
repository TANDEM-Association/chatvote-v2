import { describe, expect, it } from "vitest";
import {
  isValidMunicipalityCode,
  resolveMunicipalityCode,
} from "./municipality";

describe("isValidMunicipalityCode", () => {
  it.each(["63396", "63001", "75056", "2A004", "2B033"])(
    "accepte %s",
    (code) => {
      expect(isValidMunicipalityCode(code)).toBe(true);
    },
  );

  it.each([
    "abc",
    "",
    "6339",
    "633961",
    "2C004",
    "2a004",
    "63396 ",
    "63396&x=1",
    "../63396",
    "<script>",
  ])("refuse %j", (code) => {
    expect(isValidMunicipalityCode(code)).toBe(false);
  });

  it("refuse null et undefined", () => {
    expect(isValidMunicipalityCode(null)).toBe(false);
    expect(isValidMunicipalityCode(undefined)).toBe(false);
  });
});

describe("resolveMunicipalityCode", () => {
  it("garde le code demandé s'il est valide", () => {
    expect(resolveMunicipalityCode("63001", "63396")).toBe("63001");
  });

  it("retombe sur la valeur par défaut sinon", () => {
    expect(resolveMunicipalityCode("abc", "63396")).toBe("63396");
    expect(resolveMunicipalityCode(null, "63396")).toBe("63396");
  });
});
