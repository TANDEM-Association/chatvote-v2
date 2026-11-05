"use client";

import { Input } from "@chatvote/ui/components/input";
import { ScrollFade } from "@chatvote/ui/components/scroll-fade";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { trackClientEvent } from "@/lib/observability/logger-client";
import {
	addRecentCommune,
	getRecentCommunes,
	type RecentCommune,
	removeRecentCommune,
} from "@/lib/recent-communes";
import { trpc } from "@/utils/trpc";

type CommuneSelectorVariant = "chat" | "plain";

interface CommuneSelectorProps {
	autoFocus?: boolean;
	onSelect: (communeCode: string, communeName: string) => void;
	placeholder?: string;
	/**
	 * Visual style. "chat" (default) keeps the purple-pill chat surface; "plain"
	 * renders neutral admin styling using border/bg/muted tokens. Behavior
	 * (debounced search, recents, ScrollFade dropdown) is identical either way.
	 */
	variant?: CommuneSelectorVariant;
}

// Variant-scoped class strings. The "chat" set reproduces the original purple
// surface byte-for-byte; "plain" swaps in neutral admin tokens.
const VARIANT_STYLES = {
	chat: {
		input:
			"rounded-3xl border-purple-400/30 bg-purple-500/50 px-5 py-3 pr-11 pl-11 placeholder:text-muted-foreground/70 focus-visible:border-purple-400/60 focus-visible:ring-purple-400/30",
		panel:
			"absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-purple-400/20 bg-card shadow-black/20 shadow-lg",
		message:
			"absolute z-50 mt-2 w-full rounded-2xl border border-purple-400/20 bg-card px-4 py-3 text-muted-foreground text-sm shadow-black/20 shadow-lg",
		option:
			"mx-1 flex w-[calc(100%-8px)] w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm transition-colors hover:bg-purple-500/20 hover:text-foreground",
		recentOption:
			"mx-1 flex w-[calc(100%-8px)] items-center gap-3 rounded-xl px-4 py-2.5 pr-10 text-left text-sm transition-colors hover:bg-purple-500/20 hover:text-foreground",
		recentRemove:
			"absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-purple-500/20 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100",
		epci: "w-fit rounded px-1 py-0.5 text-[10px] text-purple-400 leading-none ring-1 ring-purple-400/40 hover:bg-purple-400/10 hover:text-purple-300",
	},
	plain: {
		input:
			"rounded-md border-input bg-background px-3 py-2 pr-10 pl-10 placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-ring/30",
		panel:
			"absolute z-50 mt-2 w-full overflow-hidden rounded-md border border-border bg-card shadow-black/20 shadow-lg",
		message:
			"absolute z-50 mt-2 w-full rounded-md border border-border bg-card px-4 py-3 text-muted-foreground text-sm shadow-black/20 shadow-lg",
		option:
			"mx-1 flex w-[calc(100%-8px)] w-full items-center gap-3 rounded-md px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted hover:text-foreground",
		recentOption:
			"mx-1 flex w-[calc(100%-8px)] items-center gap-3 rounded-md px-4 py-2.5 pr-10 text-left text-sm transition-colors hover:bg-muted hover:text-foreground",
		recentRemove:
			"absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100",
		epci: "w-fit rounded px-1 py-0.5 text-[10px] text-muted-foreground leading-none ring-1 ring-border hover:bg-muted hover:text-foreground",
	},
} as const;

