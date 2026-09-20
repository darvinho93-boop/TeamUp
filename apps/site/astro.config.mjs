// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://teamup.fr',
  output: 'static',
  integrations: [
    sitemap({
      // Ni la page de démonstration des composants, ni la page de remerciement.
      filter: (page) => !page.includes('/kit-ui') && !page.includes('/confirmation'),
    }),
  ],
});
