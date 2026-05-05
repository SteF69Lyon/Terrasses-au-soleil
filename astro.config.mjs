import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://terrasse-au-soleil.fr',
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.includes('/app/'),
      changefreq: 'monthly',
      priority: 0.7,
      // <lastmod> sur chaque entrée = date du build. Google voit "sitemap mis
      // à jour, je dois re-crawler". Sans cette balise, le sitemap est
      // considéré stable et n'est ré-évalué qu'au rythme par défaut du
      // crawler (parfois 2-4 semaines).
      lastmod: new Date(),
    }),
    mdx(),
  ],
  output: 'static',
  build: {
    format: 'directory',
  },
  vite: {
    ssr: {
      noExternal: ['react-leaflet'],
    },
  },
});
