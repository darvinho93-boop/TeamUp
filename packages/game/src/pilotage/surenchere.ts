/**
 * Pilotage de la Surenchère (spec v3, jeu 03).
 *
 *   themes ──dévoiler(thème)──▶ sujet ──adjuger──▶ chrono ──verdict──▶ tenu | rate ──retour──▶ themes
 *                                                     └────classer───▶ podium ──retour──▶ themes
 *
 * `themes` : tous les thèmes sont à l'écran, les équipes s'organisent. La régie dévoile le sujet.
 *
 * À la voix : les champions s'avancent, surenchérissent ; adjugé, le chrono géant part.
 * L'animateur tranche : tenu (+100 à l'équipe du champion) ou raté (+20 à chacune des autres).
 *
 * Mode téléphones (2026-11-08) : « adjuger » lance le chrono pendant lequel les capitaines tapent
 * leurs mots ; à la fin, l'écran les montre tous. L'animateur raye les mots hors sujet, puis
 * « classer » donne le podium du thème (+100, +60, +30) d'après les mots validés.
 */

import { podiumDesMots, scoreSurenchere } from '../surenchere';
import type { ScoresParEquipe } from '../scores';
import type { Chrono } from './transition';

/** Durée du chrono géant quand la préparation n'en fixe pas (décision du 2026-09-23). */
export const CHRONO_SURENCHERE_DEFAUT_S = 60;

export type EtapeSurenchere = 'themes' | 'sujet' | 'chrono' | 'tenu' | 'rate' | 'podium';

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
  /** Mode téléphones : les mots validés de chaque équipe, par numéro. */
  | { type: 'classer'; comptes: Readonly<Record<number, number>> }
  | { type: 'retour' };

/** Ce que garde le passage d'un thème joué au téléphone. */
export interface ResultatMots {
  mode: 'telephones';
  comptes: Record<number, number>;
  rangs: Record<number, number>;
  /** Les points du podium : le téléphone de chaque équipe les annonce. */
  points: ScoresParEquipe;
}

export interface TransitionSurenchere {
  etat: EtatSurenchere;
  chrono: Chrono;
  /** Présents au verdict ou au classement, qui terminent le thème. */
  points?: ScoresParEquipe;
  resultat?: { tenu: boolean; equipe_champion: number } | ResultatMots;
}

export const ETAT_INITIAL_SURENCHERE: EtatSurenchere = { etape: 'themes', passageId: null };

const PERMISES: Record<EtapeSurenchere, ActionSurenchere['type'][]> = {
  themes: ['devoiler'],
  sujet: ['adjuger'],
  chrono: ['verdict', 'classer'],
  tenu: ['retour'],
  rate: ['retour'],
  podium: ['retour'],
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
    case 'classer': {
      const { rangs, points } = podiumDesMots(action.comptes);
      return {
        etat: { ...etat, etape: 'podium' },
        chrono: 'arreter',
        points,
        resultat: { mode: 'telephones', comptes: { ...action.comptes }, rangs, points },
      };
    }
    case 'retour':
      return { etat: ETAT_INITIAL_SURENCHERE, chrono: 'garder' };
  }
}
