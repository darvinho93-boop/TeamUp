/**
 * Explications animées (lot 12) : avant un jeu, la régie peut lancer sur l'écran commun une
 * courte suite de cartes, 20 à 30 s, qui en montre le déroulé. Ici, le script de chaque jeu
 * et la carte à montrer à un instant donné ; les phrases et les visuels vivent dans l'app.
 */

import type { GameCode } from './catalogue';

/** Le Quiz s'explique selon son mode, choisi seulement au lancement : deux scripts. */
export type ScriptExplication = GameCode | 'qcm2-telephone';

/** Ce que l'écran dessine pour une carte. */
export type VisuelExplication =
  | 'equipe-dos'
  | 'ecran-cache'
  | 'salle-debout'
  | 'paliers'
  | 'quadrants'
  | 'zones'
  | 'telephone'
  | 'elimine'
  | 'survivants'
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

/** Bornes d'une explication (décision du 2026-10-03) ; une carte se lit en 4 s au moins. */
export const EXPLICATION_MIN_S = 20;
export const EXPLICATION_MAX_S = 30;
export const CARTE_MIN_S = 4;

const carte = (cle: string, dureeS: number, visuel: VisuelExplication = cle as VisuelExplication) =>
  ({ cle, dureeS, visuel }) satisfies CarteExplication;

const QUIZ_FIN = [carte('elimine', 6), carte('survivants', 6)];

export const SCRIPTS_EXPLICATION: Record<ScriptExplication, readonly CarteExplication[]> = {
  list2: [
    carte('equipe-dos', 6),
    carte('ecran-cache', 6),
    carte('salle-debout', 6),
    carte('paliers', 6),
  ],
  qcm2: [carte('quadrants', 6), carte('zones', 6), ...QUIZ_FIN],
  'qcm2-telephone': [carte('quadrants', 6), carte('telephone', 6), ...QUIZ_FIN],
  enchere2: [carte('champions', 6), carte('encheres', 6), carte('chrono', 6), carte('verdict', 6)],
  mime2: [carte('file', 6), carte('mot', 6), carte('chaine', 7), carte('annonce', 6)],
  photo2: [
    carte('capitaine', 6),
    carte('diaporama', 6),
    carte('gagnante', 6),
    carte('points-photo', 5),
  ],
  grab: [
    carte('duellistes-table', 6),
    carte('musique', 5),
    carte('attrape', 6),
    carte('points', 5, 'points-duel'),
  ],
  cup: [
    carte('duellistes-gobelet', 6),
    carte('tete-epaule', 6),
    carte('gobelet', 6),
    carte('points', 6, 'points-duel'),
  ],
};

/** Le script d'un jeu ; pour le Quiz, celui de son mode. */
export function scriptExplication(jeu: GameCode, telephone = false): ScriptExplication {
  return jeu === 'qcm2' && telephone ? 'qcm2-telephone' : jeu;
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
