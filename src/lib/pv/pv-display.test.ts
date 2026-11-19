import { describe, expect, it } from "vitest";
import { formatDeliberations, formatSeanceDate } from "./pv-display";

describe("formatSeanceDate", () => {
  it("écrit la date en toutes lettres, sans décalage de fuseau", () => {
    expect(formatSeanceDate("2025-01-29")).toBe("29 janvier 2025");
    expect(formatSeanceDate("2026-03-01")).toBe("1er mars 2026");
    expect(formatSeanceDate("2026-03-11")).toBe("11 mars 2026");
  });
});

describe("formatDeliberations", () => {
  it.each([
    [0, "Aucune délibération"],
    [1, "1 délibération"],
    [18, "18 délibérations"],
  ])("%i → %s", (count, label) => {
    expect(formatDeliberations(count)).toBe(label);
  });
});
