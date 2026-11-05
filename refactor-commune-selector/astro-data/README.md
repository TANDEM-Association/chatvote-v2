# astro-data — communes, institutions, disponibilité du chat

Matériau prêt à copier dans l'app Astro (adapte les chemins d'import).

| Fichier | Rôle |
|---|---|
| `schema.ts` | Tables `communes`, `institutions`, `institution_communes`. `chat_available` (défaut `false`) sur les deux premières ; `institutions.siren` unique. |
| `queries.ts` | Recherche, lecture, et `getCommuneAvailability` / `getInstitutionAvailability` (source de vérité unique). |
| `scripts/seed-communes.ts` | Snapshot geo.api.gouv.fr (34 969 communes) → `communes`. Ne touche **pas** `chat_available`. |
| `scripts/seed-epcis.ts` | EPCI + appartenances. Upsert par SIREN ; préserve `chat_available`. |
| `scripts/set-availability.ts` | CLI admin : `commune 69123 on`, `institution <siren> off`, `list`. |

Dépendances : `../extracted/commune-code.ts` (regex INSEE avec Corse), les données
`../seeds/data/`. Le seed communes lit le snapshot via `../../seeds/data/` : ajuste si tu déplaces les fichiers.

## Mise en route

```sh
# schéma : drizzle-kit generate && drizzle-kit migrate
bun scripts/seed-communes.ts          # d'abord (clé étrangère)
bun scripts/seed-epcis.ts             # ensuite
bun scripts/set-availability.ts commune 69123 on     # Lyon
bun scripts/set-availability.ts commune 33063 on     # Bordeaux
bun scripts/set-availability.ts commune 63396 on     # Saint-Saturnin (cf. manifest.json)
bun scripts/set-availability.ts list
```

Les 3 codes ci-dessus viennent de `data/seeds/manifest.json` de ChatVote : remplace-les
par tes 3 communes réelles.

## Page chat (SSR obligatoire)

`src/pages/chat/[communeCode].astro` — le contrôle doit tourner côté serveur
(`output: "server"` ou `export const prerender = false`).

```astro
---
export const prerender = false;
import { getCommuneAvailability } from "../../lib/queries";
import { db } from "../../lib/db";

const availability = await getCommuneAvailability(db, Astro.params.communeCode ?? "");

if (availability.status === "unknown") {
  return new Response(null, { status: 404 });
}
if (availability.status === "unavailable") {
  return Astro.rewrite(`/indisponible?commune=${encodeURIComponent(Astro.params.communeCode!)}`);
}
---
<!-- status === "available" : le chat -->
```

Si ton chat a un endpoint API, appelle **le même** `getCommuneAvailability` dedans
(sinon l'URL de l'API contourne la page).

## Décisions à connaître

- **Défaut `false`** : rien n'est ouvert tant que l'admin ne l'a pas décidé.
- **Re-seed sans risque** : les deux seeds n'écrivent jamais `chat_available`.
- **Commune vs institution** : les deux drapeaux sont indépendants. Activer un EPCI n'active pas
  ses communes (et inversement). Si tu veux une règle de cascade, dis-le : c'est une décision métier.
- **Recherche** : disponibles d'abord, puis population. `%`, `_`, `\` de la saisie sont échappés.
  Pour une recherche insensible aux accents, ajoute `pg_trgm` + `unaccent` plus tard.
- **Types d'institution** réduits à 5 (EPCI + syndicat). `conseil_municipal` et les autres de
  ChatVote ne sont pas repris : ajoute-les à l'enum si tu en as besoin.
- **`seed-epcis`** échoue sur un type EPCI inconnu et signale les membres dont la commune est absente.
- Rien de tout ceci n'a été exécuté : pas de base ni d'app Astro ici. À typer et tester chez toi.