export function CommuneSelector({
	autoFocus = false,
	onSelect,
	placeholder = "Rechercher votre commune ou code postal...",
	variant = "chat",
}: CommuneSelectorProps) {
	const styles = VARIANT_STYLES[variant];
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [focused, setFocused] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const [recents, setRecents] = useState<RecentCommune[]>([]);

	useEffect(() => {
		setRecents(getRecentCommunes());
	}, []);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(query);
		}, 300);
		return () => clearTimeout(timer);
	}, [query]);

	const { data: results, isLoading } = useQuery(
		trpc.commune.search.queryOptions(
			{ query: debouncedQuery },
			{ enabled: debouncedQuery.length >= 2 }
		)
	);

	useEffect(() => {
		setOpen(debouncedQuery.length >= 2 && (results?.length ?? 0) > 0);
	}, [results, debouncedQuery]);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setOpen(false);
				setFocused(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleSelect = (communeCode: string, communeName: string) => {
		setRecents(addRecentCommune(communeCode, communeName));
		setQuery("");
		setOpen(false);
		setFocused(false);
		trackClientEvent("commune_selected", { commune_code: communeCode });
		onSelect(communeCode, communeName);
	};

	return (
		<div className="relative w-full" ref={containerRef}>
			<div className="relative">
				<Search className="absolute top-1/2 left-5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					autoComplete="off"
					autoFocus={autoFocus}
					className={styles.input}
					onChange={(e) => setQuery(e.target.value)}
					onFocus={() => setFocused(true)}
					placeholder={placeholder}
					value={query}
				/>
				{query && (
					<button
						className="absolute top-1/2 right-5 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
						onClick={() => setQuery("")}
						type="button"
					>
						<X size={14} />
						<span className="sr-only">Effacer</span>
					</button>
				)}
			</div>

			{open && results && results.length > 0 && (
				<div className={styles.panel}>
					<ScrollFade className="max-h-64 py-1.5">
						<ul>
							{results.map((commune) => (
								<li
									key={`${commune.communeCode}-${commune.epci?.id ?? "none"}`}
								>
									<button
										className={styles.option}
										onClick={() =>
											handleSelect(commune.communeCode, commune.name)
										}
										type="button"
									>
										<MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
										<div className="flex flex-col gap-0.5">
											<span className="font-medium">{commune.name}</span>
											<span className="text-muted-foreground text-xs">
												{/* Skip department name when it duplicates commune.name
											   (Paris, Lyon, Marseille = city is its own department). */}
												{commune.departmentName &&
												commune.departmentName !== commune.name
													? `${commune.departmentName} — `
													: ""}
												{commune.communeCode}
												{commune.postalCodes &&
												(commune.postalCodes as string[]).length > 0
													? ` (${(commune.postalCodes as string[])[0]})`
													: ""}
											</span>
											{commune.epci && (
												<a
													className={styles.epci}
													href={`/conseils/institution/${commune.epci.id}`}
													onClick={(e) => e.stopPropagation()}
													rel="noopener"
												>
													EPCI : {commune.epci.name}
												</a>
											)}
										</div>
									</button>
								</li>
							))}
						</ul>
					</ScrollFade>
				</div>
			)}

			{isLoading && debouncedQuery.length >= 2 && (
				<div className={styles.message}>Recherche en cours...</div>
			)}

			{!isLoading &&
				debouncedQuery.length >= 2 &&
				(results?.length ?? 0) === 0 && (
					<div className={styles.message}>
						Aucune commune trouvée pour « {debouncedQuery} »
					</div>
				)}

			{focused && query.trim() === "" && recents.length > 0 && (
				<div className={styles.panel}>
					<p className="px-4 pt-2.5 pb-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
						Récemment consultées
					</p>
					<ScrollFade className="max-h-64 pb-1.5">
						<ul>
							{recents.map((r) => (
								<li className="group relative" key={r.communeCode}>
									<button
										className={styles.recentOption}
										onClick={() => handleSelect(r.communeCode, r.name)}
										type="button"
									>
										<MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
										<div className="flex flex-col gap-0.5">
											<span className="font-medium">{r.name}</span>
											<span className="text-muted-foreground text-xs">
												{r.communeCode}
											</span>
										</div>
									</button>
									<button
										aria-label={`Retirer ${r.name} des récents`}
										className={styles.recentRemove}
										onClick={(e) => {
											e.stopPropagation();
											setRecents(removeRecentCommune(r.communeCode));
										}}
										title={`Retirer ${r.name} des récents`}
										type="button"
									>
										<X size={14} />
									</button>
								</li>
							))}
						</ul>
					</ScrollFade>
				</div>
			)}
		</div>
	);
}
