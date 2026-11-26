# ChatVote

Nouvelle version minimale de [ChatVote](https://app.chatvote.org), un assistant conversationnel pour s'informer sur ce qui est décidé à l'échelon local (communes, communautés d'agglomérations, etc.), porté par l'association [Tandem — Tech & Démocratie](https://tandem.ngo).

Le site est un simple **conteneur** : un bandeau d'information, un header (logos ChatVote et Tandem), le **widget de chat [Zaq](https://github.com/www-zaq-ai/web_widget)** et un footer. Toute la logique métier (IA, données, historique des conversations) vit chez Zaq.

La commune se choisit dans l'URL (`?commune=<code INSEE>`, Saint-Saturnin, 63396, par défaut) et est transmise à Zaq comme contexte. Le site affiche aussi les **PV augmentés** (synthèses des conseils municipaux) de la commune.

## Stack

- [Astro 7](https://astro.build) : site statique, avec **trois routes à la demande** : la page d'accueil (selon la commune), `/api/widget-identity` (jeton du widget) et `/api/pv/…` (PV augmentés)
- TypeScript strict, CSS natif (pas de Tailwind), thème sombre unique, mobile-first
- Déploiement sur Vercel (`@astrojs/vercel`)
- Biome (lint + format), `astro check`, Vitest
- Mesure d'audience par [Matomo](https://matomo.org) auto-hébergé (`stats.tndm.fr`), sans cookie de suivi
- Aucune police ni script externe, à l'exception du script du widget Zaq et de Matomo

## Démarrage

Prérequis : Node 24 LTS (voir `.nvmrc`) et [pnpm](https://pnpm.io).

```sh
pnpm install
cp .env.example .env   # puis renseigner les variables (voir ci-dessous)
pnpm dev               # http://localhost:4321
```

| Commande | Rôle |
|---|---|
| `pnpm dev` | Serveur de développement |
| `pnpm build:data` | Génère l'index des communes (lancé automatiquement avant `dev`, `build` et `check`) |
| `pnpm build` | Build de production |
| `pnpm preview` | Prévisualiser le build |
| `pnpm lint` | Biome (lint + format) |
| `pnpm check` | Vérification des types (`astro check`) |
| `pnpm test` | Tests unitaires (Vitest) |
| `pnpm pv:index <dossier>` | Valide les PV augmentés d'un dossier et écrit un `index.json` par commune |

## Configuration

Les variables sont documentées dans [`.env.example`](.env.example).

- **Navigateur** (`PUBLIC_*`) : URL, préfixe et identifiant du widget Zaq, durée de vie des cookies, liens (don, « En savoir plus », logos), instance Matomo (`PUBLIC_MATOMO_URL`, `PUBLIC_MATOMO_SITE_ID` ; l'une des deux vide = suivi désactivé). Un lien vide masque le bouton ou le lien concerné.
- **Serveur uniquement** : `ZAQ_SIGNING_KEY` (fournie par Zaq), `ZAQ_ISSUER`, `ZAQ_AUDIENCE` et `PV_BASE_URL` (stockage des PV augmentés ; vide = aucun compte rendu). Ne jamais préfixer les secrets par `PUBLIC_` ni les committer.

## Fonctionnement du widget

1. `ZaqWidget.astro` charge `embed.js` depuis l'origine Zaq, qui crée l'iframe du chat.
2. `src/scripts/zaq-widget.ts` applique réglages et contexte quand le widget est prêt : `updateSettings` (thème sombre), puis `updateContext` avec la conversation en cours pour cette commune, ou à défaut le contexte de la commune (`prompt_context`). `embed.js` récupère lui-même le jeton via `GET /api/widget-identity` (`data-token-url`).
3. L'endpoint génère (ou relit) un `userID` (UUID v4, cookie HttpOnly) et signe un JWT HS256 (7 jours) avec `node:crypto`.
4. Le jeton est renouvelé automatiquement par `embed.js` à son expiration, sans perdre la conversation. L'identifiant de conversation est gardé dans le cookie `conversationId` (`<codeCommune>:<id>`).
5. Le style du widget passe par [`public/zaq-widget.css`](public/zaq-widget.css) (propriétés `--zaq-widget-*`).

## Sélecteur de commune

- `?commune=<INSEE>` absent : Saint-Saturnin ; format invalide : redirection vers `/` ; code inconnu : 404.
- Le statut de chaque commune est dans [`src/data/availability.ts`](src/data/availability.ts) (mise à jour manuelle). Seules les communes `available` affichent le widget ; les autres affichent une page « non disponible » (non financée, en cours de financement, financée et en cours d'ajout), sans charger Zaq.
- Les données des communes viennent d'un snapshot de geo.api.gouv.fr ([`data/communes/`](data/communes)), indexé par `pnpm build:data`.
- Changer de commune recharge la page : l'URL est la seule source de vérité.

## PV augmentés

Synthèses des procès-verbaux de conseils municipaux, produites hors du site (une paire `.md` + `.pdf` par séance) et affichées dans la modale « Comptes rendus ».

- Stockage hors du repo : bucket Scaleway Object Storage `chatvote-pv-augmentes`, organisé en `pv/<INSEE>/<AAAA-MM-JJ>.md`, `.pdf` et `pv/<INSEE>/index.json`. Chaque fichier doit être rendu public après l'envoi.
- Avant l'envoi : `pnpm pv:index <dossier>` valide l'en-tête de chaque PV et écrit les `index.json`.
- Le serveur lit le stockage (cache de 5 min) et sert le PV converti en HTML et le PDF via `/api/pv/<INSEE>/<id>.html|.pdf` : le navigateur ne parle qu'à notre domaine.
- Stockage absent ou en panne : la page reste utilisable, la modale affiche un message.

## Structure

```
src/
  layouts/         BaseLayout (bandeau, header, main, footer)
  components/      bandeau, header, footer, widget Zaq, sélecteur de commune,
                   modale « Comptes rendus », mise en page des pages légales
  scripts/         scripts navigateur : widget, sélecteur, modale, Matomo et opposition
  lib/             jeton et cookies (Zaq), commune/ (sélecteur), pv/ (PV augmentés)
  data/            statut des communes ; generated/ : index généré (gitignoré)
  pages/           index.astro, pages légales, communes-index.json.ts,
                   api/widget-identity.ts, api/pv/[commune]/[file].ts
  styles/          tokens, polices, base
scripts/           build-communes-index.ts (build:data), build-pv-index.ts (pv:index)
data/communes/     snapshot geo.api.gouv.fr
public/            polices Manrope, logos, favicon, zaq-widget.css
vercel.json        CSP et en-têtes de sécurité
docs/              guide de style du widget, notes de migration Scaleway / Caddy
```

## Développement local avec le widget (ngrok)

Si le widget Zaq est exposé via ngrok, deux protections bloquent le chargement de `/zaq-widget.css` et `/fonts/*` en local (Local Network Access de Chrome, protection cross-origin d'Astro 7). Voir la section dédiée de [`CLAUDE.md`](CLAUDE.md).

## Confidentialité et sécurité

- Deux cookies first-party : `userID` (HttpOnly) et `conversationId`, plus `mtm_consent_removed` (Matomo) uniquement si le visiteur s'oppose à la mesure d'audience. Aucun `localStorage` / `sessionStorage`.
- Matomo fonctionne sans cookie de suivi, avec IP anonymisée ; le visiteur peut s'y opposer par une case à cocher dans la [politique de confidentialité](src/pages/politique-de-confidentialite.astro).
- Le `userID` est un UUID aléatoire, pseudonyme, jamais dérivé de données personnelles.
- Le widget Zaq pose aussi son propre cookie (`_zaq_key`) sur son origine.
- CSP stricte dans `vercel.json` : l'origine Zaq y est écrite en dur et doit être mise à jour si `PUBLIC_ZAQ_URL` change (un test vérifie la cohérence). Elle autorise aussi `https://stats.tndm.fr` (Matomo).
- Pages légales : `/mentions-legales` et `/politique-de-confidentialite`.

## Documentation

- [`CLAUDE.md`](CLAUDE.md) : décisions actées, conventions, critères de recette et points à trancher
- [`docs/zaq-styling-guideline.md`](docs/zaq-styling-guideline.md) : propriétés de style du widget (`--zaq-widget-*`), fourni par Zaq
- [`docs/migration-scaleway-caddy.md`](docs/migration-scaleway-caddy.md) : notes de migration vers Scaleway (en-têtes par Caddy)
- [`data/communes/README.md`](data/communes/README.md) : origine et mise à jour du snapshot des communes
