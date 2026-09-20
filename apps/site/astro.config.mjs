// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://teamup.fr',
  output: 'static',
  integrations: [
    sitemap({
      // La page de démonstration des composants n'a rien à faire dans l'index.
      filter: (page) => !page.includes('/kit-ui'),
    }),
  ],
});
