# ChatVote — nouveau site (coquille + iframe)

Langue du projet : **français** (UI, commentaires de contenu, README). Le code et les noms de fichiers restent en anglais.

## Objectif

Recréer ChatVote en version minimale. Le site ne contient que :

1. un **bandeau** d'information (au-dessus du header),
2. un **header** (placeholder + logo ChatVote),
3. un **iframe** plein écran qui intègre le chat (application distincte, autre domaine),
4. un **footer** simple.

Toute la logique métier (IA, auth, données) vit dans l'application chat. Ce site n'est qu'une coquille : **aucune logique applicative ici**.

Référence historique : `https://app.chatvote.org/chat?municipality_code=63396` (ancienne version, Next.js).
V1 : commune **Saint-Saturnin, code 63396**.

## ⚠️ Changement d'intégration en cours : widget Zaq (branche `chat-integration`)

**Le chat n'est plus intégré via notre propre iframe** (`ChatFrame` + `chat-frame.ts`) mais via le **widget web Zaq**. Les sections « Iframe et code commune », « Identifiant utilisateur (`userID`) », la CSP, les contraintes de confidentialité et le tableau des décisions ci-dessous décrivent **l'ancienne approche** : là où elles contredisent cette section, **celle-ci prévaut** (réécriture complète à faire une fois les points ouverts tranchés).

