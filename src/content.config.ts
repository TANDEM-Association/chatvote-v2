import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// Un fichier par compte rendu. Les métadonnées alimentent la vue liste de la
// modale ; le corps Markdown servira à la vue détail. L'année est dérivée de
// `date` (une seule source de vérité).
const records = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/records" }),
  schema: z.object({
    // Libellé affiché : « Procès-verbal » ou autre type de document.
    type: z.string().default("Procès-verbal"),
    date: z.coerce.date(),
    deliberations: z.number().int().nonnegative(),
    status: z.enum(["ready", "upcoming"]),
  }),
});

export const collections = { records };
