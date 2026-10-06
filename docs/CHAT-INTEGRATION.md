# Intégration du chat en iframe — informations pour l'équipe du chat

Ce document résume ce que le site ChatVote attend de l'application chat qu'il intègre en iframe, et les points à vérifier ensemble.

## Contexte

Le nouveau site est une **coquille statique** (Astro) composée d'un bandeau, d'un header, d'un footer et, entre les deux, d'un **iframe pleine largeur** qui affiche le chat.

- Le site et le chat seront sur **deux domaines différents**.
- V1 : commune **Saint-Saturnin, code `63396`**.
- Le site **ne pose aucun cookie** et **n'appelle aucun service tiers**.

## À mettre en place côté chat (bloquant)

1. **Autoriser l'intégration en iframe.**
   - Envoyer `Content-Security-Policy: frame-ancestors <domaine du site>`.
   - Ne pas envoyer `X-Frame-Options: DENY` ni `SAMEORIGIN`.
   - Sans cela, l'iframe reste vide.
   - Autoriser le domaine de prod (pas encore connu) et au moins un domaine de preview pour les tests. Les URLs de preview Vercel changent à chaque branche : un `*.vercel.app` serait trop large, la liste des domaines autorisés est à définir ensemble.
2. **Servir le chat en HTTPS** (prérequis pour les cookies décrits plus bas).

## Questions à clarifier

| # | Question | Pourquoi c'est nécessaire |
|---|---|---|
| 1 | **Quelle application cible ?** App de prod (`app.chatvote.org`) ou v2 (`chatvote-v2-…vercel.app`) ? Quelle URL finale ? | Détermine l'URL de l'iframe et la CSP de notre site. |
| 2 | **Quel paramètre d'URL pour le code commune ?** La v1 utilise `municipality_code`, la v2 semble utiliser `commune`, `municipalityCode` a aussi été évoqué. | Notre site relaie ce paramètre sous un nom configurable. Il faut le nom exact. |
| 3 | **Quels autres paramètres sont nécessaires ?** L'URL d'exemple de la v2 contient `institutionId` et `conseilView`. Sont-ils obligatoires ? `institutionId` dépend-il de la commune ? | Fixe la liste blanche de paramètres relayés vers l'iframe. Leur rôle n'a pas pu être vérifié côté site. |
| 4 | **Le chat pose-t-il des cookies ou du stockage local ?** Session, préférences, thème, analytics… (la v1 proposait « Se connecter »). | Impacte le comportement en iframe cross-domain et l'information des utilisateurs. |
| 5 | **De quelles fonctionnalités navigateur le chat a-t-il besoin ?** Presse-papiers, micro, etc. | Chacune doit être déclarée dans l'attribut `allow` de l'iframe, limité au strict nécessaire. |

## Points techniques à vérifier ensemble

- **Cookies tiers.** Dans un iframe sur un autre domaine, les cookies du chat sont des cookies « tiers » : bloqués ou restreints par Safari et Firefox. S'il y en a (session notamment), prévoir `SameSite=None; Secure` et tester sur Safari/iOS. Le `localStorage` est aussi cloisonné dans ce contexte.
- **Connexion dans l'iframe.** Si l'authentification passe par une redirection ou une fenêtre externe (OAuth, par exemple), ces parcours se comportent souvent mal dans un iframe. À tester tôt.
- **RGPD.** Le site ne collecte rien, mais les cookies ou le stockage éventuels du chat relèvent de son domaine. Savoir si une information ou un consentement est nécessaire dans le chat est à voir avec la personne en charge du volet juridique.

## Adaptations souhaitables côté chat

Demandes de confort, non bloquantes :

- **Responsive à toute taille d'iframe**, avec son propre défilement interne. Sur mobile, l'iframe fait environ la hauteur de l'écran moins le bandeau, le header et le footer. Attention au clavier virtuel.
- **Thème sombre unique.** Le site n'a pas de thème clair, alors que le chat propose un sélecteur de thème. Idéalement : un paramètre ou un « mode embed » qui force le thème sombre (fond navy `#170742`).
- **Éviter les doublons avec l'habillage du site.** La v1 affichait ses propres logos, liens de navigation et appel au don (« Soutenez chatvote »), alors que le bandeau du site porte déjà un bouton « Soutenir ». Un mode embed qui masque ces éléments éviterait les redites.
- **Liens externes** : ouverture dans un nouvel onglet (ou `_top`), pour ne pas charger un site tiers à l'intérieur de l'iframe.

## Hors V1

- Échanges site ↔ chat par `postMessage` (synchronisation du thème, de l'URL ou de la commune). Cela demanderait de se mettre d'accord sur les origines autorisées de part et d'autre.
