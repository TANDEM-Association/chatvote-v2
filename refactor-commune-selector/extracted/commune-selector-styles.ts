// Tailwind class sets for the commune search field, copied verbatim from
// commune-selector.tsx so the port keeps the same look. "chat" is the purple
// surface, "plain" the neutral admin one; behavior is identical either way.
// Requires the theme tokens from source/packages/ui/src/styles/globals.css.

export type CommuneSelectorVariant = "chat" | "plain";

// Variant-scoped class strings. The "chat" set reproduces the original purple
// surface byte-for-byte; "plain" swaps in neutral admin tokens.
export const VARIANT_STYLES = {
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
