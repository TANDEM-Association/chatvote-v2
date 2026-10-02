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
| Langue du site | Français uniquement (`lang="fr"`), pas d'i18n |
| Pages légales | Reportées (à traiter lors de l'enrichissement du footer) |
| Liens (don, clic logo) | **À définir plus tard** : prévoir des variables/placeholders |

Fichier réservé Astro 7 : ne **pas** créer `src/fetch.ts` (routage avancé).

## Contraintes de confidentialité (strictes)

- **Aucun service externe** côté site : pas de Google Fonts, pas de CDN, pas de scripts tiers, pas d'analytics.
- **Aucun cookie ni `localStorage`/`sessionStorage`** posé par le site en l'état. Un cookie de session pourrait être ajouté plus tard (à confirmer, ne rien anticiper).
- Polices, logo et favicon sont **servis localement** (aucun hotlink vers `app.chatvote.org`).
- Le chat dans l'iframe est un contexte séparé : ses cookies éventuels relèvent de son domaine, pas de ce site.

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
- L'`<iframe>` est rendu **sans `src`**. Le script le renseigne tout de suite, ce qui évite un double chargement. Un `<noscript>` contient un iframe avec le code par défaut.
- État de chargement léger (skeleton) tant que l'iframe n'a pas émis `load`.
- Accessibilité : `title` explicite sur l'iframe. Attribut `allow` limité au strict nécessaire (ex. `clipboard-write`). Pas de `sandbox` tant que le chat n'est pas testé avec.

### Variables d'environnement (`.env.example`)

```
# URL de base de l'application chat (à confirmer : prod ou preview v2)
PUBLIC_CHAT_URL=https://app.chatvote.org/chat
# Nom du paramètre « code commune » attendu par le chat
PUBLIC_CHAT_MUNICIPALITY_PARAM=municipality_code
# Commune par défaut (V1 : Saint-Saturnin)
PUBLIC_DEFAULT_MUNICIPALITY_CODE=63396
# Liens à définir plus tard
PUBLIC_DONATE_URL=
PUBLIC_LOGO_HREF=
```

Résultat attendu en V1 : l'iframe pointe sur `https://app.chatvote.org/chat?municipality_code=63396`.

## Points d'attention (côté équipe du chat, hors périmètre de ce repo)

- Le chat doit autoriser notre domaine via `Content-Security-Policy: frame-ancestors` et ne pas envoyer `X-Frame-Options: DENY`, sinon l'iframe reste vide.
- Chat et site sont sur des **domaines différents** : les cookies du chat dans l'iframe sont des cookies tiers (restrictions Safari/Firefox, `SameSite=None; Secure` nécessaire). Impact possible sur l'authentification du chat.
- Les cookies/stockage éventuels du chat peuvent nécessiter une information ou un consentement des utilisateurs (à vérifier côté RGPD).
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
4. `ChatFrame` + `chat-frame.ts` + `lib/municipality.ts` (avec tests unitaires de la validation).
5. `vercel.json` (CSP, headers), déploiement Vercel avec previews par branche.
6. Recette (ci-dessous).

## Critères de recette

- Au chargement, l'onglet Réseau n'affiche **aucune requête** vers un domaine autre que le nôtre et celui du chat.
- **Aucun cookie** n'est posé par notre domaine.
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
- Cookie de session éventuel.
- Nom du repo et organisation Vercel.
- Domaine cible du site.
