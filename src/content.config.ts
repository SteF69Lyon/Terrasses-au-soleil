import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Blog collection — articles MDX servant de longue traîne SEO et de
// linking interne vers les pages ville/variation.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    /** Mots-clés ciblés (utilisés pour méta + suggestions liens). */
    keywords: z.array(z.string()).default([]),
    /** Slugs de villes à mettre en avant en fin d'article (cross-link SEO). */
    relatedCities: z.array(z.string()).default([]),
    /** Variation lexicale ciblée si pertinent : oriente le bloc CTA. */
    relatedVariation: z.enum(['bar', 'cafe', 'restaurant', 'verre']).optional(),
  }),
});

export const collections = { blog };
