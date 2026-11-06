import { describe, expect, it } from "vitest";
import { isValidCommuneCode } from "./commune-code";

describe("isValidCommuneCode", () => {
  it("accepte cinq chiffres", () => {
    expect(isValidCommuneCode("63396")).toBe(true);
    expect(isValidCommuneCode("75056")).toBe(true);
  });

  it("accepte les codes corses (2A / 2B + 3 chiffres)", () => {
    expect(isValidCommuneCode("2A004")).toBe(true);
    expect(isValidCommuneCode("2B033")).toBe(true);
  });

  it("rejette tout le reste", () => {
    for (const value of [
      null,
      undefined,
      "",
      "1234",
      "123456",
      "6339a",
      "2C001",
      "2a004",
      " 63396",
      "63396\n",
      "63396/../",
    ]) {
      expect(isValidCommuneCode(value)).toBe(false);
    }
  });
});
