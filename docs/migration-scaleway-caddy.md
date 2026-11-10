# Migration Scaleway : en-têtes de sécurité par Caddy (et Matomo)

Brief à fournir au début de la session « préparation Docker / migration Scaleway ».

## Contexte

- Aujourd'hui : ChatVote (et tndm.fr) sont sur Vercel. Les en-têtes de sécurité (CSP, `Permissions-Policy`, CORS, cache) sont dans `vercel.json`.
- Demain : hébergement Scaleway avec Docker. `vercel.json` n'est plus lu : **sans action, le site n'aurait plus aucune CSP**.
- Matomo est déjà intégré dans le code (`src/scripts/matomo.ts`, sans cookie, variables `PUBLIC_MATOMO_URL` et `PUBLIC_MATOMO_SITE_ID`, vides = désactivé). L'instance n'existe pas encore : l'infra doit l'installer (voir plus bas).

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
   frame-src <ORIGINE_ZAQ> <ORIGINE_MATOMO>;
   base-uri 'self';
   form-action 'none';
   frame-ancestors 'none'
   ```
   `<ORIGINE_MATOMO>` doit figurer dans **quatre** directives : `script-src`, `connect-src`, `img-src` et `frame-src`. La dernière sert à l'iframe d'opposition de la page `/politique-de-confidentialite`, déjà dans le code : sans elle, le module est bloqué.
3. **Adapter Astro** : remplacer `@astrojs/vercel` par `@astrojs/node` (`index.astro` et `/api/widget-identity` sont rendus à la demande). Mettre à jour `astro.config.mjs`.
4. **Test** : adapter `src/vercel-config.test.ts` pour qu'il lise le Caddyfile. Il doit continuer de vérifier : origine Zaq cohérente avec `.env.example`, origine Matomo cohérente avec `.env.example` (si définie), aucun `unsafe-*` ni joker, `frame-ancestors 'none'`, CORS de `/fonts/*` et `/zaq-widget.css`. À ajouter : l'origine Matomo dans `frame-src` (le test actuel ne contrôle que `script-src`, `connect-src` et `img-src`).
5. **Docs** : mettre à jour `CLAUDE.md` (sections « Hébergement », « CSP et en-têtes (`vercel.json`) », structure du projet) et supprimer `vercel.json` une fois la migration validée.
6. **Vérification après déploiement** : `curl -I` sur la page, `/fonts/Manrope-Variable.woff2` et `/zaq-widget.css` ; aucune erreur CSP dans la console ; onglet Réseau limité à notre domaine, Zaq et Matomo ; exactement deux cookies (`userID`, `conversationId`).

Rappel : l'origine Zaq est écrite en dur (à mettre à jour quand l'URL Zaq change). Idem pour Matomo.

## Matomo : installation (côté infra)

- Une seule instance pour ChatVote et tndm.fr (un ID de site chacun).
- Domaine dédié, par exemple `stats.tndm.fr`, en HTTPS.
- Docker Compose : `mariadb` (volume persistant), `matomo` (image officielle `matomo:apache`, volume persistant), `caddy` en reverse proxy (HTTPS automatique).
- Serveur Scaleway de base (1 à 2 vCPU, 2 Go), ports 80 et 443 seulement.
- Compte administrateur avec mot de passe fort et double authentification.
- Archivage par cron toutes les heures : `docker exec matomo php console core:archive` ; désactiver l'archivage déclenché par le navigateur.
- Sauvegardes régulières de la base et du volume ; mises à jour régulières de l'image.
- Réglages de confidentialité dans l'interface (voir `docs/matomo-politique-confidentialite.md`) : anonymisation de l'IP (2 octets minimum), respect de Do Not Track, rétention des journaux 25 mois maximum. Ne pas activer User ID, enregistrement de sessions, heatmaps.

## Après installation de Matomo

1. Créer les sites ChatVote et tndm.fr dans Matomo, noter les ID.
2. Renseigner `PUBLIC_MATOMO_URL` (URL complète, sans slash final) et `PUBLIC_MATOMO_SITE_ID` dans `.env` et dans l'environnement de déploiement.
3. Ajouter l'origine Matomo à la CSP, dans les quatre directives (Caddyfile, ou `vercel.json` si le site est encore sur Vercel à ce moment-là).
4. Mettre à jour `CLAUDE.md` : « Analytics : Aucun » devient « Matomo auto-hébergé, sans cookie » ; « Pages légales : reportées » devient « mentions légales et politique de confidentialité en place » ; section Confidentialité (cookies, absence d'analytics) ; structure du projet (`LegalPage.astro`, `politique-de-confidentialite.astro`, `matomo.ts`).

## Politique de confidentialité : état et reste à faire

La page `/politique-de-confidentialite` existe (`src/pages/politique-de-confidentialite.astro`, mise en page commune `src/components/LegalPage.astro`, lien dans le footer et dans les mentions légales). Elle contient la section « Mesure d'audience » et l'iframe d'opposition Matomo (affichée seulement si `PUBLIC_MATOMO_URL` est renseignée).

À faire avant la mise en production :

- **Compléter les « [À COMPLÉTER] »** du texte : la durée de conservation des conversations (section 2) et la finalité du cookie `_zaq_key` (section 5). Zaq est hébergé et exploité par Tandem (confirmé par l'équipe Zaq) ; la base légale est rédigée (intérêt légitime, art. 6.1.f), **à valider avec le juridique**, en soulevant les opinions politiques éventuellement saisies dans les questions (données sensibles, art. 9).
- **Cookie `_zaq_key`** : mentionné dans la page (section 5) ; durée de vie de 12 mois indiquée ; il reste à préciser sa finalité (« [À COMPLÉTER] »), à demander à l'équipe Zaq.
- **Modèle de langage** : auto-hébergé par Tandem (confirmé), précisé dans la section 4 de la page : aucun sous-traitant d'IA à citer. À remettre en cause si ce choix change.
- **Faire confirmer par l'équipe Zaq** que l'adresse IP n'est exploitée ni pour identifier ni pour localiser (l'introduction de la page l'affirme).
- **Ne publier la page que lorsque Matomo est actif** : la section « Mesure d'audience » s'affiche même si `PUBLIC_MATOMO_URL` est vide (choix assumé, pas de condition dans le code). Déployer la page et le suivi ensemble.
- **Réglages de confidentialité de l'instance Matomo** faits avant la mise en ligne (anonymisation de l'IP, Do Not Track, rétention 25 mois) : le texte juridique les suppose en place.
- Si Matomo est configuré avec une géolocalisation par IP, le mentionner dans « Données collectées » (l'introduction affirme que la localisation n'est pas collectée).
- Date de version (« Version du … ») à ajuster à la publication.
- Droit d'accès : le `userID` est HttpOnly (illisible), donc la page demande au visiteur son `conversationId` (cookie lisible, de la forme `<codeCommune>:<id>` : seule la partie après les deux-points est l'identifiant Zaq). À confirmer avec l'équipe Zaq : retrouver et supprimer, à partir d'un `conversation_id`, toutes les conversations du même utilisateur.

## Reste à faire plus tard (hors migration)

- Confirmer avec la personne en charge de l'infra l'URL de l'instance et le domaine.
- Commiter les fichiers non suivis (`docs/matomo-politique-confidentialite.md`, ce document).
