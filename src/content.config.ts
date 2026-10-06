import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// Un fichier par compte rendu. Les métadonnées alimentent la vue liste de la
// modale ; le corps Markdown (copié tel quel de la source) et `items` forment
// la vue détail. L'année est dérivée de `date` (une seule source de vérité).
const item = z.object({
  title: z.string(),
  // Valeur brute de la source (ex. « presentee »), traduite à l'affichage.
  vote: z.string(),
  amount: z.string().optional(),
  summary: z.string(),
});

const records = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/records" }),
  schema: z.object({
    // Libellé affiché : « Procès-verbal » ou autre type de document.
    type: z.string().default("Procès-verbal"),
    date: z.coerce.date(),
    // Sert au compteur de la liste ; remplacé par `items.length` si `items` est rempli.
    deliberations: z.number().int().nonnegative(),
    status: z.enum(["ready", "upcoming"]),
    // Lien vers le document officiel.
    sourceUrl: z.url().optional(),
    // Pastilles « Sujets dans le temps » (décoratives).
    topics: z.array(z.string()).default([]),
    // Une carte par délibération.
    items: z.array(item).default([]),
  }),
});

export const collections = { records };
