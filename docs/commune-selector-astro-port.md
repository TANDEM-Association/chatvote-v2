# Sélecteur de commune ChatVote — spécification pour un portage Astro

Source : `better-chatvote` (Next.js 16 / React 19 / tRPC / nuqs / Drizzle).
Cible : application Astro. Ce document décrit le comportement à reproduire, pas le code React à copier.

## 1. Ce que fait la feature

Dans l'en-tête, une pastille affiche la commune courante (« COMMUNE · Saint-Saturnin ▾ »). Un clic ouvre un popover qui contient :

1. **Les EPCI de la commune** (communauté de communes, agglomération, syndicat, communauté urbaine, métropole) : un clic change l'institution affichée.
2. **Un champ de recherche** « Changer de commune… » : recherche par nom ou code postal, avec les communes récemment consultées.

Choisir une commune change la commune de toute la page. Choisir un EPCI change seulement l'institution affichée.

## 2. Découpage des composants

```
CommuneTabs            wrapper de la barre de nav : slot gauche + contrôles à droite
├─ CommuneSwitcher     pastille + popover (EPCI + recherche)
│   └─ CommuneSelector champ de recherche réutilisable (aussi utilisé dans l'écran de démarrage)
└─ ConseilNavControls  bascule « Comptes rendus / Assistant IA » (hors périmètre, même état URL)
```

Fichiers d'origine (dans `apps/web/src/`) :

| Rôle | Fichier |
|---|---|
| Intégration + handler de sélection | `app/chat/page.tsx` (`handleCommuneSelect`, ~l.212) |
| Barre de nav | `components/conseil/commune-tabs.tsx` |
| Pastille + popover | `components/chat/commune-switcher.tsx` |
| Recherche | `components/chat/commune-selector.tsx` |
| Récents (localStorage) | `lib/recent-communes.ts` |
| Libellés des types d'institution | `lib/conseil/institution-labels.ts` |
| API | `packages/api/src/routers/commune.ts` (`search`, `getInstitutions`) |

## 3. État : l'URL est la source de vérité

Aucune de ces valeurs n'est dupliquée dans un état local. Elles vivent dans la query string (via `nuqs` dans l'app d'origine) :

| Clé | Rôle |
|---|---|
| `commune` | code INSEE à 5 chiffres (validé `/^\d{5}$/`) |
| `institutionId` | institution affichée (conseil municipal ou EPCI) |
| `conseilView` | `list` (défaut) ou `chat` |
| `crId`, `threadId` | panneaux de détail, remis à `null` au changement d'institution |
| `chat` | identifiant de session de chat, remis à `null` au changement de commune |

**Règles d'écriture :**
- Changement de commune : écrire `commune=<code>` et `chat=null`, avec `history: "push"` pour que le bouton retour du navigateur revienne à la commune précédente.
- Changement d'institution : écrire `institutionId=<id>`, `crId=null`, `threadId=null`, puis fermer le popover.

**Pour Astro :** utiliser `URLSearchParams` + `history.pushState` / `replaceState` dans un petit module partagé, ou `nanostores` synchronisé avec l'URL (`@nanostores/router` ou un store maison). Le point à préserver est qu'il n'y ait qu'une seule source de vérité, lue par la pastille et par les contrôles de vue.

## 4. Comportement de la pastille (`CommuneSwitcher`)

**Affichage fermé** (fonction pure `resolveSwitcherTrigger`) :
- Si l'institution sélectionnée est un EPCI : icône immeuble, libellé = type d'EPCI en français, nom = nom de l'EPCI.
- Sinon : icône épingle, libellé « Commune », nom = nom de la commune.
- Si un type d'EPCI n'a pas de libellé français, **lever une erreur**. Pas de libellé générique de secours (règle du projet : jamais de fallback silencieux).

**Types d'EPCI reconnus :** `communaute_de_communes`, `agglomeration`, `syndicat`, `communaute_urbaine`, `metropole`. Le type `conseil_municipal` est le conseil de la commune elle-même, qui est la vue par défaut ; il n'est pas listé dans la section EPCI.

**Sélection par défaut de l'institution**, à appliquer quand `institutionId` est absent : le `conseil_municipal`, sinon le premier EPCI. Si la liste est vide ou en cours de chargement, ne rien écrire (ne jamais écrire `null`).

