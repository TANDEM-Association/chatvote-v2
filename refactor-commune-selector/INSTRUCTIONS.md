# Mission : porter le sélecteur de commune de ChatVote dans cette app Astro

Tu es Claude Code, dans le dépôt de la **nouvelle app Astro**. Ce dossier (`refactor-commune-selector/`) vient du dépôt ChatVote (Next.js 16 / React 19 / tRPC / Drizzle). Il contient le code d'origine et des modules déjà extraits. Ton travail : reproduire la feature « sélecteur de commune dans l'en-tête » dans cette app, en suivant les conventions de **cette** app.

Ne copie pas le dossier tel quel dans `src/`. Il sert de matériau de référence. Une fois le portage fini et validé, il doit pouvoir être supprimé.

## 1. Contenu du dossier

| Chemin | Rôle | Statut |
|---|---|---|
| `SPEC.md` | Spécification du comportement (à lire en entier avant de coder) | Référence |
| `extracted/` | Modules TypeScript purs, sans framework, prêts à copier | **À copier** |
| `schema/commune-schema.ts` | Schéma Drizzle minimal (`communes`, `institutions`, `institution_communes`) | À copier **si** la nouvelle app a sa propre base |
| `seeds/data/` | Snapshot des 34 969 communes (`communes-all.json.gz` + `.meta.json` avec sha256) | À copier **si** base propre |
| `seeds/scripts/` | `seed-communes.ts` et `seed-epcis.ts` (corrigé pour le schéma actuel) | À adapter **si** base propre |
| `source/` | Fichiers d'origine, intacts, aux chemins d'origine | **Lecture seule, ne pas copier** |

Dans `extracted/` :
- `commune-code.ts` : validation du code INSEE (accepte aussi les codes corses `2A…`/`2B…`, ce que ChatVote ne fait pas).
- `institution-switcher.ts` : `EPCI_TYPES`, `resolveSwitcherTrigger` (identiques à l'original) et `resolveInstitutionId` (nouveau, remplace les deux `useEffect` d'origine).
- `institution-labels.ts`, `recent-communes.ts`, `cn.ts` : copies fidèles.
- `commune-selector-styles.ts` : classes Tailwind des variantes `chat` et `plain`, copiées de l'original.
- `institution-switcher.test.ts` : tests vitest pour `resolveSwitcherTrigger`, `resolveInstitutionId` et `isValidCommuneCode`.

## 2. Avant de coder : poser ces questions à l'utilisateur

Pose-les en une seule fois (avec l'outil de question si disponible), avec ta recommandation pour chacune :

1. **Framework de l'îlot interactif.** Recommandation : **React**, car `source/packages/ui/src/components/{popover,input,scroll-fade}.tsx` et les composants se portent presque tels quels. Sinon Preact (même API, plus léger), Solid ou Svelte (réécriture).
2. **Source de données.** Trois options :
   - (a) La nouvelle app a **sa propre base** : copie `schema/` et `seeds/`, puis écris les trois requêtes (section 5).
   - (b) Elle **appelle l'API ChatVote**. Attention : l'API d'origine est du tRPC servi sur `/api/trpc` en chemin relatif, et je n'ai trouvé aucune configuration CORS dans les fichiers que j'ai lus (`next.config.*`, middleware). Vérifie dans ChatVote avant de choisir cette voie ; elle exigera sans doute d'y activer CORS.
   - (c) Autre backend existant : demande son contrat.
3. **Analytics.** L'original envoie `commune_selected` avec `{ commune_code }` via PostHog. Quel outil utilise cette app ? (Rien, si la réponse est « aucun » : n'invente pas de dépendance.)
4. **Où vit l'en-tête** : quelle page ou quel layout Astro doit héberger le sélecteur, et quelle URL de base ? (L'original est sur `/chat`.)

## 3. Reconnaissance de l'app Astro (avant d'écrire)

Lis, sans supposer : `astro.config.*`, `package.json`, `tsconfig.json` (alias de chemins), la config Tailwind (v3 ou v4 ?), la config lint/format (Biome, ESLint, Prettier), le runner de tests, la structure de `src/`, les conventions de nommage, l'existence d'un composant Popover/Input déjà présent. Respecte ces conventions plutôt que celles de ChatVote (tabulations, noms de fichiers en kebab-case, etc. sont celles de ChatVote, pas forcément les tiennes).

## 4. Étapes

