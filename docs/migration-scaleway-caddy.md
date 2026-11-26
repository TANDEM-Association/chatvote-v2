# Migration Scaleway : en-têtes de sécurité par Caddy (et Matomo)

Brief à fournir au début de la session « préparation Docker / migration Scaleway ».

## Contexte

- Aujourd'hui : ChatVote (et tndm.fr) sont sur Vercel. Les en-têtes de sécurité (CSP, `Permissions-Policy`, CORS, cache) sont dans `vercel.json`.
- Demain : hébergement Scaleway avec Docker. `vercel.json` n'est plus lu : **sans action, le site n'aurait plus aucune CSP**.
- Matomo est intégré dans le code (`src/scripts/matomo.ts`, sans cookie de suivi, variables `PUBLIC_MATOMO_URL` et `PUBLIC_MATOMO_SITE_ID`, vides = désactivé). **L'instance est installée** par l'infra : `https://stats.tndm.fr` (ID 3 = ChatVote, ID 1 = tndm.fr), administration réservée au réseau privé (ZTNA).

## Décision : la CSP est gérée par le serveur web (Caddy)

Pas par un middleware Astro.

**Pourquoi**
- Caddy pose les en-têtes sur **toutes** les réponses, y compris les fichiers statiques. Avec l'adapter Node d'Astro, `/fonts/*`, `/zaq-widget.css` et `/_astro/*` ne passent pas forcément par le middleware, alors qu'ils ont besoin de CORS (iframe Zaq) et d'un cache précis.
- C'est la même logique que `vercel.json` (en-têtes par chemin) : la migration est une traduction, pas une réécriture.
- Un seul mécanisme, sans code applicatif. Une erreur dans un middleware pourrait supprimer la CSP sans que rien ne casse visiblement.
- Caddy est de toute façon prévu (HTTPS automatique, reverse proxy).

## À faire

1. **Caddyfile versionné dans ce repo**, avec un bloc d'en-têtes par chemin, traduction de `vercel.json` :
   - tout (`/*`) : `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY` ;
   - `/_astro/*` : `Cache-Control: public, max-age=31536000, immutable` ;
   - `/fonts/*` : même cache + `Access-Control-Allow-Origin: <ORIGINE_ZAQ>` ;
   - `/zaq-widget.css` : `Cache-Control: public, max-age=3600` + `Access-Control-Allow-Origin: <ORIGINE_ZAQ>` ;
   - `/communes-index.json` : `Cache-Control: public, max-age=3600`.
2. **CSP actuelle** (à reprendre, plus l'origine Matomo) :
   ```
   default-src 'self';
   script-src 'self' <ORIGINE_ZAQ> <ORIGINE_MATOMO>;
   style-src 'self';
   font-src 'self';
   img-src 'self' data: <ORIGINE_MATOMO>;
   connect-src 'self' <ORIGINE_ZAQ> wss://<HOTE_ZAQ> <ORIGINE_MATOMO>;
   frame-src <ORIGINE_ZAQ>;
   base-uri 'self';
   form-action 'none';
   frame-ancestors 'none'
   ```
   `<ORIGINE_MATOMO>` (`https://stats.tndm.fr`) doit figurer dans **trois** directives : `script-src`, `connect-src` et `img-src`. **Pas de `frame-src`** : l'iframe d'opposition Matomo n'est pas publiée (voir plus bas), l'opposition passe par une case à cocher de la page. Déjà fait dans `vercel.json` ; à reporter dans le Caddyfile.
3. **Adapter Astro** : remplacer `@astrojs/vercel` par `@astrojs/node` (`index.astro` et `/api/widget-identity` sont rendus à la demande). Mettre à jour `astro.config.mjs`.
4. **Test** : adapter `src/vercel-config.test.ts` pour qu'il lise le Caddyfile. Il doit continuer de vérifier : origine Zaq cohérente avec `.env.example`, aucun `unsafe-*` ni joker, `frame-ancestors 'none'`, CORS de `/fonts/*` et `/zaq-widget.css`. Le test Matomo est à part (`src/matomo-csp.test.ts`) : origine Matomo de `.env.example` dans `script-src`, `connect-src`, `img-src`, et absente de `frame-src`. **À corriger** : `src/vercel-config.test.ts` échoue déjà (hors Matomo) parce que `PUBLIC_ZAQ_URL` est vide dans `.env.example` ; décider s'il faut y remettre l'URL ou faire lire l'origine Zaq ailleurs.
5. **Docs** : mettre à jour `CLAUDE.md` (sections « Hébergement », « CSP et en-têtes (`vercel.json`) », structure du projet) et supprimer `vercel.json` une fois la migration validée.
6. **Vérification après déploiement** : `curl -I` sur la page, `/fonts/Manrope-Variable.woff2` et `/zaq-widget.css` ; aucune erreur CSP dans la console ; onglet Réseau limité à notre domaine, Zaq et Matomo ; exactement deux cookies (`userID`, `conversationId`), plus `mtm_consent_removed` seulement après une opposition à la mesure d'audience.

Rappel : l'origine Zaq est écrite en dur (à mettre à jour quand l'URL Zaq change). Idem pour Matomo.

## Matomo : état de l'instance (installée par l'infra)

