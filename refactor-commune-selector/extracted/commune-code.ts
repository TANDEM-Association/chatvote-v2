// INSEE commune codes are five characters: five digits (e.g. 75056 for Paris),
// or "2A"/"2B" followed by three digits for Corsica (e.g. 2A004). Anything
// else in the `?commune=` query string is untrusted input — never render it
// raw, never use it as a DB key.
//
// DIVERGES FROM THE ORIGINAL on purpose: ChatVote validates with /^\d{5}$/,
// which rejects the 360 Corsican communes present in its own seed snapshot
// (data/seeds/communes-all.json.gz). Keep the same widening in the API input
// schemas of the new app, or those communes stay unreachable.
export const INSEE_COMMUNE_CODE_REGEX = /^(?:\d{5}|2[AB]\d{3})$/;

export function isValidCommuneCode(
	value: string | null | undefined
): value is string {
	return typeof value === "string" && INSEE_COMMUNE_CODE_REGEX.test(value);
}
