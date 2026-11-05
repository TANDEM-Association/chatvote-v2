"use client";

import { FileText, MessageSquare } from "lucide-react";
import { parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";

// Same nuqs keys ConseilView reads — URL is the single source of truth, so these
// controls (lifted into the tab bar) and the content stay in sync. The
// institution picker moved into CommuneSwitcher (single far-left dropdown);
// here we only keep the view toggle.
const navParams = {
	crId: parseAsString,
	threadId: parseAsString,
	institutionId: parseAsString,
	conseilView: parseAsStringEnum(["list", "chat"]).withDefault("list"),
};

function viewButtonClass(active: boolean): string {
	return [
		"flex h-full items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs transition-colors",
		"outline-none focus-visible:ring-1 focus-visible:ring-ring/50",
		active
			? "bg-background font-medium text-foreground shadow-sm"
			: "text-muted-foreground hover:text-foreground",
	].join(" ");
}

/**
 * Right-aligned councils controls: the Comptes rendus / Assistant IA view toggle.
 * Owns no institution logic — that lives in CommuneSwitcher now.
 */
export function ConseilNavControls() {
	const [params, setParams] = useQueryStates(navParams);
	const { conseilView } = params;

	return (
		<div className="ml-auto flex items-center gap-2">
			<fieldset className="m-0 flex h-11 items-center gap-0.5 rounded-lg border border-border/50 bg-muted/20 p-0.5">
				<legend className="sr-only">Affichage</legend>
				<button
					aria-label="Comptes rendus"
					aria-pressed={conseilView === "list"}
					className={viewButtonClass(conseilView === "list")}
					onClick={() => setParams({ conseilView: "list" })}
					type="button"
				>
					<FileText className="size-3.5" />
					{/* Text hidden below sm so the header never forces horizontal
					    scroll on narrow phones; aria-label keeps it accessible. */}
					<span className="hidden sm:inline">Comptes rendus</span>
				</button>
				<button
					aria-label="Assistant IA"
					aria-pressed={conseilView === "chat"}
					className={viewButtonClass(conseilView === "chat")}
					onClick={() => setParams({ conseilView: "chat" })}
					type="button"
				>
					<MessageSquare className="size-3.5" />
					<span className="hidden sm:inline">Assistant IA</span>
				</button>
			</fieldset>
		</div>
	);
}
