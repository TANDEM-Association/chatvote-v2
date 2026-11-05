// Framework-free logic of the commune switcher pill. The first half
// (EPCI_TYPES, resolveSwitcherTrigger) is copied verbatim from
// commune-switcher.tsx; resolveInstitutionId is NEW and replaces the two
// React useEffects that defaulted / reconciled `institutionId`.

import { INSTITUTION_TYPE_LABELS } from "./institution-labels";

// Intercommunalité types listed as the "Communauté de communes" option at the
// top of the dropdown. `conseil_municipal` is the commune's own council (the
// default view) and is not repeated here.
export const EPCI_TYPES = new Set([
	"communaute_de_communes",
	"agglomeration",
	"syndicat",
	"communaute_urbaine",
	"metropole",
]);

export interface SwitcherInstitution {
	institutionId: string;
	institutionName: string;
	institutionType: string;
}

export interface SwitcherTriggerDisplay {
	isEpci: boolean;
	label: string;
	name: string;
}

/**
 * Pure decision for the closed trigger: derived from `institutionId` (single
 * source of truth) + the commune's institutions, not duplicated local state.
 * EPCI selected → its type label + name; otherwise the commune itself.
 */
export function resolveSwitcherTrigger(
	institutions: SwitcherInstitution[] | undefined,
	institutionId: string | null,
	communeName: string
): SwitcherTriggerDisplay {
	const selected = institutions?.find(
		(inst) => inst.institutionId === institutionId
	);
	if (selected && EPCI_TYPES.has(selected.institutionType)) {
		const label = INSTITUTION_TYPE_LABELS[selected.institutionType];
		if (!label) {
			// Anti-pattern: no silent fallback data. An EPCI type with no
			// French label is a real gap in institution-labels.ts, not
			// something to paper over with a generic "Intercommunalité".
			throw new Error(
				`[commune-switcher] No French label for EPCI institution type "${selected.institutionType}" — add it to INSTITUTION_TYPE_LABELS.`
			);
		}
		return {
			isEpci: true,
			label,
			name: selected.institutionName,
		};
	}
	return { isEpci: false, label: "Commune", name: communeName };
}

export interface InstitutionCorrection {
	institutionId: string;
	/** Always true: the detail panels (`crId`, `threadId`) must be cleared. */
	resetDetail: true;
}

/**
 * Decide whether the URL's `institutionId` must be rewritten once the
 * commune's institutions are known. Returns `null` when nothing must change.
 *
 * Covers both cases the original component handled with two effects:
 *  - `institutionId` absent → default to the commune's own council, else the
 *    first EPCI;
 *  - `institutionId` stale (carried over from a previous commune, so absent
 *    from the new commune's list) → same default.
 *
 * Call it when the institutions list arrives and whenever `institutionId`
 * changes. Apply the correction with a history `replace`, not a `push`.
 * Never write `null`: if the commune has no council and no EPCI, return null.
 */
export function resolveInstitutionId(
	institutions: SwitcherInstitution[] | undefined,
	institutionId: string | null
): InstitutionCorrection | null {
	if (!institutions || institutions.length === 0) {
		return null;
	}
	if (institutions.some((inst) => inst.institutionId === institutionId)) {
		return null;
	}
	const council = institutions.find(
		(inst) => inst.institutionType === "conseil_municipal"
	);
	const firstEpci = institutions.find((inst) =>
		EPCI_TYPES.has(inst.institutionType)
	);
	const fallback = council ?? firstEpci;
	if (!fallback) {
		return null;
	}
	return { institutionId: fallback.institutionId, resetDetail: true };
}
