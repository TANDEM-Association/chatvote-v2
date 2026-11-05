"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@chatvote/ui/components/popover";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronDown, MapPin } from "lucide-react";
import { parseAsString, useQueryStates } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { INSTITUTION_TYPE_LABELS } from "@/lib/conseil/institution-labels";
import { trpc } from "@/utils/trpc";

import { CommuneSelector } from "./commune-selector";

// Same nuqs keys ConseilView / ConseilNavControls read. Selecting an EPCI
// writes the same `institutionId` the content renders from; `crId`/`threadId`
// are cleared so the detail panels don't survive an institution switch.
const navParams = {
	crId: parseAsString,
	threadId: parseAsString,
	institutionId: parseAsString,
};

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

interface SwitcherTriggerDisplay {
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

interface CommuneSwitcherProps {
	communeCode: string;
	communeName: string;
	onSelect: (communeCode: string, communeName: string) => void;
}

/**
 * Single far-left entry point: the selected commune is a clickable pill whose
 * dropdown lists the commune's intercommunalité (EPCI / communauté de
 * communes) at the top, then the commune search below. Replaces the previous
 * two-dropdown layout (commune switcher + separate institution picker).
 */
export function CommuneSwitcher({
	communeCode,
	communeName,
	onSelect,
}: CommuneSwitcherProps) {
	const [open, setOpen] = useState(false);
	const [params, setParams] = useQueryStates(navParams);
	const { institutionId } = params;

	const { data: institutions } = useQuery(
		trpc.commune.getInstitutions.queryOptions({ communeCode })
	);
	// useMemo keeps the EPCI list referentially stable — it is in two effect
	// dep arrays below, and a fresh array every render would re-fire both.
	const epcis = useMemo(
		() =>
			(institutions ?? []).filter((inst) =>
				EPCI_TYPES.has(inst.institutionType)
			),
		[institutions]
	);
	const councilId = (institutions ?? []).find(
		(inst) => inst.institutionType === "conseil_municipal"
	)?.institutionId;

	// Default the institution to the commune's own council, then to the first
	// EPCI. Must run while the query is loading (firstId is null then) so the
	// dep array covers both; guard against a missing list to avoid writing null.
	useEffect(() => {
		if (!institutionId) {
			const fallback = councilId ?? epcis[0]?.institutionId ?? null;
			if (fallback) {
				setParams({ institutionId: fallback });
			}
		}
	}, [institutionId, councilId, epcis, setParams]);

	// Reset a stale institutionId carried over from a previous commune (URL state
	// survives the commune switch; the new commune's list won't contain it).
	useEffect(() => {
		if (!institutions || institutions.length === 0) {
			return;
		}
		if (!institutions.some((inst) => inst.institutionId === institutionId)) {
			const fallback = councilId ?? epcis[0]?.institutionId;
			if (fallback) {
				setParams({ institutionId: fallback, crId: null, threadId: null });
			}
		}
	}, [institutions, institutionId, councilId, epcis, setParams]);

	const selectInstitution = (id: string) => {
		setParams({ institutionId: id, crId: null, threadId: null });
		setOpen(false);
	};

	const trigger = resolveSwitcherTrigger(
		institutions,
		institutionId,
		communeName
	);

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger className="flex h-11 min-w-0 items-center gap-2.5 rounded-xl border border-border/50 bg-muted/20 pr-2.5 pl-3 text-left transition-colors hover:border-purple-400/40 hover:bg-purple-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50">
				{trigger.isEpci ? (
					<Building2 className="size-4 shrink-0 text-purple-400" />
				) : (
					<MapPin className="size-4 shrink-0 text-purple-400" />
				)}
				<span className="flex min-w-0 flex-col leading-tight">
					<span className="text-[10px] text-muted-foreground uppercase tracking-wide">
						{trigger.label}
					</span>
					<span className="truncate font-medium text-foreground text-sm">
						{trigger.name}
					</span>
				</span>
				<ChevronDown
					className={`size-4 shrink-0 text-muted-foreground transition-transform ${
						open ? "rotate-180" : ""
					}`}
				/>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-80 max-w-[calc(100vw-2rem)] p-2"
			>
				{epcis.length > 0 && (
					<>
						<p className="px-2 pt-1 pb-1.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
							Communauté de communes
						</p>
						<ul className="mb-1.5 flex flex-col gap-0.5">
							{epcis.map((inst) => (
								<li key={inst.institutionId}>
									<button
										aria-current={
											institutionId === inst.institutionId ? "true" : undefined
										}
										className={[
											"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
											institutionId === inst.institutionId
												? "bg-primary/10 font-medium text-primary"
												: "text-foreground/80 hover:bg-muted hover:text-foreground",
										].join(" ")}
										onClick={() => selectInstitution(inst.institutionId)}
										type="button"
									>
										<Building2 className="size-4 shrink-0 opacity-70" />
										<span className="truncate">
											{inst.institutionName ?? inst.institutionId}
										</span>
									</button>
								</li>
							))}
						</ul>
					</>
				)}
				<CommuneSelector
					onSelect={(code, name) => {
						setOpen(false);
						onSelect(code, name);
					}}
					placeholder="Changer de commune…"
				/>
			</PopoverContent>
		</Popover>
	);
}
