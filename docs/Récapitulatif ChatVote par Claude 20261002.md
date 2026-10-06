# Récapitulatif ChatVote (étapes 1 à 5)

Étapes 1 à 5 faites et commitées sur `main`. Biome, `astro check` (0 erreur), 44 tests et le build passent. La recette (étape 6) n'est pas faite.

## En place
- **Scaffolding** : Astro 7.3.5, Node 24, pnpm, TypeScript strict, Biome, `.env.example`.
- **Assets locaux** : Manrope variable en `.woff2` (23 Ko) avec sa licence OFL, logo copié une fois depuis `app.chatvote.org`, favicon.
- **Styles et layout** : tokens sombres mobile-first, `@font-face` local, layout flex en `dvh`, bandeau, header et footer.
- **Iframe** : rendu sans `src`, le script renseigne le code commune et le `userID` (cookie).
- **`vercel.json`** : CSP, `Permissions-Policy`, `Referrer-Policy`, `X-Content-Type-Options`, cache immutable sur les assets.

## Vérifié dans Chrome
- `/` charge 63396, `?municipalityCode=63001` charge 63001, `abc` retombe sur 63396.
- Le même `userID` est réutilisé d'une visite à l'autre.
- Aucune violation de CSP côté site.
- Le chat refuse d'être affiché (`X-Frame-Options: deny`) : l'équipe chat doit autoriser notre domaine.

## Écarts avec le CLAUDE.md
- TypeScript 6 au lieu de 7 (`astro check` refuse TS 7).
- `vite.build.assetsInlineLimit: 0`, sinon Astro inline le script et casse la CSP.
- `pnpm-workspace.yaml` refuse le script de build d'esbuild (pnpm 11 faisait échouer l'install).
- Tokens : seules les valeurs clés du CLAUDE.md sont fiables. Échelles typo, espacements et `--container` sont provisoires, à resynchroniser avec le vrai `tokens.css` de Tandem.
- `lib/chat-url.ts` ajouté pour tester la construction de l'URL sans DOM.
- `<noscript>` : simple message « Activez JavaScript ».
- Le build échoue si `PUBLIC_CHAT_URL` n'est pas en https.
- Un test vérifie que `frame-src` de `vercel.json` correspond à `PUBLIC_CHAT_URL` de `.env.example`.

## À faire ou à trancher
1. L'origine du chat est en dur dans `vercel.json` : à mettre à jour à la main si l'URL change.
2. `clipboard-write` est autorisé pour le chat dans `Permissions-Policy`, les autres fonctions sont désactivées.
3. La liste blanche des paramètres relayés est vide (`institutionId` et `conseilView` à confirmer avec l'équipe chat).
4. `PUBLIC_DONATE_URL` vide : accroche et bouton masqués. `PUBLIC_LOGO_HREF` vide : logo sans lien.
5. `CHAT-INTEGRATION.md` est obsolète (« aucun cookie », pas de `userID`) : à mettre à jour avant envoi à l'équipe chat.
6. Pas testé : rendu mobile (iOS Safari, Chrome Android), Lighthouse, attributs du cookie en HTTPS réel, déploiement Vercel.