### Étape 1 — Modules purs
Copie `extracted/*.ts` dans l'arborescence de la nouvelle app (par exemple `src/lib/commune/`), corrige les imports relatifs, puis lance `institution-switcher.test.ts` avec le runner de l'app. Si l'app n'a pas de runner, propose d'ajouter vitest ; n'abandonne pas les tests. Ces tests n'ont pas pu être exécutés avec vitest côté ChatVote (pas de `node_modules` à ce moment) : la logique a seulement été vérifiée par un script Node équivalent. **Exécute-les : c'est la première vérification réelle.**

### Étape 2 — Thème et primitives UI
- `source/packages/ui/src/styles/globals.css` contient les variables de thème (`--background`, `--muted`, `--primary`, `--popover`…). Les classes de `commune-selector-styles.ts` en dépendent (`bg-muted`, `text-muted-foreground`, `bg-card`, `border-border`…). Reprends ces variables, ou mappe-les sur les tokens existants de l'app. Ne change pas les couleurs en silence : signale les écarts à l'utilisateur.
- Dépendances de l'original (`source/packages/ui/package.json`) : `@base-ui/react ^1.3.0`, `clsx ^2.1.1`, `tailwind-merge ^3.3.1`, `lucide-react`, `tw-animate-css`. Si l'app a déjà un Popover, un Input et un conteneur à fondus de défilement, utilise les siens.
- `scroll-fade.tsx` : conteneur de défilement avec fondus aux bords (utilise `forwardRef`, inutile en React 19 où `ref` est une prop).

### Étape 3 — Données
Selon la réponse à la question 2 :

**(a) Base propre.**
1. Copie `schema/commune-schema.ts` dans le schéma Drizzle de l'app (ou traduis-le dans son ORM).
2. Copie `seeds/data/*` et `seeds/scripts/seed-communes.ts`. Adapte l'import du schéma, le chemin du `.env` et le nom du script npm. Le script vérifie le sha256 du snapshot contre `communes-all.meta.json` : garde les deux fichiers ensemble. Il ne fait rien si la table contient déjà au moins autant de lignes que le snapshot.
3. `seed-epcis.ts` appelle `geo.api.gouv.fr` (réseau requis) pour créer les EPCI et leurs communes membres. Il a été corrigé dans ce dossier (`institution_municipalities` → `institution_communes`, `municipality_code` → `commune_code`) parce que la version d'origine était périmée depuis la migration 0023 de ChatVote. **Je ne l'ai pas exécuté.** Lance-le avec `--dry-run` d'abord.
4. Écris les trois requêtes décrites dans `SPEC.md` §6 : `search`, `getByCode`, `getInstitutions`. Le code de référence est `source/packages/api/src/routers/commune.ts` (lignes de `getByCode`, `search`, `getInstitutions` seulement ; le reste du fichier dépend du module `municipal-election`, ignore-le). Expose-les comme endpoints Astro (`src/pages/api/...`) ou actions Astro, avec validation des entrées (Zod ou équivalent).

**(b)/(c)** Écris un petit client `fetch` typé avec le contrat de `SPEC.md` §6.

Dans tous les cas, conserve ces règles de l'original : recherche à 2 caractères minimum et 100 maximum, 20 résultats maximum, une entrée par commune (préférer la ligne qui porte l'EPCI), validation du code INSEE avant toute requête.

### Étape 4 — État dans l'URL
Un seul module, qui lit et écrit `commune`, `institutionId`, `conseilView`, `crId`, `threadId`, `chat` dans la query string (`SPEC.md` §3). Règles :
- changement de commune → `commune=<code>`, `chat=null`, **`pushState`** ;
- changement d'institution → `institutionId=<id>`, `crId=null`, `threadId=null` ;
- correction automatique (`resolveInstitutionId`) → **`replaceState`** ;
- un paramètre `commune` invalide est retiré de l'URL (`replaceState`) et **jamais réaffiché dans le DOM**.

### Étape 5 — Composants
Réécris trois éléments en t'appuyant sur `source/` et `SPEC.md` §4–§5 :
1. **`CommuneSelector`** : champ de recherche (débounce 300 ms, minimum 2 caractères, résultats, états chargement/vide, récents, clic extérieur, bouton « Effacer »).
2. **`CommuneSwitcher`** : pastille + popover (section EPCI puis `CommuneSelector`, placeholder « Changer de commune… »).
3. **Barre de nav** : pastille à gauche, contrôles de vue à droite (optionnel, `source/.../conseil-nav-controls.tsx`).

Les parties interactives sont des îlots. La pastille est dans l'en-tête et doit être utilisable tout de suite, donc `client:load`. Le reste de la barre peut être rendu côté serveur par Astro.

