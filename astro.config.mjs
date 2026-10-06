import vercel from "@astrojs/vercel";
import { defineConfig } from "astro/config";

export default defineConfig({
  // Site statique : seule la route /api/widget-identity est rendue à la demande
  // (export const prerender = false).
  output: "static",
  adapter: vercel(),
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
