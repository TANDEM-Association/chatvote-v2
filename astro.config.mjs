import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  build: {
    // Pas de <style> inline : permet une CSP sans 'unsafe-inline'.
    inlineStylesheets: "never",
  },
});
