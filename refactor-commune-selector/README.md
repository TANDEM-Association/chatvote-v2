# refactor-commune-selector

Kit de portage du **sélecteur de commune** de ChatVote (Next.js) vers une app Astro.

## Utilisation

1. Déplacez ce dossier à la racine du nouveau dépôt (par exemple `mv refactor-commune-selector ../mon-app-astro/`).
2. Ouvrez Claude Code dans le nouveau dépôt et donnez-lui :

   > Lis `refactor-commune-selector/INSTRUCTIONS.md` et exécute la mission.

3. Claude vous posera 4 questions avant de coder (framework de l'îlot, source de données, analytics, emplacement de l'en-tête).
4. Quand le portage est validé, supprimez le dossier.

## Contenu

| Chemin | Rôle |
|---|---|
| `INSTRUCTIONS.md` | Mission pas à pas, pour Claude Code |
| `CLAUDE.md` | Court rappel chargé automatiquement quand Claude travaille dans ce dossier |
| `SPEC.md` | Spécification du comportement (état URL, pastille, recherche, contrat d'API) |
| `extracted/` | Modules TypeScript purs et leurs tests, prêts à copier |
| `schema/` | Schéma Drizzle minimal (3 tables) |
| `seeds/` | Snapshot de 34 969 communes (547 Ko) et scripts de seed |
| `source/` | Fichiers d'origine de ChatVote, intacts, pour référence |

## Ce qui est volontairement différent de ChatVote

- `extracted/commune-code.ts` accepte les codes corses (`2A004`, `2B033`). ChatVote les rejette (regex `/^\d{5}$/`), ce qui rend 360 communes inaccessibles chez lui.
- `seeds/scripts/seed-epcis.ts` utilise les noms de table et de colonne actuels. La version d'origine était périmée.
- `extracted/institution-switcher.ts` contient `resolveInstitutionId`, une fonction pure qui remplace deux `useEffect` React.

## Limites

Les tests de `extracted/` n'ont pas été lancés avec vitest (pas de dépendances installées dans l'environnement où le kit a été préparé). La logique a été vérifiée par un script Node équivalent. Les scripts de seed n'ont pas été exécutés. La liste complète figure à la section 7 de `INSTRUCTIONS.md`.

`source/` contient du code qui dépend de packages ChatVote (`@chatvote/ui`, tRPC, nuqs). Il n'est pas fait pour compiler dans la nouvelle app.