- Instance publique : `https://stats.tndm.fr` (domaine stable ; l'infra prévient avant tout changement, la CSP en dépend). `matomo.js` et `matomo.php` accessibles en HTTPS ; l'administration reste sur le réseau privé (ZTNA).
- Sites : ChatVote = **3** (adresse déclarée : `app.chatvote.org`), tndm.fr = **1**. Fuseau Europe/Paris, EUR.
- **Matomo ignore les visites dont l'adresse n'est pas déclarée** : si le site de production n'est pas servi sous `app.chatvote.org`, demander à l'infra d'ajouter le domaine (sinon aucune statistique). Les previews Vercel et `localhost` ne sont pas comptés, ce qui évite de polluer les stats.
- Réglages de confidentialité confirmés : IP anonymisée sur 2 octets, Do Not Track pris en charge (les visiteurs concernés ne sont pas comptés), journaux de visite supprimés à **90 jours** (statistiques agrégées conservées), User ID / enregistrement de sessions / heatmaps / suivi de formulaires non installés, installation d'extensions verrouillée.
- GeoIP : module présent, sans base de localisation (aucune localisation par IP). Matomo peut cependant déduire un pays approximatif de la langue du navigateur.
- **L'iframe d'opposition Matomo n'est pas publiée** (elle fait partie de l'interface d'administration ; un filtre sur son URL a été jugé contournable). L'opposition est faite dans notre page : case à cocher + `optUserOut` / `forgetUserOptOut` / `isUserOptedOut` de `matomo.js` (`src/scripts/matomo-optout.ts`). Le choix est mémorisé par un cookie first-party `mtm_consent_removed` (30 ans par défaut dans `matomo.js`), posé seulement après une opposition. Vérifié dans le code de `matomo.js` : ce cookie est écrit même avec `disableCookies`, et après opposition les requêtes ne partent plus.

## Après installation de Matomo

1. ~~Créer les sites, noter les ID~~ : fait (ChatVote = 3).
2. **Renseigner `PUBLIC_MATOMO_URL=https://stats.tndm.fr` et `PUBLIC_MATOMO_SITE_ID=3`** dans `.env` (local) et dans l'environnement de déploiement (Vercel puis Scaleway). `.env.example` est à jour.
3. ~~Ajouter l'origine Matomo à la CSP~~ : fait dans `vercel.json` (trois directives) ; à reporter dans le Caddyfile.
4. **Tester en préproduction** : après opposition (case décochée), plus aucune requête vers `matomo.php` n'est envoyée depuis la page ; recocher la case rétablit le suivi ; aucune erreur CSP dans la console.
5. Mettre à jour `CLAUDE.md` (fait pour Matomo ; la section sur Zaq hébergé par Tandem reste à relire).

## Politique de confidentialité : état et reste à faire

La page `/politique-de-confidentialite` existe (`src/pages/politique-de-confidentialite.astro`, mise en page commune `src/components/LegalPage.astro`, lien dans le footer et dans les mentions légales). Elle contient la section « Mesure d'audience » et la case d'opposition (affichée seulement si `PUBLIC_MATOMO_URL` et `PUBLIC_MATOMO_SITE_ID` sont renseignées).

À faire avant la mise en production :

- **Compléter les « [À COMPLÉTER] »** du texte : la durée de conservation des conversations (section 2) et la finalité du cookie `_zaq_key` (section 5). Zaq est hébergé et exploité par Tandem (confirmé par l'équipe Zaq) ; la base légale est rédigée (intérêt légitime, art. 6.1.f), **à valider avec le juridique**, en soulevant les opinions politiques éventuellement saisies dans les questions (données sensibles, art. 9).
- **Cookie `_zaq_key`** : mentionné dans la page (section 5) ; durée de vie de 12 mois indiquée ; il reste à préciser sa finalité (« [À COMPLÉTER] »), à demander à l'équipe Zaq.
- **Modèle de langage** : auto-hébergé par Tandem (confirmé), précisé dans la section 4 de la page : aucun sous-traitant d'IA à citer. À remettre en cause si ce choix change.
- **Faire confirmer par l'équipe Zaq** que l'adresse IP n'est exploitée ni pour identifier ni pour localiser (l'introduction de la page l'affirme).
- **Ne publier la page que lorsque Matomo est actif** : la section « Mesure d'audience » s'affiche même si `PUBLIC_MATOMO_URL` est vide (choix assumé, pas de condition dans le code). Déployer la page et le suivi ensemble.
- **Réglages de l'instance Matomo** : confirmés par l'infra (IP sur 2 octets, Do Not Track, journaux à 90 jours). La page dit « 90 jours » et que la localisation par IP n'est pas utilisée (un pays approximatif peut venir de la langue du navigateur).
- **Hébergeur de Matomo** : la page ne cite plus Scaleway pour la mesure d'audience (l'instance est sur un serveur privé de Tandem, hébergeur à confirmer). Remettre l'hébergeur dans la section 4 s'il s'agit d'un prestataire.
- **Cookie `mtm_consent_removed`** (opposition) : mentionné dans les sections 3 et 5 de la page.
- Date de version (« Version du … ») à ajuster à la publication.
- Droit d'accès : le `userID` est HttpOnly (illisible), donc la page demande au visiteur son `conversationId` (cookie lisible, de la forme `<codeCommune>:<id>` : seule la partie après les deux-points est l'identifiant Zaq). À confirmer avec l'équipe Zaq : retrouver et supprimer, à partir d'un `conversation_id`, toutes les conversations du même utilisateur.

## Reste à faire plus tard (hors migration)

- Confirmer avec l'infra le(s) domaine(s) de production de ChatVote déclaré(s) dans Matomo.
- `docs/matomo-politique-confidentialite.md` est l'ancien brief (iframe d'opposition, rétention 25 mois) : en partie dépassé par ce document.
