import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const journal = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/journal" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      // One-line summary: list row, post intro, <meta description>.
      description: z.string(),
      date: z.coerce.date(),
      tags: z.array(z.string()).default([]),
      // Optional. Text-only posts are the norm; a cover adds a thumbnail to the list row.
      cover: image().optional(),
      coverAlt: z.string().default(""),
      draft: z.boolean().default(false),
    }),
});

export const collections = { journal };
