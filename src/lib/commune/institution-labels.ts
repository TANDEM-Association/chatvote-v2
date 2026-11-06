// Libellés français des types d'institution. Source unique : aucun composant
// ne recopie ces libellés. Seuls les types réellement utilisés ici sont listés
// (le conseil municipal et les intercommunalités) ; en ajouter un si besoin.
//
// Un type absent de cette table est une erreur (voir resolveSwitcherTrigger) :
// pas de libellé générique de secours.

export const INSTITUTION_TYPE_LABELS: Record<string, string> = {
  conseil_municipal: "Conseil municipal",
  communaute_de_communes: "Communauté de communes",
  syndicat: "Syndicat",
  agglomeration: "Agglomération",
  communaute_urbaine: "Communauté urbaine",
  metropole: "Métropole",
};
