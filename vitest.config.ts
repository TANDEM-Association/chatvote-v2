import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Le kit de portage est du matériau de référence : ses tests ne sont pas les nôtres.
    exclude: [...configDefaults.exclude, "refactor-commune-selector/**"],
  },
});
