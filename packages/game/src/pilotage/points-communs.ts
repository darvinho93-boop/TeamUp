/**
 * Pilotage de Points communs : les cinq touches de la régie (spec v3, jeu 01), plus l'échec.
 *
 *   pret ──afficher──▶ consigne ──masquer──▶ masque ──lancer──▶ lance ──valider──▶ trouve
 *                                                                  └──échec───▶ echec
 *
 * `consigne` : l'équipe a les yeux fermés, l'écran montre le point commun à la salle.
 * `lance` : le chrono de 130 s tourne ; « Indice » révèle un indice de plus, mais jamais avant
 * le palier qui l'autorise (un au palier 2, deux au palier 3).
 */

import { CHRONO_POINTS_COMMUNS_S, etatPaliers, scorePointsCommuns } from '../points-communs';
import type { Chrono } from './transition';

export type EtapePointsCommuns = 'pret' | 'consigne' | 'masque' | 'lance' | 'trouve' | 'echec';
export type ActionPointsCommuns =
  'afficher' | 'masquer' | 'lancer' | 'indice' | 'valider' | 'echec';

export interface EtatPointsCommuns {
  etape: EtapePointsCommuns;
  indices: number;
}

export interface TransitionPointsCommuns {
  etat: EtatPointsCommuns;
  chrono: Chrono;
  /** Présents quand le passage se termine. */
  points?: number;
  resultat?: { ecoule_ms: number; palier: number; indices: number; trouve: boolean };
}

export const ETAT_INITIAL_POINTS_COMMUNS: EtatPointsCommuns = { etape: 'pret', indices: 0 };

export function actionsPointsCommuns(
  etat: EtatPointsCommuns,
  ecouleMs: number,
): ActionPointsCommuns[] {
  switch (etat.etape) {
    case 'pret':
      return ['afficher'];
    case 'consigne':
      return ['masquer'];
    case 'masque':
      return ['lancer'];
    case 'lance':
      return etat.indices < etatPaliers(ecouleMs).indices
        ? ['indice', 'valider', 'echec']
        : ['valider', 'echec'];
    case 'trouve':
    case 'echec':
      return [];
  }
}

export function appliquerPointsCommuns(
  etat: EtatPointsCommuns,
  action: ActionPointsCommuns,
  ecouleMs: number,
): TransitionPointsCommuns {
  if (!actionsPointsCommuns(etat, ecouleMs).includes(action)) {
    throw new Error(`Points communs : « ${action} » impossible à l'étape « ${etat.etape} ».`);
  }
  switch (action) {
    case 'afficher':
      return { etat: { ...etat, etape: 'consigne' }, chrono: 'garder' };
    case 'masquer':
      return { etat: { ...etat, etape: 'masque' }, chrono: 'garder' };
    case 'lancer':
      return {
        etat: { ...etat, etape: 'lance' },
        chrono: { demarrer: CHRONO_POINTS_COMMUNS_S },
      };
    case 'indice':
      return { etat: { ...etat, indices: etat.indices + 1 }, chrono: 'garder' };
    case 'valider':
    case 'echec': {
      const trouve = action === 'valider';
      const points = trouve ? scorePointsCommuns(ecouleMs) : 0;
      return {
        etat: { ...etat, etape: trouve ? 'trouve' : 'echec' },
        chrono: 'arreter',
        points,
        resultat: {
          ecoule_ms: Math.max(0, Math.round(ecouleMs)),
          palier: etatPaliers(ecouleMs).palier + 1,
          indices: etat.indices,
          trouve,
        },
      };
    }
  }
}
