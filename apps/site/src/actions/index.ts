import { defineAction } from 'astro:actions';
import { DEVIS_DESTINATAIRE, DEVIS_EXPEDITEUR, RESEND_API_KEY } from 'astro:env/server';
import { estUnRobot } from '../lib/devis/antispam';
import { aujourdhuiAParis, lireDevis, type Erreurs, type Saisie } from '../lib/devis/schema';
import { envoyerDevis } from '../lib/devis/send';

export type ResultatDevis =
  | { statut: 'envoyee' }
  | { statut: 'invalide'; erreurs: Erreurs; saisie: Saisie }
  | { statut: 'echec'; saisie: Saisie };

export const server = {
  /**
   * Envoi du formulaire de devis, en POST natif : fonctionne sans JavaScript.
   * La page /devis lit le résultat pour afficher les erreurs ou rediriger.
   */
  devis: defineAction({
    accept: 'form',
    handler: async (form: FormData): Promise<ResultatDevis> => {
      if (estUnRobot(form)) return { statut: 'envoyee' };

      const lecture = lireDevis(form, aujourdhuiAParis());
      if (!lecture.ok) {
        return { statut: 'invalide', erreurs: lecture.erreurs, saisie: lecture.saisie };
      }

      const envoyee = await envoyerDevis(lecture.demande, {
        apiKey: RESEND_API_KEY,
        destinataire: DEVIS_DESTINATAIRE,
        expediteur: DEVIS_EXPEDITEUR,
      });
      return envoyee ? { statut: 'envoyee' } : { statut: 'echec', saisie: lecture.saisie };
    },
  }),
};
