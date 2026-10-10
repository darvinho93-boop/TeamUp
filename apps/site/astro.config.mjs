// @ts-check
import { defineConfig, envField } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://teamup-game.fr',
  // Tout reste pré-rendu, sauf /devis, qui traite l'envoi du formulaire.
  output: 'static',
  // Mesure d'audience sans cookie (lot 10) : conversion = vues de /confirmation ÷ visiteurs,
  // lue dans Vercel. Le script (/_vercel/insights, servi par le site) n'est plus posé d'office :
  // `Consentement.astro` le charge une fois la mesure acceptée par le visiteur.
  adapter: vercel({ webAnalytics: { enabled: false } }),
  env: {
    schema: {
      // Absente : les e-mails de devis sont écrits dans la console au lieu d'être envoyés.
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      DEVIS_DESTINATAIRE: envField.string({ context: 'server', access: 'secret', optional: true }),
      DEVIS_EXPEDITEUR: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  integrations: [
    sitemap({
      // Ni la page de démonstration des composants, ni la page de remerciement, ni la page 404.
      filter: (page) =>
        !page.includes('/kit-ui') && !page.includes('/confirmation') && !page.includes('/404'),
    }),
  ],
});
