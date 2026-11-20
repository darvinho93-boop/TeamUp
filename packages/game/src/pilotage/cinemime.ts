/**
 * Pilotage du Ciné-mime (2026-11-20), une scène de film par passage, une équipe à la fois :
 *
 *   pret ──montrer──▶ extrait ──lancer──▶ lance ──trouve──▶ trouve ──rejouer──▶ revue
 *                       │ revoir                   └──rate───▶ rate ──rejouer──▶ revue
 *
 * L'équipe se partage en groupes, en salle (l'app ne les compte pas). `extrait` : la scène passe
 * sur l'écran commun **sans le son**, le chrono de la salle couvre sa durée ; seul le groupe 1
 * regarde, les autres sont dos tourné. `revoir` la relance depuis le début. `lance` : un seul
 * chrono pour toute la chaîne de mimes, groupe après groupe ; le dernier groupe donne le film, la
 * régie tranche. Le verdict termine le passage (+100 si trouvé, comme le Mime). `revue` : la
 * scène rejoue, **avec le son**, pour toute la salle ; `rejouer` la relance autant de fois.
 */

import { scoreMime } from '../mime';
import type { Chrono } from './transition';

export type EtapeCinemime = 'pret' | 'extrait' | 'lance' | 'trouve' | 'rate' | 'revue';
export type ActionCinemime = 'montrer' | 'revoir' | 'lancer' | 'trouve' | 'rate' | 'rejouer';

/** Le chrono de la chaîne, réglable à la préparation. */
export const CHRONO_CINEMIME_DEFAUT_S = 150;
export const CHRONO_CINEMIME_MIN_S = 60;
export const CHRONO_CINEMIME_MAX_S = 300;
/** Durée d'un extrait déposé au back-office. */
export const EXTRAIT_CINEMIME_MIN_MS = 3_000;
export const EXTRAIT_CINEMIME_MAX_MS = 90_000;

export interface EtatCinemime {
  etape: EtapeCinemime;
  /** La durée de la vidéo du passage. */
  extraitMs: number;
  /** Le chrono de la chaîne de cette manche. */
  chronoS: number;
  /** Le temps écoulé sur le chrono de la salle au moment de l'appui. */
  ecouleMs: number;
}

export interface TransitionCinemime {
  etape: EtapeCinemime;
  chrono: Chrono;
  /** Présents au verdict, qui termine le passage. */
  points?: number;
  resultat?: { trouve: boolean; ecoule_ms: number };
}

const PERMISES: Record<EtapeCinemime, ActionCinemime[]> = {
  pret: ['montrer'],
  extrait: ['revoir', 'lancer'],
  lance: ['trouve', 'rate'],
  trouve: ['rejouer'],
  rate: ['rejouer'],
  revue: ['rejouer'],
};

export function actionsCinemime(etape: EtapeCinemime): ActionCinemime[] {
  return PERMISES[etape];
}

/** Le chrono qui couvre la vidéo, en secondes entières : elle finit avant lui, jamais après. */
export function chronoExtraitS(extraitMs: number): number {
  return Math.max(1, Math.ceil(extraitMs / 1000));
}

/** Le chrono de la chaîne, ramené dans ses bornes. */
export function chronoCinemimeS(valeur: unknown): number {
  const n = typeof valeur === 'number' && Number.isFinite(valeur) ? Math.round(valeur) : NaN;
  if (Number.isNaN(n)) return CHRONO_CINEMIME_DEFAUT_S;
  return Math.min(CHRONO_CINEMIME_MAX_S, Math.max(CHRONO_CINEMIME_MIN_S, n));
}

export function appliquerCinemime(etat: EtatCinemime, action: ActionCinemime): TransitionCinemime {
  if (!actionsCinemime(etat.etape).includes(action)) {
    throw new Error(`Ciné-mime : « ${action} » impossible à l'étape « ${etat.etape} ».`);
  }
  const video: Chrono = { demarrer: chronoExtraitS(etat.extraitMs) };
  switch (action) {
    case 'montrer':
    case 'revoir':
      return { etape: 'extrait', chrono: video };
    case 'lancer':
      return { etape: 'lance', chrono: { demarrer: chronoCinemimeS(etat.chronoS) } };
    case 'trouve':
    case 'rate': {
      const trouve = action === 'trouve';
      return {
        etape: action,
        chrono: 'arreter',
        points: scoreMime(trouve),
        resultat: { trouve, ecoule_ms: Math.max(0, Math.round(etat.ecouleMs)) },
      };
    }
    case 'rejouer':
      return { etape: 'revue', chrono: video };
  }
}

/**
 * Où en est la vidéo, en ms, `ecouleMs` après le départ du chrono de la salle : un second écran
 * ou un écran rechargé retombe à la même image. `finie` une fois la vidéo au bout.
 */
export function positionCinemime(
  extraitMs: number,
  ecouleMs: number,
): { positionMs: number; finie: boolean } {
  const fin = Math.max(0, extraitMs);
  const position = Math.min(Math.max(0, ecouleMs), fin);
  return { positionMs: position, finie: ecouleMs >= fin };
}
