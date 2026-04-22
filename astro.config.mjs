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
