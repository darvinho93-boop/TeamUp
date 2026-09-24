/**
 * Pilotage de la diffusion du Photo challenge (spec v3, jeu 05). Un passage par thème :
 *
 *   theme ──gagnante(n°)──▶ gagnante
 *     └────aucune──────────▶ aucune
 *
 * `theme` : toutes les photos du thème sont à l'écran, côte à côte. Les héros de la fête
 * désignent la gagnante à l'oral, la régie clique : +100 à son équipe. Un thème sans photo,
 * ou sans gagnante, se clôt sans points. Pas de chrono : la diffusion entière compte ≈ 5 min.
 */

import { scorePhoto } from '../photo';
import type { ScoresParEquipe } from '../scores';
import type { Chrono } from './transition';

export type EtapePhoto = 'theme' | 'gagnante' | 'aucune';

export type ActionPhoto =
  | {
      type: 'gagnante';
      equipe: number;
      /** Numéros des équipes qui ont envoyé une photo sur ce thème. */
      equipesAvecPhoto: readonly number[];
    }
  | { type: 'aucune' };

export interface TransitionPhoto {
  etape: EtapePhoto;
  chrono: Chrono;
  /** Présents au verdict, qui termine le thème. */
  points: ScoresParEquipe;
  resultat: { equipe_gagnante: number | null };
}

const PERMISES: Record<EtapePhoto, ActionPhoto['type'][]> = {
  theme: ['gagnante', 'aucune'],
  gagnante: [],
  aucune: [],
};

export function actionsPhoto(etape: EtapePhoto): ActionPhoto['type'][] {
  return PERMISES[etape];
}

export function appliquerPhoto(etape: EtapePhoto, action: ActionPhoto): TransitionPhoto {
  if (!actionsPhoto(etape).includes(action.type)) {
    throw new Error(`Photo : « ${action.type} » impossible à l'étape « ${etape} ».`);
  }
  if (action.type === 'aucune') {
    return { etape: 'aucune', chrono: 'garder', points: {}, resultat: { equipe_gagnante: null } };
  }
  if (!action.equipesAvecPhoto.includes(action.equipe)) {
    throw new RangeError(`Photo : l'équipe ${action.equipe} n'a rien envoyé sur ce thème.`);
  }
  return {
    etape: 'gagnante',
    chrono: 'garder',
    points: scorePhoto({ theme: action.equipe }),
    resultat: { equipe_gagnante: action.equipe },
  };
}
