// French display labels for `institutions.type` (institutionTypeEnum).
// Kept as its own file so labels have a single source of truth instead of
// being duplicated in every component that renders an institution.

export const INSTITUTION_TYPE_LABELS: Record<string, string> = {
	assemblee_nationale: "Assemblée nationale",
	senat: "Sénat",
	conseil_municipal: "Conseil municipal",
	gouvernement: "Gouvernement",
	region: "Région",
	departement: "Département",
	europe: "Europe",
	communaute_de_communes: "Communauté de communes",
	syndicat: "Syndicat",
	agglomeration: "Agglomération",
	communaute_urbaine: "Communauté urbaine",
	metropole: "Métropole",
};
