/**
 * Pilotage du Mime, chaîne alternée (spec v3, jeu 04). Un passage par équipe :
 *
 *   pret ──montrer──▶ secret ──lancer──▶ lance ──trouvé──▶ trouve
 *                                          └──raté───▶ rate
 *
 * `secret` : la régie montre le mot à J1, sur son propre écran seulement ; la salle ne voit
 * que l'équipe en jeu. `lance` : la chaîne part, chrono de 2 min 30. Le dernier maillon annonce,
 * la régie révèle : l'écran passe au vert si le mot est trouvé, au rouge sinon.
 */

import { FICHES } from '../catalogue';
import { scoreMime } from '../mime';
import type { Chrono } from './transition';

export const CHRONO_MIME_S = FICHES.mime2.chronoPassageS;

export type EtapeMime = 'pret' | 'secret' | 'lance' | 'trouve' | 'rate';
export type ActionMime = 'montrer' | 'lancer' | 'trouve' | 'rate';

export interface TransitionMime {
  etape: EtapeMime;
  chrono: Chrono;
  /** Présents au verdict, qui termine le passage. */
  points?: number;
  resultat?: { trouve: boolean; ecoule_ms: number };
}

const PERMISES: Record<EtapeMime, ActionMime[]> = {
  pret: ['montrer'],
  secret: ['lancer'],
  lance: ['trouve', 'rate'],
  trouve: [],
  rate: [],
};

export function actionsMime(etape: EtapeMime): ActionMime[] {
  return PERMISES[etape];
}

export function appliquerMime(
  etape: EtapeMime,
  action: ActionMime,
  ecouleMs: number,
): TransitionMime {
  if (!actionsMime(etape).includes(action)) {
    throw new Error(`Mime : « ${action} » impossible à l'étape « ${etape} ».`);
  }
  switch (action) {
    case 'montrer':
      return { etape: 'secret', chrono: 'garder' };
    case 'lancer':
      return { etape: 'lance', chrono: { demarrer: CHRONO_MIME_S } };
    case 'trouve':
    case 'rate': {
      const trouve = action === 'trouve';
      return {
        etape: action,
        chrono: 'arreter',
        points: scoreMime(trouve),
        resultat: { trouve, ecoule_ms: Math.max(0, Math.round(ecouleMs)) },
      };
    }
  }
}
