/**
 * Pilotage de la Surenchère (spec v3, jeu 03).
 *
 *   themes ──dévoiler(thème)──▶ sujet ──adjuger──▶ chrono ──verdict──▶ tenu | rate ──retour──▶ themes
 *
 * `themes` : tous les thèmes sont à l'écran, les équipes s'organisent. Les champions
 * s'avancent, **puis** la régie dévoile le sujet. Adjugé : le chrono géant part. L'animateur
 * tranche : tenu (+100 à l'équipe du champion) ou raté (+20 à chacune des autres).
 */

import { scoreSurenchere } from '../surenchere';
import type { ScoresParEquipe } from '../scores';
import type { Chrono } from './transition';

/** Durée du chrono géant quand la préparation n'en fixe pas (décision du 2026-09-23). */
export const CHRONO_SURENCHERE_DEFAUT_S = 60;

export type EtapeSurenchere = 'themes' | 'sujet' | 'chrono' | 'tenu' | 'rate';

export interface EtatSurenchere {
  etape: EtapeSurenchere;
  /** Le thème en jeu ; aucun à l'étape `themes`. */
  passageId: string | null;
}

export type ActionSurenchere =
  | { type: 'devoiler'; passageId: string }
  | { type: 'adjuger'; chronoS: number }
  | {
      type: 'verdict';
      tenu: boolean;
      equipeChampion: number;
      equipesAvecJoueurs: readonly number[];
    }
  | { type: 'retour' };

export interface TransitionSurenchere {
  etat: EtatSurenchere;
  chrono: Chrono;
  /** Présents au verdict, qui termine le thème. */
  points?: ScoresParEquipe;
  resultat?: { tenu: boolean; equipe_champion: number };
}

export const ETAT_INITIAL_SURENCHERE: EtatSurenchere = { etape: 'themes', passageId: null };

const PERMISES: Record<EtapeSurenchere, ActionSurenchere['type'][]> = {
  themes: ['devoiler'],
  sujet: ['adjuger'],
  chrono: ['verdict'],
  tenu: ['retour'],
  rate: ['retour'],
};

export function actionsSurenchere(etat: EtatSurenchere): ActionSurenchere['type'][] {
  return PERMISES[etat.etape];
}

export function appliquerSurenchere(
  etat: EtatSurenchere,
  action: ActionSurenchere,
  /** Thèmes déjà joués : on ne dévoile pas deux fois le même sujet. */
  dejaJoues: readonly string[] = [],
): TransitionSurenchere {
  if (!actionsSurenchere(etat).includes(action.type)) {
    throw new Error(`Surenchère : « ${action.type} » impossible à l'étape « ${etat.etape} ».`);
  }
  switch (action.type) {
    case 'devoiler':
      if (dejaJoues.includes(action.passageId)) {
        throw new Error('Surenchère : ce thème a déjà été joué.');
      }
      return { etat: { etape: 'sujet', passageId: action.passageId }, chrono: 'garder' };
    case 'adjuger':
      return { etat: { ...etat, etape: 'chrono' }, chrono: { demarrer: action.chronoS } };
    case 'verdict':
      return {
        etat: { ...etat, etape: action.tenu ? 'tenu' : 'rate' },
        chrono: 'arreter',
        points: scoreSurenchere({
          equipeChampion: action.equipeChampion,
          tenu: action.tenu,
          equipesAvecJoueurs: action.equipesAvecJoueurs,
        }),
        resultat: { tenu: action.tenu, equipe_champion: action.equipeChampion },
      };
    case 'retour':
      return { etat: ETAT_INITIAL_SURENCHERE, chrono: 'garder' };
  }
}
