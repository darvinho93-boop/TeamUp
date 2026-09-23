/**
 * Points communs (`list2`). Trois paliers de 60 / 35 / 35 s, multiplicateurs ×3 / ×2 / ×1,
 * un indice de plus à chaque nouveau palier.
 *
 * Barème cumulé (décision du 2026-09-23) : le reste du palier en cours compte avec son
 * multiplicateur, les paliers suivants comptent en entier. Trouvé au départ :
 * 60×3 + 35×2 + 35×1 = 285, le maximum de la spec. Échec : 0.
 *
 * Tout se déduit du temps restant en secondes entières : l'écran, les indices et le score
 * lisent la même valeur.
 */

import { FICHES } from './catalogue';
import { tempsRestant } from './chrono';

export const PALIERS = [
  { dureeS: 60, multiplicateur: 3 },
  { dureeS: 35, multiplicateur: 2 },
  { dureeS: 35, multiplicateur: 1 },
] as const;

export const CHRONO_POINTS_COMMUNS_S = FICHES.list2.chronoPassageS;
export const SCORE_MAX_POINTS_COMMUNS = PALIERS.reduce(
  (total, p) => total + p.dureeS * p.multiplicateur,
  0,
);

export interface EtatPaliers {
  /** 0, 1 ou 2 ; le dernier palier une fois le chrono écoulé. */
  palier: number;
  multiplicateur: number;
  resteDansPalierS: number;
  resteTotalS: number;
  /** Nombre d'indices à montrer : un de plus à chaque palier franchi. */
  indices: number;
  termine: boolean;
}

/** Secondes restantes de chaque palier, le dernier se vidant en dernier. */
function restesParPalier(resteTotalS: number): number[] {
  let aRepartir = resteTotalS;
  const restes = new Array<number>(PALIERS.length).fill(0);
  for (let i = PALIERS.length - 1; i >= 0; i--) {
    const part = Math.min(aRepartir, PALIERS[i]!.dureeS);
    restes[i] = part;
    aRepartir -= part;
  }
  return restes;
}

export function etatPaliers(ecouleMs: number): EtatPaliers {
  const resteTotalS = tempsRestant(CHRONO_POINTS_COMMUNS_S, ecouleMs);
  const restes = restesParPalier(resteTotalS);
  const enCours = restes.findIndex((r) => r > 0);
  const palier = enCours === -1 ? PALIERS.length - 1 : enCours;
  return {
    palier,
    multiplicateur: PALIERS[palier]!.multiplicateur,
    resteDansPalierS: restes[palier]!,
    resteTotalS,
    indices: palier,
    termine: resteTotalS === 0,
  };
}

/** Score du passage : `ecouleMs` au moment où la régie valide, ou `'echec'`. */
export function scorePointsCommuns(resultat: number | 'echec'): number {
  if (resultat === 'echec') return 0;
  const restes = restesParPalier(tempsRestant(CHRONO_POINTS_COMMUNS_S, resultat));
  return PALIERS.reduce((total, p, i) => total + restes[i]! * p.multiplicateur, 0);
}
