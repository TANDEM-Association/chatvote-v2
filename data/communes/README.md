# Snapshot des communes

- `communes-all.json.gz` : toutes les communes de France (34 969), copie figée de l'API geo.api.gouv.fr.
- `communes-all.meta.json` : URL source, date de récupération, nombre de communes et **sha256 du fichier compressé**.

Le build (`pnpm build:data`) vérifie le sha256 et le nombre de communes, puis s'arrête avec un message clair si le fichier est absent, altéré ou invalide. Il n'y a aucune liste de secours.

## Mettre à jour le snapshot

1. Télécharger l'URL de `sourceUrl` (champ du fichier `.meta.json`), puis compresser la réponse en gzip vers `communes-all.json.gz`.
2. Mettre à jour dans `communes-all.meta.json` : `retrievedAt`, `count` (nombre de communes) et `sha256` (`shasum -a 256 communes-all.json.gz`).
3. Lancer `pnpm build:data` et `pnpm test` : les tests vérifient les anomalies (codes mal formés, doublons, départements manquants) et la cohérence de `src/data/availability.ts`.
