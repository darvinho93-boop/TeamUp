// @ts-check
import { defineConfig, envField } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://teamup.fr',
  // Tout reste pré-rendu, sauf /devis, qui traite l'envoi du formulaire.
  output: 'static',
  // Mesure d'audience sans cookie (lot 10) : conversion = vues de /confirmation ÷ visiteurs,
  // lue dans Vercel. Script servi par le site lui-même (/_vercel/insights), aucun tiers.
  adapter: vercel({ webAnalytics: { enabled: true } }),
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
      // Ni la page de démonstration des composants, ni la page de remerciement.
      filter: (page) => !page.includes('/kit-ui') && !page.includes('/confirmation'),
    }),
  ],
});
