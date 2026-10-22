/**
 * Explications animées (lot 12) : avant un jeu, la régie peut lancer sur l'écran commun une
 * courte suite de cartes, 20 à 30 s, qui en montre le déroulé. Ici, le script de chaque jeu
 * et la carte à montrer à un instant donné ; les phrases et les visuels vivent dans l'app.
 */

import type { GameCode } from './catalogue';
import type { ModeQuiz } from './pilotage/quiz';

/** Le Quiz s'explique selon son mode, choisi seulement au lancement : trois scripts. */
export type ScriptExplication = GameCode | 'qcm2-telephone' | 'qcm2-jetons';

/** Ce que l'écran dessine pour une carte. */
export type VisuelExplication =
  | 'equipe-dos'
  | 'ecran-cache'
  | 'salle-debout'
  | 'paliers'
  | 'paliers-durees'
  | 'quadrants'
  | 'zones'
  | 'telephone'
  | 'elimine'
  | 'survivants'
  | 'jetons-capitaine'
  | 'repartition'
  | 'jetons-perdus'
  | 'jetons-restants'
  | 'champions'
  | 'encheres'
  | 'chrono'
  | 'verdict'
  | 'file'
  | 'mot'
  | 'chaine'
  | 'annonce'
  | 'capitaine'
  | 'diaporama'
  | 'gagnante'
  | 'points-photo'
  | 'duellistes-table'
  | 'musique'
  | 'attrape'
  | 'duellistes-gobelet'
  | 'tete-epaule'
  | 'gobelet'
  | 'points-duel';

export interface CarteExplication {
  /** Clé de la phrase, sous `ecran.explications.<script>`. */
  cle: string;
  dureeS: number;
  visuel: VisuelExplication;
}

/**
 * Bornes d'une explication (décision du 2026-10-03, allongée le 2026-10-22 : la salle n'avait
 * pas le temps de lire) ; une carte se lit en 6 s au moins.
 */
export const EXPLICATION_MIN_S = 30;
export const EXPLICATION_MAX_S = 50;
export const CARTE_MIN_S = 6;

const carte = (cle: string, dureeS: number, visuel: VisuelExplication = cle as VisuelExplication) =>
  ({ cle, dureeS, visuel }) satisfies CarteExplication;

const QUIZ_FIN = [carte('elimine', 9), carte('survivants', 9)];

export const SCRIPTS_EXPLICATION: Record<ScriptExplication, readonly CarteExplication[]> = {
  list2: [
    carte('equipe-dos', 9),
    carte('ecran-cache', 9),
    carte('salle-debout', 9),
    carte('paliers', 9),
    carte('paliers-durees', 9),
  ],
  qcm2: [carte('quadrants', 9), carte('zones', 9), ...QUIZ_FIN],
  'qcm2-telephone': [carte('quadrants', 9), carte('telephone', 9), ...QUIZ_FIN],
  // Mode jetons (2026-10-18) : le capitaine mise pour l'équipe, les jetons mal placés sont perdus.
  'qcm2-jetons': [
    carte('quadrants', 9),
    carte('jetons-capitaine', 9),
    carte('repartition', 9),
    carte('jetons-perdus', 9),
    carte('jetons-restants', 8),
  ],
  enchere2: [carte('champions', 9), carte('encheres', 9), carte('chrono', 9), carte('verdict', 9)],
  mime2: [carte('file', 9), carte('mot', 9), carte('chaine', 10), carte('annonce', 9)],
  photo2: [
    carte('capitaine', 9),
    carte('diaporama', 9),
    carte('gagnante', 9),
    carte('points-photo', 8),
  ],
  grab: [
    carte('duellistes-table', 9),
    carte('musique', 8),
    carte('attrape', 9),
    carte('points', 8, 'points-duel'),
  ],
  cup: [
    carte('duellistes-gobelet', 9),
    carte('tete-epaule', 9),
    carte('gobelet', 9),
    carte('points', 9, 'points-duel'),
  ],
};

/** Le script d'un jeu ; pour le Quiz, celui de son mode. */
export function scriptExplication(jeu: GameCode, mode: ModeQuiz = 'croix'): ScriptExplication {
  if (jeu !== 'qcm2' || mode === 'croix') return jeu;
  return mode === 'telephone' ? 'qcm2-telephone' : 'qcm2-jetons';
}

export function dureeExplicationS(script: ScriptExplication): number {
  return SCRIPTS_EXPLICATION[script].reduce((total, c) => total + c.dureeS, 0);
}

export interface PositionExplication {
  index: number;
  /** Avancement dans la carte courante, de 0 à 1. */
  progression: number;
  /** Le script est arrivé au bout : l'écran reste sur la dernière carte. */
  finie: boolean;
}

/** La carte à montrer `ecouleMs` après le départ de l'explication. */
export function carteA(script: ScriptExplication, ecouleMs: number): PositionExplication {
  const cartes = SCRIPTS_EXPLICATION[script];
  let debutMs = 0;
  for (const [index, c] of cartes.entries()) {
    const finMs = debutMs + c.dureeS * 1000;
    if (ecouleMs < finMs) {
      return {
        index,
        progression: Math.max(0, ecouleMs - debutMs) / (c.dureeS * 1000),
        finie: false,
      };
    }
    debutMs = finMs;
  }
  return { index: cartes.length - 1, progression: 1, finie: true };
}