**Institution périmée :** l'URL survit au changement de commune, mais la liste des institutions de la nouvelle commune ne contient plus l'ancien `institutionId`. Quand la liste est chargée, si l'`institutionId` courant n'y figure pas, le remplacer par la valeur par défaut et remettre `crId` et `threadId` à `null`.

**Accessibilité :** la pastille est un `PopoverTrigger` (bouton), la ligne EPCI active porte `aria-current="true"`, et le chevron pivote à 180° quand le popover est ouvert.

## 5. Comportement de la recherche (`CommuneSelector`)

- Saisie **débouncée à 300 ms** ; la requête n'est envoyée qu'à partir de **2 caractères**.
- Pas de résultat → message « Aucune commune trouvée pour « … » ». Pendant le chargement → « Recherche en cours... ».
- Un résultat affiche : nom, département (omis s'il est identique au nom : Paris, Lyon, Marseille), code INSEE, premier code postal entre parenthèses, et un lien « EPCI : … » vers `/conseils/institution/<epciId>` (avec `stopPropagation` pour ne pas déclencher la sélection).
- Clic en dehors du composant : fermer la liste et retirer le focus.
- Bouton « Effacer » quand le champ n'est pas vide.
- **Récents :** à la sélection, la commune est ajoutée en tête de liste (dédupliquée par code, **6 maximum**) dans `localStorage` sous la clé `chatvote.recentCommunes`, au format `[{ communeCode, name }]`. La liste s'affiche quand le champ a le focus et est vide. Chaque entrée a un bouton de suppression (`aria-label="Retirer <nom> des récents"`).
  - Lecture et écriture protégées par `try/catch`, et par un test `typeof window` (SSR). Les entrées sont validées par un type guard.
  - Le chargement des récents se fait dans un `useEffect` (donc après l'hydratation), pour éviter un écart entre le rendu serveur et le client.
- À chaque sélection : événement analytics `commune_selected` avec `{ commune_code }`.
- Deux variantes de style (`chat` violet, `plain` neutre) : même comportement. Utile seulement si vous gardez deux surfaces.

## 6. Contrat d'API à reproduire

Les deux procédures sont publiques (pas d'authentification).

### `commune.search`
- **Entrée :** `{ query: string }`, 2 à 100 caractères, `trim()` côté serveur.
- **Sortie :** liste de communes avec `communeCode`, `name`, `departmentCode`, `departmentName`, `regionName`, `postalCodes` (tableau), `epci?: { id, name }`.
- **Requête :** `communes` en `LEFT JOIN institution_communes` puis `LEFT JOIN institutions`, ce dernier filtré sur **trois** types seulement : `communaute_de_communes`, `agglomeration`, `syndicat`. (Le switcher en reconnaît cinq, car `communaute_urbaine` et `metropole` s'y ajoutent ; ils n'apparaissent donc jamais comme badge « EPCI » dans les résultats de recherche. Ce n'est pas un bug en pratique : `scripts/seed-epcis.ts` mappe `CC` → `communaute_de_communes` et `CA`/`CU`/`METRO`/`MET69` → `agglomeration`, donc les données seedées ne contiennent jamais `communaute_urbaine` ni `metropole`. Le type `syndicat` n'est produit par aucun script de ce dossier.)
- **Filtre :** `ilike` sur le nom (`%terme%`), `ilike` sur le code INSEE (préfixe `terme%`), et `ilike` sur `postal_codes::text` (`%terme%`). La recherche couvre donc le nom, le code INSEE et le code postal.
- **Limite :** 20 lignes SQL, avant dédoublonnage.
- **Dédoublonnage côté serveur :** les jointures produisent une ligne par appartenance à une institution. Une commune avec son conseil municipal et un EPCI apparaît deux fois, dont une ligne sans EPCI. Le serveur garde **une seule entrée par commune**, en préférant la ligne qui porte l'EPCI. Le résultat peut donc contenir moins de 20 communes. La clé de liste côté client reste `${communeCode}-${epci?.id ?? "none"}`.
- En cas d'erreur de base : renvoyer une erreur serveur explicite (le code d'origine journalise la cause et lève `INTERNAL_SERVER_ERROR` « Municipality search failed »).

### `commune.getInstitutions`
- **Entrée :** `{ communeCode: /^\d{5}$/ }`.
- **Sortie :** `[{ institutionId, role, institutionName, institutionType }]`, jointure `institution_communes` ↔ `institutions` filtrée sur le code.

### Codes INSEE corses : écart avec l'original
Les trois procédures (`getByCode`, `getInstitutions`, et la page) valident le code avec `/^\d{5}$/`. Or le snapshot `communes-all.json.gz` contient **360 communes corses** dont le code commence par `2A` ou `2B` (par exemple `2A004`). Ces communes sont rejetées par l'application d'origine : l'URL `?commune=2A004` est effacée et `getByCode` refuse l'entrée. `extracted/commune-code.ts` accepte `^(\d{5}|2[AB]\d{3})$` ; appliquez la même regex dans les schémas d'entrée de l'API de la nouvelle app. Cette correction est un changement de comportement par rapport à ChatVote.

### `commune.getByCode`
- **Entrée :** `{ communeCode: /^\d{5}$/ }`.
- **Sortie :** `{ name, departmentName }` ou `null` si la commune n'existe pas (`limit(1)`).
- La page l'appelle pour afficher le nom dans la pastille ; si la requête n'a pas encore répondu, le code sert de libellé provisoire.

**Pour Astro :** si l'API reste celle de ChatVote, appelez ces endpoints en HTTP (tRPC expose du JSON sur `/api/trpc/...`, ou créez deux endpoints REST fins). Si vous portez aussi la base, deux requêtes SQL suffisent. Le bornage des entrées (longueur max de la recherche, regex INSEE) doit être conservé : c'est une protection contre les abus.

## 7. Correspondance React → Astro (proposition)

| Élément d'origine | Option Astro |
|---|---|
| Composants `"use client"` | Îlot interactif : `client:load` pour la pastille (elle est dans l'en-tête, visible tout de suite) |
| `useQuery` (TanStack) | `fetch` + petit cache, ou TanStack Query dans l'îlot si vous gardez React/Preact/Solid |
| `nuqs` | Module URL maison ou `nanostores` + sync `history` |
| `Popover` de `@chatvote/ui` | Votre bibliothèque de popover (Radix/Ark/Kobalte selon le framework de l'îlot) ou l'API native `popover` du navigateur |
| `trackClientEvent` | Votre fournisseur analytics |
| Rendu serveur de l'en-tête | Astro peut rendre la coquille de la barre ; seul le contenu dépendant de `commune` doit être dans l'îlot |

Choix principal à trancher : écrire l'îlot dans le même framework que celui que vous voulez garder (React, Preact, Solid, Svelte), ou en JavaScript sans framework. Pour un seul composant interactif, Preact ou Solid donne un portage proche de l'original à faible coût.

## 8. Points d'attention

- **Effets en cascade** : les deux `useEffect` du switcher (valeur par défaut et institution périmée) dépendent d'une liste d'EPCI mémoïsée. Dans un portage sans framework réactif, remplacer par une seule fonction `reconcileInstitution(institutions, institutionId)` appelée quand la liste arrive.
- **Navigation navigateur** : `push` pour le changement de commune, `replace` pour les corrections automatiques (valeur par défaut). Sinon le bouton retour se bloque.
- **Hydratation** : ne lire `localStorage` qu'après le montage.
- **Pas de données de secours** : ni liste de communes codée en dur, ni libellé générique pour un type inconnu. Échouer bruyamment.
- **Responsive** : le popover fait `w-80` avec un maximum de `100vw - 2rem` ; les libellés de la bascule de vue sont masqués sous `sm` pour éviter un défilement horizontal sur mobile.

## 9. Ce qui n'a pas été vérifié

Cette spécification vient de la lecture de `commune-switcher.tsx`, `commune-selector.tsx`, `commune-tabs.tsx`, `conseil-nav-controls.tsx`, `recent-communes.ts`, `institution-labels.ts`, d'extraits de `app/chat/page.tsx` et de `routers/commune.ts` (`search`, `getByCode`, `getInstitutions`). Je n'ai pas lu en entier :
- `chat-start-flow.tsx`, qui réutilise `CommuneSelector` dans l'écran de démarrage (seulement ses imports et ses grandes lignes) ;
- les indexes SQL réellement présents en base pour la recherche `ilike` (performance).

Je n'ai pas exécuté l'application ni les tests pour confirmer le comportement décrit.
