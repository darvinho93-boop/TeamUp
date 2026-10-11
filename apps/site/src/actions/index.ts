import { defineAction } from 'astro:actions';
import { DEVIS_DESTINATAIRE, DEVIS_EXPEDITEUR, RESEND_API_KEY } from 'astro:env/server';
import { estUnRobot } from '../lib/devis/antispam';
import { aujourdhuiAParis, lireDevis, type Erreurs, type Saisie } from '../lib/devis/schema';
import { envoyerDevis } from '../lib/devis/send';
import { provenanceDepuis, type Provenance } from '../lib/devis/provenance';

export type ResultatDevis =
  | { statut: 'envoyee' }
  | { statut: 'invalide'; erreurs: Erreurs; saisie: Saisie; provenance: Provenance }
  | { statut: 'echec'; saisie: Saisie; provenance: Provenance };

export const server = {
  /**
   * Envoi du formulaire de devis, en POST natif : fonctionne sans JavaScript.
   * La page /devis lit le résultat pour afficher les erreurs ou rediriger.
   */
  devis: defineAction({
    accept: 'form',
    handler: async (form: FormData): Promise<ResultatDevis> => {
      if (estUnRobot(form)) return { statut: 'envoyee' };

      // Le lien partagé et la page d'où vient le visiteur : gardés si le formulaire se réaffiche.
      const provenance = provenanceDepuis(form);
      const lecture = lireDevis(form, aujourdhuiAParis());
      if (!lecture.ok) {
        return {
          statut: 'invalide',
          erreurs: lecture.erreurs,
          saisie: lecture.saisie,
          provenance,
        };
      }

      const envoyee = await envoyerDevis(
        lecture.demande,
        {
          apiKey: RESEND_API_KEY,
          destinataire: DEVIS_DESTINATAIRE,
          expediteur: DEVIS_EXPEDITEUR,
        },
        provenance,
      );
      return envoyee
        ? { statut: 'envoyee' }
        : { statut: 'echec', saisie: lecture.saisie, provenance };
    },
  }),
};
