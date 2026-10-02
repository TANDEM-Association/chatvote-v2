import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
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
