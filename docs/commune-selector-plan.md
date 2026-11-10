# Sélecteur de commune : plan validé et aide-mémoire de recette

Statut : **plan validé le 2026-11-05, implémenté (étapes 0 à 6) ; recette en cours.** Branche : `6-sélecteur-de-villes`.

Documents liés :
- [commune-selector-astro-port.md](commune-selector-astro-port.md) : première spécification, issue de l'ancienne app Next.js (en partie dépassée par ce plan).
- `refactor-commune-selector/` : kit de portage (code d'origine, modules extraits, snapshot des communes). **Supprimé du dépôt** après le portage ; récupérable dans l'historique Git.
- Maquettes interactives : https://claude.ai/artifact/GSQU6YxhKc5vCfxEj48Km4 (lien privé).

## 1. Objectif

Permettre au visiteur de choisir sa commune. Une commune **disponible** affiche le chat Zaq avec le nom et le code postal de la commune comme contexte. Une commune **non disponible** affiche une page personnalisée, **sans** le widget Zaq, dont le texte dépend de son statut de financement (voir ci-dessous). Les EPCI (communautés de communes, agglomérations, etc.) doivent pouvoir être ajoutés plus tard avec la même logique.

Aujourd'hui seule Saint-Saturnin est disponible. Entre 5 et 10 autres communes sont attendues prochainement.

## 2. Décisions actées

| Sujet | Décision |
|---|---|
| Périmètre | Communes d'abord. EPCI préparés (champ, types, tests, liste de disponibilité), données importées plus tard. |
| Données | **Statiques, pas de Postgres.** Index de recherche généré au build depuis le snapshot, fichier de disponibilité versionné. |
| Page | `index.astro` en rendu à la demande (`prerender = false`). **Deuxième route non statique du projet**, après `/api/widget-identity` : CLAUDE.md doit être mis à jour. |
| Commune par défaut | Saint-Saturnin (63396) si `?commune=` est absent. Logique à revoir plus tard. |
| URL | `?commune=<code INSEE>` est l'unique source de vérité. |
| Changement de commune | Navigation complète vers `/?commune=…` (l'iframe repart neuve, le bouton retour fonctionne). |
| Framework | JS natif, API `popover`, aucune dépendance ajoutée (ni React, ni Tailwind, ni Drizzle, ni Postgres). |
| Récents (`localStorage`) | Retirés (règle : aucun stockage local dans notre origine). |
| Analytics | Aucun. |
| Debounce de la recherche | 300 ms conservé, même si la recherche est locale. |
| Codes corses | Acceptés (`2A004`, `2B033`). L'app d'origine les rejetait. |
| Mobile | **Option B** : barre de commune de 44 px sous le header, popover en feuille sous cette barre. |
| Desktop | Pastille à droite du header, avant la bascule. Popover centré sur l'axe vertical de la pastille. |
| Message « non disponible » | Texte provisoire, à personnaliser (avec CTA crowdfunding). Même principe pour une institution. |
| Bouton « Comptes rendus » | Toujours visible. Message « pas encore disponible dans ChatVote » quand la commune ou l'institution n'a rien. |

## 3. Comportement par URL

| Requête | Réponse |
|---|---|
| `/` (sans paramètre) | Saint-Saturnin |
| `/?commune=abc` (format invalide) | Redirection vers `/` |
| `/?commune=99999` (format valide, inconnu) | 404 |
| Commune connue, **non disponible** (`unfunded`, `partially-funded`, `funded`) | Page dédiée selon le statut, **aucun** script Zaq, donc ni appel au jeton ni cookie |
| Commune connue, **disponible** | Chat Zaq avec `prompt_context` de la commune |

Format du code : `^(\d{5}|2[AB]\d{3})$`, validé avant toute recherche.

## 4. Données

- **Snapshot** : `communes-all.json.gz`, 34 969 communes (geo.api.gouv.fr, récupéré le 2026-09-30), avec `communes-all.meta.json` (sha256 `0629c040f137202362ccb2dd529383ddb768bc3a1e8433d70e2293cc04ed9d4f`). Le script de build **vérifie le sha256 et s'arrête avec un message clair** si le fichier est absent ou altéré. Pas de liste de secours.
- **Index de recherche** : généré au build (code, nom, département, codes postaux, population). Chargé par le navigateur au premier focus du champ. Même origine, donc la CSP actuelle (`connect-src 'self'`) suffit. Réglage du cache à prévoir dans `vercel.json`.
- **Serveur** : lit les mêmes données pour retrouver le nom et le code postal d'une commune.
- **Statut** : `src/data/availability.ts` contient la table `COMMUNE_STATUSES` (`code INSEE → statut`) et la liste des institutions ouvertes (vide pour l'instant). Changer un statut = un commit et un redéploiement. Une commune absente de la table est `unfunded`. Un test vérifie que chaque code existe dans l'index. Le fichier est public (bundle navigateur) : pas de donnée financière.

  | Statut | Page | Pastille de recherche | Indexation |
  |---|---|---|---|
  | `available` | chat Zaq | « Disponible » | oui |
  | `unfunded` | « {commune} n'est pas encore disponible dans ChatVote », CTA « Ouvrir cette commune » | aucune | `noindex` |
  | `partially-funded` | même titre ; « Une partie seulement a déjà été financée, votre financement complémentaire permettrait de l'accueillir au plus vite. », CTA « Ouvrir cette commune » | « En cours de financement » | `noindex` |
  | `funded` | « {commune} arrive bientôt dans ChatVote » ; « Les 250€ nécessaires… ont été financés… », CTA « Soutenir Tandem » | « En cours d'ajout » | `noindex` |

## 5. Recherche

- 2 à 100 caractères, 20 résultats maximum, une entrée par commune.
- Par nom, code INSEE (préfixe) ou code postal.
- Insensible aux accents et à la casse (« saint saturnin » trouve « Saint-Saturnin »).
- Tri : par statut (`available`, `funded`, `partially-funded`, `unfunded`), puis population décroissante, puis nom.
- Résultat : nom, département (omis s'il est identique au nom), code INSEE, premier code postal, pastille selon le statut (voir « Statut »).
- États : « Recherche en cours… », « Aucune commune trouvée pour « … » », bouton « Effacer ».
- Les résultats sont de vrais liens `<a href="/?commune=…">` : ça marche même si le JS échoue.

## 6. Contexte envoyé à Zaq

`PROMPT_CONTEXT` (constante) devient `buildPromptContext(nom, codesPostaux, département)`. Le nom vient de **nos données**, jamais de l'URL.

| Cas | Phrase |
|---|---|
| Un code postal | « Je vais te poser des questions sur la ville de X dont le code postal est 63450 » |
| Deux ou trois | « …dont les codes postaux sont X, Y » |
| Plus de trois, ou aucun | Département à la place du code postal (ex. Paris : 21 codes postaux) |

Dans le snapshot : 387 communes ont plusieurs codes postaux (318 en ont deux, Paris 21, Marseille 16, Lyon 9, Toulouse 6), 5 n'en ont aucun, et plusieurs communes portent le même nom (deux « Saint-Saturnin » : Puy-de-Dôme et Sarthe). Chaque cas a un test.

## 7. Cookie `conversationId`

- **Valeur** : `<code commune>:<id de conversation>` (ex. `63396:abc123`). Nom, attributs (`Secure`, `SameSite=Lax`, `Path=/`), durée et événement d'écriture (`zaq:conversation`) ne changent pas.
- **Lecture** : seule la partie après les deux-points part à Zaq (`updateContext({ conversation_id })`), et **seulement si le code correspond à la commune courante**. Sinon le cookie est ignoré et on envoie `prompt_context`.
- **Ancien format** (valeur sans préfixe) : ignoré, donc la reprise de conversation est perdue une seule fois.
- **Conséquence connue** : changer de commune, poser une question, puis revenir à la première commune ne reprend pas l'ancienne conversation (le cookie est écrasé). Elle reste dans l'historique côté Zaq.
- Le visiteur peut modifier ce cookie, mais Zaq vérifie que la conversation lui appartient.

## 8. Comptes rendus

- Ajouter un champ `commune` (obligatoire) au schéma de la collection `records`, et un champ `institution` facultatif pour les EPCI.
- Les 9 fichiers existants reçoivent `commune: "63396"`.
- `RecordsModal` et `RecordsList` reçoivent la commune et filtrent.
- Aucun compte rendu pour la commune : message « pas encore disponible dans ChatVote ».

## 9. Interface

- **Pastille** (rendue côté serveur, nom de la commune connu) : icône épingle + libellé « Commune » + nom + chevron qui pivote à l'ouverture. Nom tronqué avec ellipse s'il est trop long.
- **Popover** natif (`popover`) : fermeture au clic extérieur et avec Échap. Champ de recherche selon le motif combobox/listbox (flèches, Entrée, noms accessibles, `aria-current`/`aria-selected`).
- **CSS natif** avec les tokens du site, **aucun attribut `style` en ligne** (la CSP `style-src 'self'` l'interdit).
- Mobile : barre de 44 px, feuille limitée en hauteur pour que les résultats restent visibles avec le clavier virtuel. La page ne défile pas.
- Si l'API `popover` ou le positionnement ancré ne suffisent pas sur un navigateur, prévoir un positionnement simple sous la pastille.

## 10. Étapes de réalisation

Un commit court et atomique par étape.

0. Exclure `refactor-commune-selector/` des vérifications (Biome, `astro check`, `vitest`, `tsconfig`).
1. Modules purs et tests (`src/lib/commune/`) : validation du code, libellés d'institution (erreur claire sur un type inconnu, pas de libellé de secours), `resolveSwitcherTrigger`, `resolveInstitutionId`. Tests à lancer en vrai : ceux du kit n'ont jamais été exécutés.
2. Données : script de build (vérification sha256, index), fichier de disponibilité, test de cohérence.
3. Recherche : fonction pure sur l'index, testée.
4. Page et widget : `index.astro` à la demande, `resolveCommuneRequest(code)` (fonction pure testée), `buildPromptContext`, `ZaqWidget` et `zaq-widget.ts` (contexte reçu en propriété), cookie `code:id`, page « non disponible », filtre des comptes rendus.
5. Sélecteur : pastille, barre mobile, popover, recherche.
6. Documentation (CLAUDE.md : deux routes à la demande, sélecteur, format du cookie, `buildPromptContext`, critères de recette) et vérifications finales.

## 11. Recette

**Commandes** : `pnpm biome check`, `pnpm astro check`, `pnpm test`, build : sans erreur.

**Recherche**
- [ ] « sa » : aucun résultat, aucune requête. « sain » : résultats après environ 300 ms.
- [ ] « saint saturnin » (sans tiret) trouve « Saint-Saturnin ». Une recherche avec accents fonctionne.
- [ ] Recherche par code postal (63450) et par début de code INSEE (633).
- [ ] `?commune=2A004` (Ajaccio) est accepté.
- [ ] Bouton « Effacer » et message « Aucune commune trouvée » corrects.

**URL et pages**
- [ ] `/` ouvre Saint-Saturnin.
- [ ] `?commune=abc` redirige vers `/`, la valeur n'est jamais affichée.
- [ ] `?commune=99999` renvoie 404.
- [ ] Commune non disponible (tester chacun des trois statuts) : page dédiée, **aucune requête vers Zaq** dans l'onglet Réseau, aucun cookie `userID` ni `conversationId`.
- [ ] Choisir une commune puis bouton retour : revient à la commune précédente.

**Contexte Zaq** (cas à vérifier avec une commune de chaque type)
- [ ] Un code postal, deux ou trois, plus de trois (Paris), aucun.
- [ ] Deux communes homonymes sont bien distinguées.

**Cookie et conversation (à tester avec Zaq, staging)**
- [ ] Le cookie a la forme `code:id` et les attributs prévus.
- [ ] Rechargement sur la même commune : la conversation est reprise.
- [ ] Autre commune (clic, URL tapée à la main, lien partagé, bouton retour) : aucune reprise de l'ancienne conversation, `prompt_context` envoyé.
- [ ] Ancien cookie sans préfixe : ignoré, pas d'erreur.
- [ ] Zaq accepte bien la reprise avec la partie après les deux-points.
- [ ] Cookies bloqués par le navigateur : le site ne plante pas.
- [ ] Le domaine pose **exactement deux cookies** (`userID` et `conversationId`) et aucun stockage local.

**Comptes rendus**
- [ ] La liste est filtrée par commune.
- [ ] Le bouton reste visible. Message « pas encore disponible » quand il n'y a rien.

**Interface**
- [ ] Desktop : popover centré sur la pastille. Écran étroit : feuille pleine largeur du cadre.
- [ ] Mobile 375 px : barre de 44 px, pas de défilement horizontal ni parasite, feuille visible au-dessus du clavier.
- [ ] Nom très long (ex. « Saint-Rémy-de-Chargnat ») tronqué proprement.
- [ ] Clavier : ouverture et fermeture, focus visible, boutons avec nom accessible.
- [ ] Lighthouse et contrastes corrects.
- [ ] IOS Safari et Chrome Android.

**Preview Vercel (avec la CSP)**
- [ ] Aucune requête ni erreur bloquée par la CSP. Le chargement de l'index (même origine) fonctionne.
- [ ] Aucune requête vers un domaine autre que le nôtre et celui de Zaq.

**Sécurité**
- [ ] `GET /api/widget-identity` sans `Origin` ni `Sec-Fetch-Site: same-origin` : 403 (non-régression).
- [ ] Aucune clé (`ZAQ_SIGNING_KEY`) dans le build client.

## 12. Évolutions prévues

- **EPCI** : import (API géo : `/epcis` et `/communes?fields=code,nom,codeEpci`), section « Intercommunalité » au-dessus du champ de recherche, paramètre d'URL pour l'institution (nom à fixer, par exemple `institution=<SIREN>`), `resolveInstitutionId` à brancher, disponibilité par institution.
- **Textes** : message de la page « non disponible » (CTA crowdfunding), message de la modale des comptes rendus, textes d'accueil par commune.
- **Commune par défaut** : revoir la règle (Saint-Saturnin aujourd'hui).
- **Disponibilité** : si la liste grandit ou doit changer sans redéploiement, envisager un back-office ou une source côté Zaq (Postgres reste une option, écartée pour la V1).
- **SEO** : `title` et `description` propres à chaque commune.
- **Cache** : cache public (`s-maxage`) sur la page, si les performances l'exigent (la page ne contient rien de propre au visiteur).
- **Protection** : limitation de débit sur `/api/widget-identity` (voir CLAUDE.md, « À trancher »).
- **Corse et cas particuliers** : vérifier les arrondissements (Paris, Lyon, Marseille partagent un seul code INSEE).

## 13. Risques et points à vérifier

- **Zaq et le nouveau cookie** : à valider en conditions réelles. Zaq ne documente pas le comportement de `updateContext` appelé plusieurs fois, ni après la première question. Il n'existe aucune API pour ouvrir une nouvelle conversation : seul le rechargement de l'iframe le permet, ce que fait notre navigation complète.
- **`prompt_context`** : n'est envoyé qu'avec la première question d'une nouvelle conversation.
- **Lisibilité du nom sur mobile** : un nom très long est tronqué dans la barre.
- **Taille de l'index** : environ 3 Mo bruts (moins de 1 Mo compressé). Mesurer au build ; réduire si besoin.
- **Rendu à la demande** : `index.astro` n'est plus statique. Vérifier le déploiement Vercel et les en-têtes de `vercel.json` (CSP, cache) sur une preview.
- **Non vérifié à ce jour** : les tests du kit (jamais lancés avec vitest), le script `seed-epcis.ts` (jamais exécuté, inutile en V1), le rendu visuel des maquettes (non regardé après publication).
