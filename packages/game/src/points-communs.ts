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
 *
 * Le chrono s'arrête à la fin de chaque palier (décision du 2026-10-08) : il attend que la régie
 * donne l'indice, puis repart seul après `REPRISE_APRES_INDICE_S`. Le barème se lit donc sur le
 * temps de jeu (`tempsDeJeu`), pas sur le temps écoulé depuis le lancement.
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

/** Le temps laissé à la salle pour lire l'indice avant que le chrono reparte. */
export const REPRISE_APRES_INDICE_S = 5;

/** Temps de jeu où le chrono s'arrête : la fin de chaque palier, sauf le dernier. */
const ARRETS_MS = PALIERS.slice(0, -1).map(
  (_, i) => PALIERS.slice(0, i + 1).reduce((total, p) => total + p.dureeS, 0) * 1000,
);

export interface TempsDeJeu {
  /** Temps de jeu écoulé, arrêts déduits : c'est lui qui s'affiche et qui entre dans le barème. */
  jeuMs: number;
  /**
   * `null` quand le chrono tourne. Sinon l'arrêt en cours : `palier` est celui qui s'ouvre
   * (1 ou 2), `repriseDansMs` vaut `null` tant que l'indice n'a pas été donné.
   */
  arret: { palier: number; repriseDansMs: number | null } | null;
}

/**
 * Le temps de jeu, d'après le temps écoulé depuis le lancement (`murMs`) et les instants où la
 * régie a donné chaque indice (`indicesMs`, comptés depuis le lancement eux aussi).
 */
export function tempsDeJeu(murMs: number, indicesMs: readonly number[] = []): TempsDeJeu {
  const mur = Math.max(0, murMs);
  // Le tronçon en cours : le chrono y tourne depuis `repartiA` (au mur), parti de `jeuAuDepart`.
  let repartiA = 0;
  let jeuAuDepart = 0;
  for (const [i, arretMs] of ARRETS_MS.entries()) {
    const atteintA = repartiA + (arretMs - jeuAuDepart);
    if (mur < atteintA) break;
    const indiceA = indicesMs[i];
    if (indiceA === undefined) {
      return { jeuMs: arretMs, arret: { palier: i + 1, repriseDansMs: null } };
    }
    const repriseA = Math.max(indiceA, atteintA) + REPRISE_APRES_INDICE_S * 1000;
    if (mur < repriseA) {
      return { jeuMs: arretMs, arret: { palier: i + 1, repriseDansMs: repriseA - mur } };
    }
    repartiA = repriseA;
    jeuAuDepart = arretMs;
  }
  return {
    jeuMs: Math.min(CHRONO_POINTS_COMMUNS_S * 1000, jeuAuDepart + (mur - repartiA)),
    arret: null,
  };
}

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

/** L'état des paliers à un temps de jeu donné (`tempsDeJeu(...).jeuMs`). */
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

/** Score du passage : le temps de jeu au moment où la régie valide, ou `'echec'`. */
export function scorePointsCommuns(resultat: number | 'echec'): number {
  if (resultat === 'echec') return 0;
  const restes = restesParPalier(tempsRestant(CHRONO_POINTS_COMMUNS_S, resultat));
  return PALIERS.reduce((total, p, i) => total + restes[i]! * p.multiplicateur, 0);
}
