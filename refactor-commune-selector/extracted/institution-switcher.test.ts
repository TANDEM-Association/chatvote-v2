/**
 * Tests for the framework-free switcher logic.
 *
 * resolveSwitcherTrigger tests are adapted from the original
 * commune-switcher.test.ts (regression: the closed pill must follow the
 * selected `institutionId`, and an EPCI type with no French label must throw
 * instead of rendering a generic label). resolveInstitutionId and
 * isValidCommuneCode tests are new.
 */

import { describe, expect, it, vi } from "vitest";
import { isValidCommuneCode } from "./commune-code";
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

// Kept as its own table (not re-imported from institution-labels.ts) so this
// test fails if a label's wording changes without anyone noticing.
const EXPECTED_EPCI_LABELS: Record<string, string> = {
	communaute_de_communes: "Communauté de communes",
	agglomeration: "Agglomération",
	syndicat: "Syndicat",
	communaute_urbaine: "Communauté urbaine",
	metropole: "Métropole",
};

describe("resolveSwitcherTrigger", () => {
	it("shows the commune when the commune's own council is selected", () => {
		expect(
			resolveSwitcherTrigger([CONSEIL, CC], "conseil-1", "Commune de Test")
		).toEqual({ isEpci: false, label: "Commune", name: "Commune de Test" });
	});

	it("shows the commune while institutions are still loading", () => {
		expect(resolveSwitcherTrigger(undefined, null, "Commune de Test")).toEqual(
			{ isEpci: false, label: "Commune", name: "Commune de Test" }
		);
	});

	it("has a label entry for every EPCI_TYPES value", () => {
		expect(new Set(Object.keys(EXPECTED_EPCI_LABELS))).toEqual(EPCI_TYPES);
	});

	for (const [institutionType, expectedLabel] of Object.entries(
		EXPECTED_EPCI_LABELS
	)) {
		it(`resolves "${institutionType}" to "${expectedLabel}"`, () => {
			const institution: SwitcherInstitution = {
				institutionId: "epci-x",
				institutionType,
				institutionName: "EPCI de Test",
			};
			expect(
				resolveSwitcherTrigger(
					[CONSEIL, institution],
					"epci-x",
					"Commune de Test"
				)
			).toEqual({ isEpci: true, label: expectedLabel, name: "EPCI de Test" });
		});
	}

	it("throws when an EPCI type has no French label (no silent fallback)", async () => {
		vi.resetModules();
		vi.doMock("./institution-labels", () => ({
			INSTITUTION_TYPE_LABELS: {
				communaute_de_communes: "Communauté de communes",
				agglomeration: "Agglomération",
				syndicat: "Syndicat",
				communaute_urbaine: "Communauté urbaine",
				// metropole intentionally omitted to prove the fail-loud path.
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
				resolveWithGap([CONSEIL, metropole], "epci-x", "Commune de Test")
			).toThrow(MISSING_LABEL_ERROR_PATTERN);
		} finally {
			vi.doUnmock("./institution-labels");
			vi.resetModules();
		}
	});
});

describe("resolveInstitutionId", () => {
	it("returns null while the list is loading or empty", () => {
		expect(resolveInstitutionId(undefined, null)).toBeNull();
		expect(resolveInstitutionId([], null)).toBeNull();
	});

	it("returns null when the current institution belongs to the commune", () => {
		expect(resolveInstitutionId([CONSEIL, CC], "epci-1")).toBeNull();
	});

	it("defaults to the commune's own council when institutionId is absent", () => {
		expect(resolveInstitutionId([CC, CONSEIL], null)).toEqual({
			institutionId: "conseil-1",
			resetDetail: true,
		});
	});

	it("falls back to the first EPCI when the commune has no council", () => {
		expect(resolveInstitutionId([CC], null)).toEqual({
			institutionId: "epci-1",
			resetDetail: true,
		});
	});

	it("replaces a stale institutionId carried over from another commune", () => {
		expect(resolveInstitutionId([CONSEIL, CC], "old-commune-inst")).toEqual({
			institutionId: "conseil-1",
			resetDetail: true,
		});
	});

	it("never proposes a value when there is no council and no EPCI", () => {
		const other: SwitcherInstitution = {
			institutionId: "dep-1",
			institutionType: "departement",
			institutionName: "Département de Test",
		};
		expect(resolveInstitutionId([other], null)).toBeNull();
	});
});

describe("isValidCommuneCode", () => {
	it("accepts five digits", () => {
		expect(isValidCommuneCode("63396")).toBe(true);
		expect(isValidCommuneCode("75056")).toBe(true);
	});

	it("accepts Corsican codes (2A / 2B + 3 digits), unlike the original regex", () => {
		expect(isValidCommuneCode("2A004")).toBe(true);
		expect(isValidCommuneCode("2B033")).toBe(true);
	});

	it("rejects anything else", () => {
		for (const value of [
			null,
			undefined,
			"",
			"1234",
			"123456",
			"6339a",
			"2C001",
			"2a004",
		]) {
			expect(isValidCommuneCode(value)).toBe(false);
		}
	});
});
