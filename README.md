# ChatVote

Nouvelle version minimale de [ChatVote](https://app.chatvote.org), un assistant conversationnel pour s'informer sur les programmes électoraux, porté par l'association [Tandem — Tech & Démocratie](https://tandem.ngo).

Le site est un simple **conteneur** : un bandeau d'information, un header (logos ChatVote et Tandem), le **widget de chat [Zaq](https://github.com/www-zaq-ai/web_widget)** et un footer. Toute la logique métier (IA, données, historique des conversations) vit chez Zaq.

V1 : commune de **Saint-Saturnin (63450)**, transmise à Zaq comme contexte.

## Stack

- [Astro 7](https://astro.build) : site statique, avec **une seule route à la demande** (`/api/widget-identity`)
- TypeScript strict, CSS natif (pas de Tailwind), thème sombre unique, mobile-first
- Déploiement sur Vercel (`@astrojs/vercel`)
- Biome (lint + format), `astro check`, Vitest
- Aucun analytics, aucune police ni script externe, à l'exception du script du widget Zaq

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
| `pnpm build` | Build de production |
| `pnpm preview` | Prévisualiser le build |
| `pnpm lint` | Biome (lint + format) |
| `pnpm check` | Vérification des types (`astro check`) |
| `pnpm test` | Tests unitaires (Vitest) |

## Configuration

Les variables sont documentées dans [`.env.example`](.env.example).

- **Navigateur** (`PUBLIC_*`) : URL et identifiant du widget Zaq, durée de vie des cookies, liens (don, « En savoir plus », logos). Un lien vide masque le bouton ou le lien concerné.
- **Serveur uniquement** : `ZAQ_SIGNING_KEY` (fournie par Zaq), `ZAQ_ISSUER`, `ZAQ_AUDIENCE`. Ne jamais les préfixer par `PUBLIC_` ni les committer.

## Fonctionnement du widget

1. `ZaqWidget.astro` charge `embed.js` depuis l'origine Zaq, qui crée l'iframe du chat.
2. `src/scripts/zaq-widget.ts` applique réglages et contexte (`updateSettings`, `updateContext`) quand le widget est prêt ; `embed.js` récupère lui-même le jeton via `GET /api/widget-identity` (`data-token-url`).
3. L'endpoint génère (ou relit) un `userID` (UUID v4, cookie HttpOnly) et signe un JWT HS256 de courte durée avec `node:crypto`.
4. Le jeton est renouvelé automatiquement à son expiration, sans perdre la conversation (cookie `conversationId`).
5. Le style du widget passe par [`public/zaq-widget.css`](public/zaq-widget.css) (propriétés `--zaq-widget-*`).

## Structure

```
src/
  layouts/       BaseLayout (bandeau, header, main, footer)
  components/    AnnouncementBar, Header, ZaqWidget, Footer
  scripts/       zaq-widget.ts (côté navigateur)
  lib/           signature du jeton, cookies, validation
  pages/         index.astro et api/widget-identity.ts
  styles/        tokens, polices, base
public/          polices Manrope, logos, favicon, zaq-widget.css
vercel.json      CSP et en-têtes de sécurité
docs/            notes d'intégration Zaq et documentation
```

## Développement local avec le widget (ngrok)

Si le widget Zaq est exposé via ngrok, deux protections bloquent le chargement de `/zaq-widget.css` et `/fonts/*` en local (Local Network Access de Chrome, protection cross-origin d'Astro 7). Voir la section dédiée de [`CLAUDE.md`](CLAUDE.md).

## Confidentialité et sécurité

- Deux cookies first-party seulement : `userID` (HttpOnly) et `conversationId`. Aucun `localStorage` / `sessionStorage`.
- Le `userID` est un UUID aléatoire, pseudonyme, jamais dérivé de données personnelles.
- Le widget Zaq pose aussi son propre cookie (`_zaq_key`) sur son origine.
- CSP stricte dans `vercel.json` : l'origine Zaq y est écrite en dur et doit être mise à jour si `PUBLIC_ZAQ_URL` change (un test vérifie la cohérence).

## Documentation

- [`CLAUDE.md`](CLAUDE.md) : décisions actées, conventions, critères de recette et points à trancher
- [`docs/`](docs) : analyse de l'intégration Zaq et guide de style du widget