Docs de référence : `ZAQ-WIDGET-INTEGRATION.en.md` (notre analyse), [guide d'intégration Zaq](https://github.com/www-zaq-ai/web_widget/blob/main/docs/integration-guideline.md), [Astro : rendu à la demande](https://docs.astro.build/en/guides/on-demand-rendering/).

### État actuel

- `src/pages/index.astro` : `<ChatFrame />` reste **commenté (à laisser tel quel)** ; la page rend `<ZaqWidget />` (`src/components/ZaqWidget.astro`), qui contient le conteneur `<div id="iframe-zaq">`, le script `embed.js` (URL construite depuis `PUBLIC_ZAQ_URL`, **ngrok temporaire** ; `data-widget-id` depuis `PUBLIC_ZAQ_WIDGET_ID`), le script bundlé `src/scripts/zaq-widget.ts` et les styles (globaux) du conteneur.
- Fait : adapter `@astrojs/vercel` (site toujours `static`), `src/pages/api/widget-identity.ts` (`prerender = false`), `src/lib/zaq-identity.ts` (signature HS256, testée), `src/lib/zaq-ids.ts` + `src/lib/conversation-cookie.ts`, schéma `astro:env` dans `astro.config.mjs`, CSP `vercel.json` (origine Zaq).
- Ancien code iframe (`ChatFrame.astro`, `chat-frame.ts`, `municipality.ts`, `user-id.ts`, `chat-url.ts` + tests) **conservé volontairement pour l'instant** (pas de nettoyage décidé) Ses variables d'environnement (`PUBLIC_CHAT_URL`, `PUBLIC_CHAT_MUNICIPALITY_PARAM`, `PUBLIC_DEFAULT_MUNICIPALITY_CODE`, `PUBLIC_CHAT_USER_ID_PARAM`) ont été **retirées** de `.env` et `.env.example` : à les remettre si `<ChatFrame />` est réactivé.

### Décisions prises (widget Zaq)

- **Adapter** : `@astrojs/vercel`. Une seule route à la demande : `/api/widget-identity`.
- **`user_id`** : UUID v4 généré par l'endpoint, stocké dans le cookie **`userID`** posé par le **serveur** (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, durée `PUBLIC_USER_ID_COOKIE_MAX_AGE`), réutilisé aux visites suivantes pour que Zaq reconnaisse le visiteur et affiche l'historique. Valeur invalide ou absente : nouvel UUID.
- **`conversation_id`** : cookie **`conversationId`** posé par le navigateur à l'événement `zaq:conversation` (`event.detail.conversation_id`, émis sur l'iframe `#zaq-widget`, écouté en capture sur `document`), relu par l'endpoint pour reprendre la conversation.
- **`prompt_context`** : `Saint-Saturnin 63450` (constante `PROMPT_CONTEXT`, Zaq ne sait pas gérer un code commune pour l'instant). Le paramètre d'URL `municipalityCode` n'est plus utilisé.
- **Protection de l'endpoint** : POST same-origin uniquement (en-tête `Origin` vérifié), réponse `Cache-Control: no-store`. Pas de limitation de débit pour l'instant.
- **Secrets** (variables serveur, jamais `PUBLIC_`) : `ZAQ_SIGNING_KEY` (dans `.env` local, gitignoré, et dans les variables Vercel), `ZAQ_ISSUER`, `ZAQ_AUDIENCE` (valeurs d'exemple du guide Zaq, **à confirmer**, requis dans le jeton). Durée du jeton : 240 s.
- **Cookies** : le site pose désormais **deux** cookies first-party (`userID`, `conversationId`) : la règle « un seul cookie » ci-dessous est périmée.

### Fonctionnement du widget Zaq

- `embed.js` crée lui-même `<iframe id="zaq-widget">` (dans le conteneur indiqué par `iframe-location-id`).
- L'identité passe **uniquement** par un **JWT signé HS256**, produit par un backend : claims `widget_id`, `user_id` (≤ 255 octets), `conversation_id` (ou null), `prompt_context` (texte libre, optionnel, ≤ 100 000 octets), `iss`, `aud` (doivent correspondre à la config Zaq), `iat`, `exp` (≤ 300 s après `iat`), `jti` (16–255 car., aléatoire). En-tête : `{"alg":"HS256","typ":"JWT"}`.
- Le front appelle `await zaq.widget.init({ identity_token })` (rien d'autre dans `init`).
- Endpoint backend attendu : `POST /api/widget-identity` → `{"identity_token": "<JWT>"}` avec `Cache-Control: no-store`. La **clé de signature ne doit jamais aller dans le navigateur** (variable d'environnement serveur, **sans** préfixe `PUBLIC_`).
- Renouvellement : le widget émet `zaq:authentication-required` quand le jeton expire (le front récupère un nouveau jeton et rappelle `init`) et `zaq:conversation` au premier message.
- Réglages : `zaq.widget.getSettings()` / `updateSettings({ theme: "dark", language: "fr" })`.
- Pas de paramètre « code commune » dédié : à passer via `prompt_context`.
- Les **origines autorisées** (localhost:4321, previews Vercel, domaine final) se configurent dans le back-office Zaq (`/bo/channels/retrieval/web_widget`).

### Reste à faire / points ouverts

- **À vérifier en test** (voir le widget fonctionner) : taille et position de l'iframe dans `#iframe-zaq` (`embed.js` peut imposer sa propre mise en page), requêtes bloquées par la CSP (`img-src`, `style-src`, `font-src` à élargir si besoin), page d'avertissement ngrok, `iss`/`aud` acceptés par Zaq, forme exacte de l'événement `zaq:conversation`.
- Ajouter `http://localhost:4321`, les previews Vercel et le domaine final aux origines autorisées du back-office Zaq.
- Renseigner les variables d'environnement `ZAQ_*` et `PUBLIC_ZAQ_*` dans Vercel.
- **CSP** : l'origine Zaq est écrite en dur dans `vercel.json` (doit rester identique à `PUBLIC_ZAQ_URL`, vérifié par `vercel-config.test.ts` sur `.env.example`). À mettre à jour quand l'URL Zaq change.
- **URL Zaq stable** (prod et preview) : l'URL ngrok est temporaire.
- **Stockage** : l'exemple du guide Zaq utilise `sessionStorage` côté intégrateur ; nous utilisons un cookie. À vérifier si le widget lui-même écrit dans notre origine.
- **Confidentialité / RGPD** : script tiers dans notre page, deux cookies dont un identifiant stable lié à un historique de conversation : à valider avec la personne en charge du juridique (consentement, mentions légales, politique de confidentialité, durée de vie).
- **Limitation de débit** de `/api/widget-identity` si nécessaire.
- **Nettoyage** de l'ancien code iframe et **réécriture complète** de ce document (décisions actées, confidentialité, structure, recette) une fois Zaq validé.

## Décisions actées (ne pas remettre en cause sans validation)

| Sujet | Décision |
|---|---|
| Framework | **Astro 7.x** (dernière stable), sortie 100 % **statique** |
| Node | **24 LTS** (Astro 7 exige ≥ 22.12, versions paires uniquement). `.nvmrc` + `engines` |
| Langage | TypeScript strict |
| Gestionnaire | **pnpm** (champ `packageManager` dans `package.json`) |
| Lint / format | **Biome** + `astro check` (Biome ne couvre que partiellement les `.astro`, à vérifier) |
| CSS | **Natif uniquement**. Pas de Tailwind. Variables CSS, nesting, `dvh`, `@layer`, styles scopés Astro |
| Approche | **Mobile-first** (media queries en `min-width`) |
| Thème | **Sombre unique**. Pas de thème clair, pas de bascule, pas de `prefers-color-scheme` |
| Hébergement | Vercel, sans adapter (statique). Migration vers un hébergeur français possible plus tard |
| Config | Variables d'environnement `PUBLIC_*` |
| Analytics | **Aucun** |
| Identifiant utilisateur | `userID` aléatoire **généré par le site**, stocké dans **un seul cookie first-party**, transmis à l'iframe (voir section dédiée) |
| Langue du site | Français uniquement (`lang="fr"`), pas d'i18n |
| Pages légales | Reportées (à traiter lors de l'enrichissement du footer) |
| Liens (don, clic logo) | **À définir plus tard** : prévoir des variables/placeholders |

Fichier réservé Astro 7 : ne **pas** créer `src/fetch.ts` (routage avancé).

## Contraintes de confidentialité (strictes)

- **Aucun service externe** côté site : pas de Google Fonts, pas de CDN, pas de scripts tiers, pas d'analytics.
- **Un seul cookie autorisé : le cookie `userID`** (first-party, posé par le site, voir section « Identifiant utilisateur »). Aucun autre cookie, et **aucun `localStorage`/`sessionStorage`**.
- Le `userID` est un identifiant pseudonyme aléatoire : il ne contient **aucune donnée personnelle** et n'est jamais dérivé d'informations sur l'utilisateur (IP, user-agent, etc.).
- Polices, logo et favicon sont **servis localement** (aucun hotlink vers `app.chatvote.org`).
- **Le chat ne gère aucune session** (confirmé par l'équipe du chat) : tout vient du site hôte. Il ne devrait donc poser ni cookie ni stockage local de son côté (à vérifier en recette).

### CSP (dans `vercel.json`)

Rendre la règle vérifiable techniquement. Point de départ à valider en preview :

```
default-src 'self';
script-src 'self';
style-src 'self';
font-src 'self';
img-src 'self' data:;
connect-src 'self';
frame-src <ORIGINE_DU_CHAT>;
base-uri 'self';
form-action 'none';
frame-ancestors 'none'
```

- `<ORIGINE_DU_CHAT>` = origine exacte de `PUBLIC_CHAT_URL`, jamais `*`.
- Pour éviter `'unsafe-inline'` : `build.inlineStylesheets: 'never'` dans `astro.config`, et aucun script inline (scripts bundlés en fichiers).
- Ajouter une `Permissions-Policy` restrictive, ainsi que `Referrer-Policy` et `X-Content-Type-Options`.

## Structure du projet

```
src/
  layouts/BaseLayout.astro     bandeau + header + <main> + footer
  components/
    AnnouncementBar.astro
    Header.astro
    ChatFrame.astro
    Footer.astro
  scripts/chat-frame.ts        résolution de l'URL de l'iframe (voir plus bas)
  lib/municipality.ts          validation du code commune
  lib/user-id.ts               génération + cookie du userID
  styles/
    tokens.css                 tokens Tandem adaptés (voir plus bas)
    fonts.css                  @font-face Manrope (fichiers locaux)
    base.css                   reset + styles globaux
  pages/index.astro
public/
  fonts/                       Manrope .woff2 + licence OFL
  logo-chatvote.svg            copié depuis https://app.chatvote.org/images/logos/chatvote.svg
  favicon.*
vercel.json
biome.json
.nvmrc
.env.example
```

## Layout

Colonne flex sur toute la hauteur d'écran. L'iframe prend tout l'espace restant entre le header et le footer. Ordre : bandeau, header, iframe, footer.

```css
body { min-height: 100dvh; display: flex; flex-direction: column; }
main { flex: 1; display: flex; }
iframe { flex: 1; width: 100%; border: 0; }
```

- Utiliser **`dvh`**, pas `vh` (barre d'adresse mobile).
- La page ne défile pas : le chat gère son propre scroll dans l'iframe.
- Sur mobile, bandeau, header et footer doivent rester **compacts** pour laisser la hauteur au chat.

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

Reproduit celui de la v2 de ChatVote (fixe, non masquable, pas de bouton de fermeture) :

- Texte : « ChatVote est une initiative associative open source et souveraine - la fiabilité de l'information fournie est notre priorité. Version 1.0 »
- Accroche : « Aidez-nous à aider la démocratie ! » + bouton **Soutenir**
- Fond `--surface-200`, filet `--border`, texte `--ink-secondary`.
- Responsive : texte raccourci ou sur deux lignes sur mobile, CTA conservé.
- Lien du bouton « Soutenir » : **à définir** (`PUBLIC_DONATE_URL`, vide pour l'instant → bouton masqué ou `href="#"` explicite à marquer TODO).

### Header (`Header`)

**Placeholder** : contient uniquement le logo ChatVote. Contenu final défini plus tard avec le porteur du projet. Destination du clic sur le logo : **à définir**.

### Footer (`Footer`)

Version de départ (d'après le footer Tandem), **texte seul, sans logo** (un logo pourra être ajouté à l'enrichissement) :

- Gauche : `© 2026 TANDEM — Tech & Démocratie`
- Droite : `Association loi 1901 · Saint-Saturnin`
- Fond `--surface-100`, filet `--border` en haut, texte `--ink-secondary`, petite taille (`--body-sm-*`).
- Mobile-first : les deux blocs **empilés** par défaut, côte à côte dès ~640 px. Footer le plus compact possible sur mobile.
- Année du copyright : calculée au build.

## Iframe et code commune

### Principe

Le site est statique : l'URL de l'iframe est résolue **côté navigateur** par un petit script bundlé (`src/scripts/chat-frame.ts`), pas au build.

Ordre de résolution du code commune :

1. paramètre `municipalityCode` de l'URL du site parent (ex. `https://site/?municipalityCode=63396`),
2. sinon `PUBLIC_DEFAULT_MUNICIPALITY_CODE` (V1 : `63396`).

### Règles

- **Valider** le code avant usage : 5 chiffres, ou format corse (`2A`/`2B` + 3 chiffres). Regex : `/^(\d{5}|2[AB]\d{3})$/`. Si invalide : ignorer et retomber sur la valeur par défaut. Jamais d'injection brute dans l'URL.
- Construire l'URL avec l'API `URL` / `searchParams.set`, jamais par concaténation de chaînes.
- Le **nom du paramètre côté chat est configurable** (`PUBLIC_CHAT_MUNICIPALITY_PARAM`), car il diffère selon les versions : `municipality_code` (ancienne app) ou `commune` (v2). L'URL d'exemple de la v2 contient aussi `institutionId` et `conseilView`, mais **leur rôle et leur caractère obligatoire ne sont pas vérifiés** (aucun accès au code de la v2) : à confirmer auprès de l'équipe du chat avant de décider de la liste blanche.
- Autres paramètres relayés : **liste blanche** uniquement (à définir selon l'app chat cible). Rien d'autre ne passe de l'URL parente vers l'iframe.
- L'`<iframe>` est rendu **sans `src`**. Le script le renseigne tout de suite, ce qui évite un double chargement. Pas d'iframe de repli dans un `<noscript>` tant que l'on ne sait pas si le `userID` est obligatoire pour le chat (sans JavaScript, il ne peut pas être généré). Si le `userID` est obligatoire, afficher dans `<noscript>` un simple message invitant à activer JavaScript.
- État de chargement léger (skeleton) tant que l'iframe n'a pas émis `load`.
- Accessibilité : `title` explicite sur l'iframe. Attribut `allow` limité au strict nécessaire (ex. `clipboard-write`). Pas de `sandbox` tant que le chat n'est pas testé avec.

### Identifiant utilisateur (`userID`)

Décision de l'équipe du chat : **l'iframe ne gère pas de session**. Elle attend un `userID` fourni par le site hôte, **généré aléatoirement et stocké dans un cookie côté site**, pour être resservi aux visites suivantes.

Fonctionnement dans `src/scripts/chat-frame.ts` (via `src/lib/user-id.ts`), **avant** de renseigner le `src` de l'iframe :

1. Lire le cookie `userID` (nom exact défini en constante).
2. Si absent **ou invalide** (format UUID v4 attendu, valider par regex) : générer un nouvel identifiant avec `crypto.randomUUID()` et l'écrire dans le cookie.
3. Ajouter l'identifiant à l'URL de l'iframe, via `searchParams.set` (nom du paramètre configurable : `PUBLIC_CHAT_USER_ID_PARAM`).
4. Si l'écriture du cookie échoue (cookies bloqués) : continuer avec un identifiant **éphémère** (valable pour la page seulement), sans erreur visible.

Attributs du cookie (posé en JavaScript, donc **sans** `HttpOnly`) :

- `Path=/`, `Secure`, `SameSite=Lax`
- `Max-Age` : durée **à fixer** (valeur provisoire : 12 mois), variable `PUBLIC_USER_ID_COOKIE_MAX_AGE` en secondes
- pas de `Domain` explicite (le cookie reste lié au domaine exact du site)

Règles :

- Générer l'identifiant **côté navigateur uniquement** (le site est statique, pas de code serveur ni de middleware).
- Ne jamais logguer ni afficher le `userID`.
- Le `userID` est un identifiant **pseudonyme, pas une authentification** : l'équipe du chat ne doit pas lui accorder de confiance de sécurité (n'importe qui peut en forger un).
- Mécanisme de transmission **à confirmer avec l'équipe du chat** : paramètre d'URL (hypothèse de travail), ou `postMessage`. Un paramètre d'URL apparaît dans les logs du serveur du chat.
- **RGPD / ePrivacy** : l'ajout d'un cookie change l'analyse faite jusqu'ici (« aucun cookie »). Savoir si ce cookie peut être posé sans consentement, quelle durée de vie retenir, et s'il faut mettre à jour mentions légales et politique de confidentialité est à valider avec la personne en charge du volet juridique.

### Variables d'environnement (`.env.example`)

```
# URL de base de l'application chat (à confirmer : prod ou preview v2)
PUBLIC_CHAT_URL=https://app.chatvote.org/chat
# Nom du paramètre « code commune » attendu par le chat
PUBLIC_CHAT_MUNICIPALITY_PARAM=municipality_code
# Commune par défaut (V1 : Saint-Saturnin)
PUBLIC_DEFAULT_MUNICIPALITY_CODE=63396
# Identifiant utilisateur : nom du paramètre attendu par le chat (à confirmer)
PUBLIC_CHAT_USER_ID_PARAM=userID
# Durée de vie du cookie userID, en secondes (provisoire : 12 mois)
PUBLIC_USER_ID_COOKIE_MAX_AGE=31536000
# Liens à définir plus tard
PUBLIC_DONATE_URL=
PUBLIC_LOGO_HREF=
```

Résultat attendu en V1 : l'iframe pointe sur `https://app.chatvote.org/chat?municipality_code=63396&userID=<uuid>` (noms de paramètres provisoires).

## Points d'attention (côté équipe du chat, hors périmètre de ce repo)

- Le chat doit autoriser notre domaine via `Content-Security-Policy: frame-ancestors` et ne pas envoyer `X-Frame-Options: DENY`, sinon l'iframe reste vide.
- **Pas de session côté chat** (confirmé) : les problèmes de cookies tiers en iframe cross-domain (Safari/Firefox) ne devraient plus se poser, **à condition que le chat ne pose aucun cookie ni stockage local**. À vérifier en recette.
- Confirmer avec l'équipe du chat le **mécanisme et le nom** de transmission du `userID` (paramètre d'URL ou `postMessage`), son format attendu (UUID v4 ?) et s'il est **obligatoire**.
- Rappeler que le `userID` est un identifiant pseudonyme et non une authentification.
- Le cookie `userID` est posé par le site : l'information des utilisateurs (mentions légales, confidentialité) est à traiter côté site (voir « À trancher plus tard »).
- SEO : le contenu de l'iframe n'est pas attribué à notre page. Soigner `title`, `description`, Open Graph, et prévoir un court contenu de repli.
- Synchronisation thème/URL entre site et chat via `postMessage` : évolution possible, **pas en V1**.

## Conventions de code

- Biome pour lint + format. `astro check` en CI pour les types.
- Composants Astro sans JS client, sauf le script `chat-frame.ts`.
- Pas de dépendance ajoutée sans raison (le site doit rester minuscule).
- Commits courts et atomiques.

## Démarrage (étapes)

1. Scaffolding : `pnpm create astro@latest` (Astro 7.x), TS strict, Biome, `.nvmrc`, `.env.example`, repo Git.
2. Tokens CSS, polices locales, layout de base, logo SVG local.
3. Bandeau, header (placeholder + logo), footer.
4. `ChatFrame` + `chat-frame.ts` + `lib/municipality.ts` + `lib/user-id.ts` (avec tests unitaires de la validation du code commune et de la gestion du cookie `userID`).
5. `vercel.json` (CSP, headers), déploiement Vercel avec previews par branche.
6. Recette (ci-dessous).

## Critères de recette

- Au chargement, l'onglet Réseau n'affiche **aucune requête** vers un domaine autre que le nôtre et celui du chat.
- Notre domaine pose **exactement un cookie** (`userID`), avec les attributs prévus (`Secure`, `SameSite=Lax`, `Path=/`, durée voulue), et **aucun** `localStorage`/`sessionStorage`.
- Premier chargement : un `userID` (UUID v4) est créé et transmis à l'iframe. Rechargement : **le même** `userID` est réutilisé. Cookie supprimé ou valeur invalide : un nouvel identifiant valide est généré.
- Cookies bloqués par le navigateur : le site fonctionne quand même (identifiant éphémère), sans erreur.
- Le chat dans l'iframe **ne pose aucun cookie**.
- `/` charge l'iframe sur le code `63396` ; `/?municipalityCode=63001` charge `63001` ; `/?municipalityCode=abc` retombe sur `63396`.
- Pas de défilement parasite sur mobile (iOS Safari, Chrome Android) : l'iframe remplit exactement l'espace entre header et footer.
- Lighthouse et accessibilité corrects (contrastes, `title` de l'iframe, focus visible).
- `pnpm biome check`, `pnpm astro check` et le build passent sans erreur.

## À trancher plus tard

- URL définitive du chat (prod ou preview v2) et liste blanche de paramètres associée.
- Nom exact du paramètre « code commune » attendu par le chat (`municipality_code` provisoire, `municipalityCode` ou `commune` possibles) : à ajuster via `PUBLIC_CHAT_MUNICIPALITY_PARAM`.
- Lien « Soutenir » et destination du clic sur le logo.
- Contenu final du header.
- Pages légales (mentions légales, confidentialité).
- Logo dans le footer.
- Durée de vie définitive du cookie `userID`, nom du cookie, et analyse RGPD/ePrivacy (consentement, mentions légales, politique de confidentialité).
- Transmission du `userID` au chat : paramètre d'URL ou `postMessage`, nom du paramètre, format attendu, caractère obligatoire.
- Nom du repo et organisation Vercel.
- Domaine cible du site.
