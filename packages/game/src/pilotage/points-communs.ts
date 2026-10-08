/**
 * Pilotage de Points communs : les cinq touches de la régie (spec v3, jeu 01), plus l'échec.
 *
 *   pret ──afficher──▶ consigne ──masquer──▶ masque ──lancer──▶ lance ──valider──▶ trouve
 *                                                                  └──échec───▶ echec
 *
 * `consigne` : l'équipe a les yeux fermés, l'écran montre le point commun à la salle.
 * `lance` : le chrono de 130 s tourne, et s'arrête seul à la fin des paliers 1 et 2. « Indice »
 * ne se donne que pendant cet arrêt : il révèle l'indice et fait repartir le chrono quelques
 * secondes plus tard. Trouvé pendant l'arrêt : le palier qui s'ouvre compte en entier.
 *
 * `ecouleMs` est partout le temps écoulé depuis le lancement, arrêts compris : le temps de jeu
 * s'en déduit avec les instants des indices (`tempsDeJeu`).
 */

import {
  CHRONO_POINTS_COMMUNS_S,
  etatPaliers,
  scorePointsCommuns,
  tempsDeJeu,
} from '../points-communs';
import type { Chrono } from './transition';

export type EtapePointsCommuns = 'pret' | 'consigne' | 'masque' | 'lance' | 'trouve' | 'echec';
export type ActionPointsCommuns =
  'afficher' | 'masquer' | 'lancer' | 'indice' | 'valider' | 'echec';

export interface EtatPointsCommuns {
  etape: EtapePointsCommuns;
  indices: number;
  /** L'instant de chaque indice donné, en ms depuis le lancement du chrono. */
  indicesMs: readonly number[];
}

export interface TransitionPointsCommuns {
  etat: EtatPointsCommuns;
  chrono: Chrono;
  /** Présents quand le passage se termine. */
  points?: number;
  resultat?: {
    /** Temps de jeu, arrêts déduits. */
    ecoule_ms: number;
    palier: number;
    indices: number;
    indices_ms: number[];
    trouve: boolean;
  };
}

export const ETAT_INITIAL_POINTS_COMMUNS: EtatPointsCommuns = {
  etape: 'pret',
  indices: 0,
  indicesMs: [],
};

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
      // L'indice se donne chrono arrêté, une fois par arrêt.
      return tempsDeJeu(ecouleMs, etat.indicesMs).arret?.repriseDansMs === null
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
      return {
        etat: {
          ...etat,
          indices: etat.indices + 1,
          indicesMs: [...etat.indicesMs, Math.max(0, Math.round(ecouleMs))],
        },
        chrono: 'garder',
      };
    case 'valider':
    case 'echec': {
      const trouve = action === 'valider';
      const { jeuMs } = tempsDeJeu(ecouleMs, etat.indicesMs);
      const points = trouve ? scorePointsCommuns(jeuMs) : 0;
      return {
        etat: { ...etat, etape: trouve ? 'trouve' : 'echec' },
        chrono: 'arreter',
        points,
        resultat: {
          ecoule_ms: Math.round(jeuMs),
          palier: etatPaliers(jeuMs).palier + 1,
          indices: etat.indices,
          indices_ms: [...etat.indicesMs],
          trouve,
        },
      };
    }
  }
}
