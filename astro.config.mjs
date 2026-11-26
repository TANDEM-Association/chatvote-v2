import vercel from "@astrojs/vercel";
import { defineConfig, envField } from "astro/config";

export default defineConfig({
  // Site statique : seule la route /api/widget-identity est rendue à la demande
  // (export const prerender = false).
  output: "static",
  // URL publique : sert aux liens absolus des pages prérendues (aperçus de partage).
  site: "https://app.chatvote.org",
  adapter: vercel(),
  env: {
    schema: {
      // Secrets du jeton d'identité Zaq : serveur uniquement, jamais exposés au navigateur.
      ZAQ_SIGNING_KEY: envField.string({ context: "server", access: "secret" }),
      ZAQ_ISSUER: envField.string({ context: "server", access: "secret" }),
      ZAQ_AUDIENCE: envField.string({ context: "server", access: "secret" }),
      PUBLIC_ZAQ_WIDGET_ID: envField.number({
        context: "server",
        access: "public",
        int: true,
      }),
      // Dossier `pv/` du stockage des PV augmentés (lu par le serveur seulement).
      // Absent : aucun compte rendu affiché (ex. preview sans stockage).
      PV_BASE_URL: envField.string({
        context: "server",
        access: "public",
        optional: true,
        url: true,
      }),
    },
  },
  server: {
    // astro dev ignore vercel.json : la feuille du widget et les polices sont
    // chargées depuis l'iframe Zaq (autre origine), donc CORS aussi en local.
    // Feuille et polices sont publiques, sans cookies : * suffit en dev.
    headers: { "Access-Control-Allow-Origin": "*" },
  },
  build: {
    // Pas de <style> inline : permet une CSP sans 'unsafe-inline'.
    inlineStylesheets: "never",
  },
  vite: {
    plugins: [
      {
        // Dev uniquement. Le serveur de dev d'Astro 7 répond 403 aux sous-ressources
        // « cross-site » sans en-tête Origin. Or la feuille du widget et les polices
        // sont chargées par l'iframe Zaq (autre site) : on retire Sec-Fetch-Site pour
        // ces seuls chemins publics, avant les middlewares d'Astro.
        name: "dev-allow-zaq-assets",
        apply: "serve",
        configureServer(server) {
          server.httpServer?.prependListener("request", (req) => {
            if (
              req.url === "/zaq-widget.css" ||
              req.url?.startsWith("/fonts/")
            ) {
              delete req.headers["sec-fetch-site"];
            }
          });
        },
      },
    ],
    // Dev uniquement : Vite ne répond au CORS (dont le preflight OPTIONS) que pour
    // les origines localhost. L'iframe Zaq (ngrok) en est une autre.
    server: { cors: true },
    build: {
      // Astro inline les petits scripts : interdit par script-src 'self'.
      assetsInlineLimit: 0,
    },
  },
});
