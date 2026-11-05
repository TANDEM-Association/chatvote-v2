/**
 * Regression test for the commune switcher's closed-trigger display.
 *
 * Bug: the trigger hardcoded MapPin/"Commune"/communeName regardless of the
 * selected `institutionId`, so picking an EPCI in the dropdown never updated
 * the closed pill. `resolveSwitcherTrigger` is the pure decision extracted
 * from the component render — tested directly (no jsdom / component render
 * available in this project's vitest setup) to avoid mocking the tRPC/UI
 * import chain for a one-branch conditional.
 *
 * `?? "Intercommunalité"` silent fallback: an EPCI type missing from
 * INSTITUTION_TYPE_LABELS used to render a vague generic label instead of
 * failing loudly (project anti-pattern — no silent fallback data). Table
 * coverage below proves every current EPCI_TYPES entry has a precise French
 * label; the last test proves a future gap (label map falling out of sync
 * with EPCI_TYPES) throws instead of silently degrading.
 */

import { describe, expect, it, vi } from "vitest";
import {
	EPCI_TYPES,
	resolveSwitcherTrigger,
	type SwitcherInstitution,
} from "../commune-switcher";

const MISSING_LABEL_ERROR_PATTERN = /metropole/i;

const CONSEIL: SwitcherInstitution = {
	institutionId: "conseil-1",
	institutionType: "conseil_municipal",
	institutionName: "Conseil municipal de Test",
};

// Precise French label expected for every current EPCI type. Kept as its own
// table (not re-imported from institution-labels.ts) so this test fails if
// someone changes a label's wording without noticing the switcher displays it.
const EXPECTED_EPCI_LABELS: Record<string, string> = {
	communaute_de_communes: "Communauté de communes",
	agglomeration: "Agglomération",
	syndicat: "Syndicat",
	communaute_urbaine: "Communauté urbaine",
	metropole: "Métropole",
};

describe("resolveSwitcherTrigger", () => {
	it("falls back to commune display when the commune's own council is selected", () => {
		const epci: SwitcherInstitution = {
			institutionId: "epci-1",
			institutionType: "communaute_de_communes",
			institutionName: "CC du Pays de Test",
		};
		const result = resolveSwitcherTrigger(
			[CONSEIL, epci],
			"conseil-1",
			"Commune de Test"
		);
		expect(result).toEqual({
			isEpci: false,
			label: "Commune",
			name: "Commune de Test",
		});
	});

	it("falls back to commune display while institutions are still loading", () => {
		const result = resolveSwitcherTrigger(undefined, null, "Commune de Test");
		expect(result).toEqual({
			isEpci: false,
			label: "Commune",
			name: "Commune de Test",
		});
	});

	describe("EPCI label coverage", () => {
		it("has a table entry for every EPCI_TYPES value (fails loudly on drift, not silently)", () => {
			expect(new Set(Object.keys(EXPECTED_EPCI_LABELS))).toEqual(EPCI_TYPES);
		});

		for (const [institutionType, expectedLabel] of Object.entries(
			EXPECTED_EPCI_LABELS
		)) {
			it(`resolves institutionType "${institutionType}" to the precise label "${expectedLabel}"`, () => {
				const institution: SwitcherInstitution = {
					institutionId: "epci-x",
					institutionType,
					institutionName: "EPCI de Test",
				};
				const result = resolveSwitcherTrigger(
					[CONSEIL, institution],
					"epci-x",
					"Commune de Test"
				);
				expect(result).toEqual({
					isEpci: true,
					label: expectedLabel,
					name: "EPCI de Test",
				});
			});
		}
	});

	describe("fail-loud on a missing label (no silent fallback)", () => {
		it("throws instead of substituting a generic label when an EPCI type has no entry in INSTITUTION_TYPE_LABELS", async () => {
			vi.resetModules();
			vi.doMock("@/lib/conseil/institution-labels", () => ({
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
					"../commune-switcher"
				);
				const institution: SwitcherInstitution = {
					institutionId: "epci-x",
					institutionType: "metropole",
					institutionName: "Métropole de Test",
				};
				expect(() =>
					resolveWithGap([CONSEIL, institution], "epci-x", "Commune de Test")
				).toThrow(MISSING_LABEL_ERROR_PATTERN);
			} finally {
				vi.doUnmock("@/lib/conseil/institution-labels");
				vi.resetModules();
			}
		});
	});
});
