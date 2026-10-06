import vercel from "@astrojs/vercel";
import { defineConfig, envField } from "astro/config";

export default defineConfig({
  // Site statique : seule la route /api/widget-identity est rendue à la demande
  // (export const prerender = false).
  output: "static",
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
    build: {
      // Astro inline les petits scripts : interdit par script-src 'self'.
      assetsInlineLimit: 0,
    },
  },
});
