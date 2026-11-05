// Recently visited communes, persisted per browser in localStorage. Works for
// anonymous sessions (no account needed) — the common case for ChatVote.

const STORAGE_KEY = "chatvote.recentCommunes";
const MAX_RECENTS = 6;

export interface RecentCommune {
	communeCode: string;
	name: string;
}

function isRecentCommune(value: unknown): value is RecentCommune {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as RecentCommune).communeCode === "string" &&
		typeof (value as RecentCommune).name === "string"
	);
}

export function getRecentCommunes(): RecentCommune[] {
	if (typeof window === "undefined") {
		return [];
	}
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return [];
		}
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter(isRecentCommune).slice(0, MAX_RECENTS);
	} catch {
		return [];
	}
}

/**
 * Prepend a commune to the recents list (most-recent-first, deduped by code,
 * capped). Returns the new list so callers can update local state.
 */
export function addRecentCommune(
	communeCode: string,
	name: string
): RecentCommune[] {
	if (typeof window === "undefined") {
		return [];
	}
	const next = [
		{ communeCode, name },
		...getRecentCommunes().filter((c) => c.communeCode !== communeCode),
	].slice(0, MAX_RECENTS);
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		// localStorage unavailable or over quota — recents are best-effort.
		return next;
	}
	return next;
}

/**
 * Remove a commune from the recents list. Returns the new list so callers can
 * update local state.
 */
export function removeRecentCommune(communeCode: string): RecentCommune[] {
	if (typeof window === "undefined") {
		return [];
	}
	const next = getRecentCommunes().filter((c) => c.communeCode !== communeCode);
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		return next;
	}
	return next;
}
