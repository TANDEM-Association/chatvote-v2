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