Ne porte pas `source/apps/web/src/app/chat/page.tsx` : c'est la page de chat entière. Elle ne sert qu'à voir `handleCommuneSelect`, la validation du paramètre et l'effacement d'un paramètre invalide. De même `chat-start-flow.tsx` n'est utile que si l'utilisateur veut aussi l'écran de démarrage en 3 étapes.

### Étape 6 — Vérification
- Tests unitaires verts.
- Lint/format de l'app sans erreur sur les fichiers ajoutés.
- Lance l'app et teste dans un navigateur (Playwright ou l'outil d'aperçu disponible), pas seulement les types :
  1. taper « sai » → pas de requête ; « sain » → résultats après ~300 ms ;
  2. choisir une commune → l'URL change, le bouton retour revient à la précédente ;
  3. ouvrir le popover sur une commune qui a un EPCI → la section EPCI s'affiche ; en choisir un → la pastille passe en « libellé du type + nom de l'EPCI » ;
  4. changer de commune avec un `institutionId` d'une autre commune dans l'URL → il est remplacé sans ajouter d'entrée d'historique ;
  5. `?commune=abc` → retiré de l'URL, rien d'affiché ;
  6. `?commune=2A004` (Corse) → accepté ;
  7. récents : persistent après rechargement, 6 maximum, suppression individuelle ;
  8. clavier : le popover s'ouvre et se ferme, le focus est visible, les boutons ont un nom accessible ;
  9. mobile (largeur 375 px) : pas de défilement horizontal, popover à `max-w-[calc(100vw-2rem)]`.
- Dis explicitement à l'utilisateur ce que tu as vérifié et ce que tu n'as pas pu vérifier.

## 5. Règles à respecter

- **Pas de données de secours.** Ni liste de communes codée en dur, ni libellé générique pour un type d'institution inconnu : une erreur claire (`throw new Error`). Si le snapshot ou la base est absent, le seed s'arrête avec un message qui indique où trouver la vraie source.
- **Interface en français**, code et commentaires en anglais.
- **Une seule source de vérité** pour la commune et l'institution : l'URL. Pas d'état local dupliqué.
- **Entrées bornées** côté serveur : longueur de la recherche (2 à 100), format du code INSEE.
- **`localStorage`** : lecture et écriture dans `try/catch`, seulement après le montage côté client.
- N'introduis aucune dépendance sans la signaler à l'utilisateur.
- Les conventions de **ChatVote** (protocole Haft, Ultracite, `@chatvote/ui`, tRPC, nuqs) **ne s'appliquent pas** à cette app. Ne les recrée pas.

## 6. Défauts et pièges connus de l'original

| Sujet | Détail | Action |
|---|---|---|
| Codes corses | ChatVote valide avec `/^\d{5}$/`, ce qui rejette 360 communes corses (`2A004`…) présentes dans son propre snapshot | `extracted/commune-code.ts` corrige ; applique la même regex dans les entrées de l'API |
| `seed-epcis.ts` d'origine | Utilisait d'anciens noms de table et de colonne | Déjà corrigé dans `seeds/scripts/` ; non exécuté |
| Types d'EPCI | La recherche ne joint que `communaute_de_communes`, `agglomeration`, `syndicat` ; le switcher en reconnaît 5. Cohérent avec les données seedées (voir `SPEC.md` §6) | Ne pas « corriger » sans demander |
| Recherche `ilike '%terme%'` | Les index d'origine sont des index btree sur `name` et `commune_code`, qui ne servent pas pour `%terme%` | Optionnel : index `pg_trgm` si la recherche est lente. À mesurer d'abord |
| Libellés EPCI | Une commune dans une métropole n'a pas de badge « EPCI » dans la recherche (conséquence du point sur les types) | Comportement d'origine, à conserver sauf demande |

## 7. Ce qui n'a pas été vérifié côté ChatVote

- Les tests vitest d'`extracted/` n'ont pas été exécutés avec vitest.
- `seed-communes.ts` (copié tel quel) et `seed-epcis.ts` (corrigé) n'ont pas été exécutés.
- `schema/commune-schema.ts` n'a pas été comparé par génération de migration à une base réelle.
- Le comportement visuel et interactif décrit vient de la lecture du code, pas d'une exécution.
- `chat-start-flow.tsx` n'a été lu qu'en partie.

## 8. Fin de mission

Quand tout est validé, résume à l'utilisateur : fichiers créés, dépendances ajoutées, écarts par rapport à ChatVote (au minimum les codes corses), points non vérifiés. Propose de supprimer `refactor-commune-selector/` du dépôt, et ne le supprime pas sans accord.
