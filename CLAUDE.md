# ChatVote — nouveau site (coquille + widget Zaq)

Langue du projet : **français** (UI, commentaires de contenu, README). Le code et les noms de fichiers restent en anglais.

## Objectif

Recréer ChatVote en version minimale. Le site ne contient que :

1. un **bandeau** d'information (au-dessus du header),
2. un **header** (logos ChatVote et Tandem),
3. le **widget de chat Zaq**, qui remplit l'espace entre le header et le footer (application distincte, autre domaine, intégrée via son script `embed.js`),
4. un **footer** simple.

Toute la logique métier (IA, données, historique des conversations) vit chez Zaq. Le site ne contient que la logique nécessaire à l'intégration : **deux routes serveur** : l'endpoint qui signe le jeton d'identité du visiteur (voir « Intégration du widget Zaq ») et la page d'accueil, rendue à la demande selon la commune choisie (voir « Sélecteur de commune »).

Référence historique : `https://app.chatvote.org/chat?municipality_code=63396` (ancienne version, Next.js).
Commune par défaut : **Saint-Saturnin (INSEE 63396)**. La commune se choisit via `?commune=<INSEE>` (voir « Sélecteur de commune »).

Historique : une première version intégrait le chat via notre propre iframe (code commune + `userID` en paramètres d'URL). Elle a été **supprimée** au profit du widget Zaq ; elle reste récupérable dans l'historique Git.

## Décisions actées (ne pas remettre en cause sans validation)

| Sujet | Décision |
|---|---|
| Framework | **Astro 7.x**, site **statique** par défaut ; **deux routes à la demande** (`/api/widget-identity` et `index.astro`) |
| Node | **24 LTS** (Astro 7 exige ≥ 22.12, versions paires uniquement). `.nvmrc` + `engines` |
| Langage | TypeScript strict |
| Gestionnaire | **pnpm** (champ `packageManager` dans `package.json`) |
| Lint / format | **Biome** + `astro check` (Biome ne couvre que partiellement les `.astro`) |
| CSS | **Natif uniquement**. Pas de Tailwind. Variables CSS, nesting, `dvh`, `@layer`, styles scopés Astro |
| Approche | **Mobile-first** (media queries en `min-width`) |
| Thème | **Sombre unique**. Pas de thème clair, pas de bascule, pas de `prefers-color-scheme`. Le widget est forcé en sombre via `updateSettings` |
| Hébergement | Vercel avec l'adapter **`@astrojs/vercel`** (requis par l'endpoint). Migration vers un hébergeur français possible plus tard (changer d'adapter) |
| Config | Variables d'environnement `PUBLIC_*` (navigateur) et variables **serveur** sans préfixe pour les secrets (`astro:env`) |
| Analytics | **Aucun** |
| Chat | **Widget Zaq** (`embed.js`), pas d'iframe maison |
| Identité visiteur | `user_id` = UUID v4 généré par l'endpoint, dans un cookie `userID` **HttpOnly**, pour que Zaq reconnaisse le visiteur et affiche son historique |
| Langue du site | Français uniquement (`lang="fr"`), pas d'i18n |
| Pages légales | Reportées (à traiter lors de l'enrichissement du footer) |
| Liens (don, en savoir plus, logos) | Variables d'environnement ; lien vide = bouton ou lien masqué |

Fichier réservé Astro 7 : ne **pas** créer `src/fetch.ts` (routage avancé).

## Intégration du widget Zaq

Docs de référence : [guide d'intégration Zaq](https://github.com/www-zaq-ai/web_widget/blob/main/docs/integration-guideline.md), [Astro : rendu à la demande](https://docs.astro.build/en/guides/on-demand-rendering/), `ZAQ-WIDGET-INTEGRATION.en.md` (notre analyse initiale).

### Fonctionnement côté Zaq

- `embed.js` crée lui-même `<iframe id="zaq-widget">` dans le conteneur indiqué par l'attribut `iframe-location-id`.
- L'identité passe **uniquement** par un **JWT signé HS256**, produit par un backend : claims `widget_id`, `user_id` (≤ 255 octets, non vide), `iss`, `aud` (doivent correspondre à la config Zaq), `iat`, `exp` (> `iat`, 7 jours max par défaut), `jti` (16–255 car., aléatoire), `nbf` et `profile` optionnels. **Toute autre claim est rejetée** (dont `conversation_id` et `prompt_context`). Premier usage du jeton dans les 5 s : un jeton neuf par appel. En-tête : `{"alg":"HS256","typ":"JWT"}`.
- `embed.js` récupère et renouvelle **lui-même** le jeton : attribut `data-token-url` (chemin same-origin de notre site, appelé en `GET`, réponse `{ identity_token }`, `no-store`). `data-widget-url` = URL de l'iframe (`<ORIGINE_ZAQ><PREFIXE>/widget/<id>`, préfixe `PUBLIC_ZAQ_PATH_PREFIX` = `/channels` en staging, script en `<PREFIXE>/web_widget/assets/embed.js`). Plus d'appel à `init`.
- Reprise de conversation et contexte côté navigateur, une fois le widget prêt : `zaq.widget.updateContext({ conversation_id })` (Zaq vérifie que la conversation appartient au visiteur ; un identifiant inconnu échoue sans créer de conversation) ou, sans identifiant, `updateContext({ prompt_context })` (appliqué à la première question seulement).
- Le widget émet sur l'iframe `#zaq-widget` : `zaq:ready`, `zaq:authenticated`, `zaq:authentication-required`, `zaq:disconnected` (`event.detail.reason` : `expired`, `store_unavailable`, `backend_revoked`) et `zaq:conversation` (`event.detail.conversation_id`, au premier message). Le renouvellement du jeton est géré par `embed.js`.
- Réglages : `zaq.widget.getSettings()` / `updateSettings({ theme, language })` (`theme` : light, dark, auto ; `language` : en, fr, ar).
- Les **origines autorisées** (localhost:4321, previews Vercel, domaine final) se configurent dans le back-office Zaq (`/bo/channels/retrieval/web_widget`).
- Le CSS de notre page **ne traverse pas l'iframe**. Le style du widget passe par l'attribut `stylesheet-url` de `embed.js` : la feuille est chargée **dans l'iframe** et définit les propriétés personnalisables `--zaq-widget-*` (couleurs, police, rayon, largeur max, marge ; voir `styling-guideline.md`, fourni par Zaq). Pas de `@layer`, pas de `!important`. L'URL relative est résolue contre l'origine de **notre** page ; les URL à l'intérieur de la feuille (polices) le sont contre la feuille. La CSP **du widget** doit autoriser notre domaine (`style-src`, `font-src`) : à vérifier avec Zaq, y compris pour chaque preview Vercel.

### Notre implémentation

- `src/components/ZaqWidget.astro` : conteneur `#iframe-zaq`, script `embed.js` (URL construite depuis `PUBLIC_ZAQ_URL`, `data-widget-id` depuis `PUBLIC_ZAQ_WIDGET_ID`), `stylesheet-url="/zaq-widget.css"`, script bundlé `zaq-widget.ts`, styles globaux du conteneur, et un **bloc d'accueil** (logo ChatVote + texte de présentation) placé derrière l'iframe, que le widget recouvre dès qu'on l'utilise.
- `src/scripts/zaq-widget.ts` : attend que `zaq.widget` existe, attend `zaq:ready` pour appliquer `updateSettings` puis `updateContext` (conversation du cookie pour la commune courante, sinon le `prompt_context` de la commune), et écrit le cookie `conversationId` sur `zaq:conversation`.
- `src/pages/api/widget-identity.ts` (`prerender = false`) : GET same-origin uniquement (`Origin`, sinon `Sec-Fetch-Site: same-origin`), génère ou relit le `userID`, signe le jeton, répond `{ identity_token }` avec `Cache-Control: no-store`.
- `src/lib/zaq-identity.ts` (signature, serveur), `src/lib/zaq-ids.ts` (noms de cookies et validation, partagé serveur/navigateur, **sans import Node**), `src/lib/conversation-cookie.ts` (écriture du cookie dans le navigateur).
- `astro.config.mjs` : adapter Vercel et schéma `astro:env` (secrets serveur).

### Identité, cookies et contexte

- **`user_id`** : UUID v4 généré par l'endpoint, stocké dans le cookie **`userID`** posé par le **serveur** (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, durée `PUBLIC_USER_ID_COOKIE_MAX_AGE`, pas de `Domain`). Réutilisé aux visites suivantes ; valeur absente ou invalide : nouvel UUID. Le JavaScript de la page ne peut pas le lire.
- **`conversation_id`** : cookie **`conversationId`** posé par le **navigateur** (`Secure`, `SameSite=Lax`, `Path=/`, même durée), de valeur **`<codeCommune>:<conversationId>`**. Relu pour `updateContext({ conversation_id })` seulement si la commune correspond ; l'ancien format (sans commune) est ignoré. Identifiant validé (`[A-Za-z0-9_-]{1,255}`) avant usage. À valider avec Zaq en staging.
- **`prompt_context`** : construit par `buildPromptContext` (`src/lib/commune/prompt-context.ts`) à partir de nos données (nom, code postal ou département), transmis au navigateur via les attributs `data-*` de `.stage[data-chat-frame]` et envoyé par `updateContext`. Zaq ne gère pas de code commune.
- **Jeton** : HS256, durée 7 jours, `jti` aléatoire.
- Le `userID` est un identifiant **pseudonyme, pas une authentification**.
- Ne jamais logguer ni afficher le `userID` ni le jeton.

### Développement local avec le widget (ngrok)

Le widget tourne sur une adresse publique (ngrok) et son iframe charge `/zaq-widget.css` et `/fonts/*` depuis `localhost:4321`. Deux protections bloquent cela en local, **sans effet sur Vercel** :

- **Chrome (Local Network Access)** : une page publique ne peut pas appeler `localhost`. Mettre `chrome://flags/#local-network-access-check` sur *Disabled* (profil de dev uniquement, à remettre sur Default ensuite) ou autoriser « Accès au réseau local » pour le site ngrok.
- **Serveur de dev Astro 7** : il répond 403 « Cross-origin request blocked » aux sous-ressources cross-site sans en-tête `Origin`. Le plugin `dev-allow-zaq-assets` d'`astro.config.mjs` retire `Sec-Fetch-Site` pour ces seuls chemins (`/zaq-widget.css`, `/fonts/*`), en dev uniquement. Les CORS du serveur de dev sont ouverts (`server.headers`, `vite.server.cors`) pour la même raison.
- Sans cela, modifier les variables `--zaq-widget-*` directement dans DevTools (contexte de l'iframe) puis recopier les valeurs dans `public/zaq-widget.css`.

### Secrets et variables d'environnement

Variables **serveur** (jamais de préfixe `PUBLIC_`, jamais dans le code ni dans Git) : `ZAQ_SIGNING_KEY` (fournie par Zaq), `ZAQ_ISSUER`, `ZAQ_AUDIENCE`. Elles vont dans `.env` (gitignoré) en local et dans les variables d'environnement Vercel. `ZAQ_ISSUER` / `ZAQ_AUDIENCE` valent pour l'instant les **valeurs d'exemple du guide Zaq** (`test-widget` / `zaq-web-widget`) : à confirmer.

`.env.example` (référence) :

```
# Durée de vie des cookies userID et conversationId, en secondes (provisoire : 12 mois)
PUBLIC_USER_ID_COOKIE_MAX_AGE=31536000
# Liens à définir plus tard
PUBLIC_DONATE_URL=
PUBLIC_LOGO_HREF=
# Lien du logo Tandem dans le header
PUBLIC_LOGO_TANDEM_HREF=
# Lien « En savoir plus » du bandeau (à définir)
PUBLIC_MORE_URL=

# --- Widget Zaq ---
PUBLIC_ZAQ_URL=https://zaq-staging.51.159.27.173.sslip.io
# Préfixe de déploiement Zaq (vide si Zaq est servi à la racine)
PUBLIC_ZAQ_PATH_PREFIX=/channels
PUBLIC_ZAQ_WIDGET_ID=13
# Côté serveur uniquement
ZAQ_SIGNING_KEY=
ZAQ_ISSUER=test-widget
ZAQ_AUDIENCE=zaq-web-widget
```

## Sélecteur de commune

Plan et recette détaillés : `docs/commune-selector-plan.md`.

- `index.astro` est rendue à la demande : `?commune=<INSEE>` absent → Saint-Saturnin ; format invalide → 302 vers `/` ; code inconnu → 404 ; commune connue mais dont le statut (`src/data/availability.ts`) n'est pas `available` → page « non disponible » **sans** script Zaq (ni jeton ni cookie), texte selon le statut ; `available` → widget avec `prompt_context`.
- L'URL est la seule source de vérité : changer de commune = navigation complète (Zaq n'a pas d'API de nouvelle conversation). Pas de `localStorage`.
- Données statiques : snapshot geo.api.gouv.fr dans `data/communes/` (sha256 vérifié), index généré par `pnpm build:data` (lancé avant `dev`, `build`, `check`). Statut d'une commune : table `COMMUNE_STATUSES` (`code INSEE → statut`), mise à jour manuelle ; absente de la table = `unfunded`. Statuts : `available` (widget), `unfunded` (non financée), `partially-funded` (en cours de financement), `funded` (financée, en cours d'ajout). Seul `available` est indexable ; les trois autres sont `noindex`. Le fichier est embarqué dans le bundle navigateur (recherche) : aucune donnée financière dedans.
- Comptes rendus filtrés par la clé `commune` du frontmatter. EPCI préparés (types, `institution`), données à importer plus tard.
- Le kit de portage `refactor-commune-selector/` a été supprimé (récupérable dans l'historique Git).

## Contraintes de confidentialité

- Pas d'analytics, pas de Google Fonts, pas de CDN. **Exception actée : le script du widget Zaq** (script tiers qui s'exécute dans notre page avec accès à son DOM et à ses cookies non-HttpOnly). La confiance accordée à Zaq est à valider (voir « À trancher »).
- **Deux cookies first-party** : `userID` (HttpOnly, posé par le serveur) et `conversationId` (posé par le navigateur). Aucun autre cookie, et **aucun `localStorage`/`sessionStorage` dans notre page** (le widget pourrait en utiliser dans sa propre origine : à vérifier).
- **Le widget pose aussi son propre cookie** `_zaq_key` (origine Zaq, `Secure`, `HttpOnly`, `SameSite=None`), donc un cookie tiers dans notre iframe : à faire expliquer par Zaq et à intégrer à l'analyse RGPD (constaté à la lecture de la réponse de `/widget/13`).
- Le `userID` est un UUID aléatoire : il ne contient **aucune donnée personnelle** et n'est jamais dérivé d'informations sur l'utilisateur (IP, user-agent, etc.). Lié à un historique de conversation, il reste une donnée **pseudonyme** au sens du RGPD.
- Polices, logos et favicon sont **servis localement** (aucun hotlink).
- Zaq reçoit l'adresse IP des visiteurs (inévitable avec un widget tiers).

### CSP et en-têtes (`vercel.json`)

Rendre la règle vérifiable techniquement. État actuel (à valider sur une preview Vercel : la CSP ne s'applique **pas** en `pnpm dev`) :

```
default-src 'self';
script-src 'self' <ORIGINE_ZAQ>;
style-src 'self';
font-src 'self';
img-src 'self' data:;
connect-src 'self' <ORIGINE_ZAQ> wss://<HOTE_ZAQ>;
frame-src <ORIGINE_ZAQ>;
base-uri 'self';
form-action 'none';
frame-ancestors 'none'
```

- `<ORIGINE_ZAQ>` = origine exacte de `PUBLIC_ZAQ_URL`, jamais `*`. Elle est **écrite en dur** dans `vercel.json` : à mettre à jour quand l'URL Zaq change (`vercel-config.test.ts` vérifie la cohérence avec `.env.example`).
- Pas de `'unsafe-inline'` : `build.inlineStylesheets: 'never'` et `vite.build.assetsInlineLimit: 0` dans `astro.config.mjs`, scripts bundlés en fichiers.
- `/fonts/*` envoie `Access-Control-Allow-Origin: <ORIGINE_ZAQ>` : la police Manrope est chargée depuis l'iframe du widget (cross-origin, CORS requis). `/zaq-widget.css` a le même en-tête CORS et un cache court (1 h). En local, `astro dev` ignore `vercel.json` : `server.headers` dans `astro.config.mjs` envoie `Access-Control-Allow-Origin: *` (feuille et polices publiques).
- `Permissions-Policy` restrictive (avec `clipboard-write` pour l'origine Zaq), `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options: DENY`.
- `img-src`, `style-src` et `font-src` devront peut-être inclure l'hôte Zaq : le guide ne les liste pas, à valider en recette.

## Structure du projet

```
src/
  layouts/BaseLayout.astro     bandeau + header + <main> + footer
  components/
    AnnouncementBar.astro
    Header.astro
    ZaqWidget.astro            conteneur + script embed.js + accueil
    CommuneTrigger / CommunePopover / CommuneUnavailable
    Footer.astro
  scripts/zaq-widget.ts        settings, updateContext, cookie conversationId
  lib/zaq-identity.ts          signature du jeton HS256 (serveur)
  lib/zaq-ids.ts               noms de cookies + validation (partagé, sans import Node)
  lib/conversation-cookie.ts   cookie conversationId « commune:id » (navigateur)
  lib/commune/                 sélecteur : code INSEE, index, recherche, contexte, requête, UI
  data/availability.ts         statut des communes (et EPCI disponibles) dans ChatVote
  data/generated/              index des communes généré au build (gitignoré)
  scripts/commune-switcher.ts  popover de recherche (navigateur)
  pages/index.astro            à la demande : chat, page « non disponible » ou 404
  pages/communes-index.json.ts index de recherche, prérendu
  pages/api/widget-identity.ts endpoint à la demande
  styles/
    tokens.css                 tokens Tandem adaptés (voir plus bas)
    fonts.css                  @font-face Manrope (fichiers locaux)
    base.css                   reset + styles globaux
public/
  fonts/                       Manrope .woff2 + licence OFL
  zaq-widget.css               thème du widget (propriétés --zaq-widget-*), servi tel quel, URL stable
  logo-chatvote.svg, tandem-logo.svg
  favicon.svg
astro.config.mjs               adapter Vercel, schéma astro:env, options CSP-friendly
vercel.json                    CSP et en-têtes
biome.json
.nvmrc
.env.example
```

## Layout

Colonne flex sur toute la hauteur d'écran. Le widget prend tout l'espace restant entre le header et le footer. Ordre : bandeau, header, widget, footer.

```css
body { min-height: 100dvh; display: flex; flex-direction: column; }
main { flex: 1; display: flex; min-height: 0; }
/* ZaqWidget : .stage { flex: 1 }  #iframe-zaq { flex: 1 }  #zaq-widget { flex: 1; width: 100%; border: 0 } */
```

- Utiliser **`dvh`**, pas `vh` (barre d'adresse mobile).
- La page ne défile pas : le chat gère son propre scroll dans l'iframe.
- Sur mobile, bandeau, header et footer doivent rester **compacts** pour laisser la hauteur au chat.
- L'iframe `#zaq-widget` est créée à l'exécution par `embed.js` : ses styles sont **globaux** (les styles scopés Astro ne la ciblent pas).

## Design : tokens

Base : `tokens.css` du site Tandem (design system Tandem v1), **adapté** :

1. **Thème sombre unique** : les valeurs de `[data-theme="dark"]` deviennent le `:root`, avec `color-scheme: dark`. Supprimer le thème clair et le mécanisme `data-theme`. Focus ring en orange.
2. **Mobile-first** : le fichier Tandem est en `max-width` (767 / 1023). Inverser : valeurs mobiles par défaut, puis `@media (min-width: 768px)` et `(min-width: 1024px)`. Valeurs identiques, seul le sens change.
3. **Police** : remplacer `var(--font-manrope)` (mécanisme `next/font`) par une déclaration `@font-face` directe sur les fichiers locaux.
4. Conserver les tokens non utilisés pour l'instant (`--container`, `--display-*`, etc.) : le header et le footer seront enrichis. Retirer seulement ce qui est lié au thème clair.
5. Noter en en-tête du fichier : « dérivé du design system Tandem v1 » + liste des écarts, pour resynchroniser plus tard.

Valeurs clés (sombre) :

- `--surface-100: #170742` (fond de page, aussi fond du footer Tandem)
- `--surface-200: #2b1850` (surfaces surélevées, bandeau)
- `--ink: #fbfbfb`, `--ink-secondary: rgba(251,251,251,0.62)`
- `--border: rgba(251,251,251,0.16)`
- `--brand-indigo: #381bf3`, `--brand-orange: #f2461a`
- Police : **Manrope**. Rayons : `--radius-full` pour boutons/pilules.
- `--header-height` : 64 px mobile / 96 px desktop (valeurs Tandem, à réduire si le chat paraît à l'étroit).

Le fond actuel de ChatVote (`#1a0645`) est quasi identique au navy Tandem : on unifie sur `#170742`.

Style cible = **mix Tandem (structure, typo, tokens) + ChatVote (logo, fond sombre, boutons en pilule)**.

### Polices

- Manrope, fichiers `.woff2` locaux (idéalement la version variable ; sinon graisses 400, 600, 700, 800).
- `font-display: swap` + `<link rel="preload">` sur la graisse principale.
- Inclure la licence OFL à côté des fichiers.

## Composants

### Bandeau (`AnnouncementBar`)

Fixe, non masquable, pas de bouton de fermeture :

- Texte d'information sur l'initiative (associative, open source, souveraine), accroche « Aidez-nous à aider la démocratie ! », bouton **Soutenir** (`PUBLIC_DONATE_URL`) et lien « En savoir plus » (`PUBLIC_MORE_URL`). Un lien vide masque le bouton correspondant.
- Fond `--surface-200`, filet `--border`, texte `--ink-secondary`.
- Responsive : texte raccourci sur mobile, CTA conservé.

### Header (`Header`)

Logo ChatVote + « par » + logo Tandem (lien vers le site Tandem, `PUBLIC_LOGO_TANDEM_HREF`). Clic sur le logo ChatVote : `PUBLIC_LOGO_HREF`, **à définir** (vide = pas de lien). Contenu final à définir avec le porteur du projet.

### Footer (`Footer`)

Texte seul, sans logo (un logo pourra être ajouté à l'enrichissement) :

- Gauche : `© <année> TANDEM — Tech & Démocratie` ; droite : `Association loi 1901 · Saint-Saturnin`. Mention de version et de statut bêta.
- Fond `--surface-100`, filet `--border` en haut, texte `--ink-secondary`, petite taille (`--body-sm-*`).
- Mobile-first : blocs **empilés** et centrés par défaut, côte à côte dès ~640 px. Footer le plus compact possible sur mobile.
- Année du copyright : calculée au build.

### Accueil du widget (`ZaqWidget`)

Logo ChatVote en grand (taille relative à la hauteur de l'écran) et texte d'introduction, centrés dans la zone du chat, affichés derrière l'iframe transparente. Le widget Zaq les recouvre dès qu'on l'utilise : pas de logique de masquage.

## Points d'attention (côté Zaq, hors périmètre de ce repo)

- Ajouter nos origines (localhost, previews, domaine final) aux origines autorisées du widget.
- Le guide indique que Zaq vérifie que la conversation appartient au `user_id` (le cookie `conversationId` est modifiable par le visiteur) : à confirmer avec Zaq.
- Demander une **limitation de débit** par widget (notre endpoint est ouvert, voir « À trancher »).
- Obtenir les **valeurs réelles de `iss` et `aud`**, une **URL stable** (prod et preview) et la liste des paramètres de personnalisation du widget (couleurs, polices, taille de l'iframe).
- SEO : le contenu du widget n'est pas attribué à notre page. Soigner `title`, `description`, Open Graph, et le texte d'accueil.

## Conventions de code

- Biome pour lint + format. `astro check` en CI pour les types.
- Composants Astro sans JS client, sauf le script `zaq-widget.ts`.
- Pas de dépendance ajoutée sans raison (le site doit rester minuscule) : le jeton est signé avec `node:crypto`, sans bibliothèque JWT.
- Le code importé côté navigateur ne doit **jamais** importer de module Node (`zaq-ids.ts` existe pour cela).
- Commits courts et atomiques.

## Démarrage (étapes)

1. Scaffolding : `pnpm create astro@latest` (Astro 7.x), TS strict, Biome, `.nvmrc`, `.env.example`, repo Git.
2. Tokens CSS, polices locales, layout de base, logos SVG locaux.
3. Bandeau, header, footer.
4. Widget Zaq : adapter Vercel, `/api/widget-identity`, `ZaqWidget` + `zaq-widget.ts`, variables d'environnement (avec tests unitaires du jeton et des cookies).
5. `vercel.json` (CSP, en-têtes), déploiement Vercel avec previews par branche.
6. Recette (ci-dessous).

## Critères de recette

- Le widget s'affiche, accepte une question, répond. Rechargement : le **même `userID`** est réutilisé et l'historique réapparaît.
- Le jeton est renouvelé sans perdre la conversation quand il expire (renouvellement par `embed.js`).
- **Sur une preview Vercel (avec la CSP)** : aucune requête ni erreur bloquée par la CSP dans la console ; l'onglet Réseau n'affiche aucune requête vers un domaine autre que le nôtre et celui de Zaq.
- Sélecteur : recherche (nom, INSEE, code postal), clavier, mobile 375 px, changement de commune puis reprise de conversation côté Zaq ; voir `docs/commune-selector-plan.md` §11.
- Notre domaine pose **exactement deux cookies** (`userID` HttpOnly + `conversationId`), avec les attributs prévus (`Secure`, `SameSite=Lax`, `Path=/`, durée voulue), et **aucun** `localStorage`/`sessionStorage` dans notre origine.
- `GET /api/widget-identity` depuis un autre site ou sans `Origin` ni `Sec-Fetch-Site: same-origin` : refusé (403).
- Aucune clé (`ZAQ_SIGNING_KEY`) dans le build client ni dans l'historique Git.
- Cookies bloqués par le navigateur : le site ne plante pas (le widget démarre une nouvelle conversation, sans erreur visible).
- Pas de défilement parasite sur mobile (iOS Safari, Chrome Android) : le widget remplit exactement l'espace entre header et footer.
- Lighthouse et accessibilité corrects (contrastes, focus visible).
- `pnpm biome check`, `pnpm astro check`, `pnpm test` et le build passent sans erreur.

## À trancher plus tard

- **URL Zaq stable** (prod et preview) : l'URL ngrok est temporaire, et son hôte est autorisé dans la CSP (risque si ce sous-domaine est réattribué).
- Valeurs réelles de `ZAQ_ISSUER` / `ZAQ_AUDIENCE`.
- **Protection de l'endpoint** : limitation de débit (Vercel firewall ou en code) et plafond côté Zaq ; sans cela, n'importe quel script peut créer des utilisateurs et consommer du budget.
- Propriété des conversations côté Zaq (voir « Points d'attention »).
- Taille et position de l'iframe pilotables ? Personnalisation du style du widget (couleurs, polices) ?
- Confiance accordée au script tiers Zaq et analyse **RGPD/ePrivacy** : consentement, durée de vie des cookies, mentions légales, politique de confidentialité (avec la personne en charge du juridique).
- Durée de vie définitive des cookies, nom de la variable `PUBLIC_USER_ID_COOKIE_MAX_AGE` (elle couvre aussi `conversationId`).
- Vérifier si le widget lui-même écrit dans le stockage de notre origine.
- Vérifier la CSP sur une preview (`img-src`, `style-src`, `font-src`).
- Lien « Soutenir », « En savoir plus » et destination du clic sur le logo ChatVote.
- Contenu final du header, logo dans le footer, pages légales.
- Nom du repo et organisation Vercel ; domaine cible du site.
- Audit de sécurité interne : `SECURITY-AUDIT.md` (local, gitignoré).
