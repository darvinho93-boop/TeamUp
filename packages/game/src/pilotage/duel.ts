/**
 * Pilotage d'un duel (`grab` ou `cup`, bêta de la spec v3). Un passage par duel :
 *
 *   tirage ──presenter──▶ face_a_face ──lancer──▶ chrono ──verdict(A|B)──▶ gagne
 *     └─┘ tirer (un duelliste absent : on retire)
 *
 * `tirage` : la régie voit les deux duellistes proposés, peut retirer. `face_a_face` : la salle
 * voit leurs prénoms. `chrono` : 30 s (Attrape l'objet) ou 45 s (Tête, épaule, gobelet).
 * L'animateur désigne le vainqueur : +50 à son équipe.
 */

import { FICHES, type BetaDuel } from '../catalogue';
import { scoreDuel } from '../duels';
import type { ScoresParEquipe } from '../scores';
import type { Chrono } from './transition';

export type EtapeDuel = 'tirage' | 'face_a_face' | 'chrono' | 'gagne';

/** Un duelliste tel qu'il est gardé dans `passages.resultat` : de quoi l'afficher sans relire. */
export interface Duelliste {
  joueur_id: string;
  prenom: string;
  equipe: number;
}

export type ActionDuel =
  | { type: 'tirer'; duellistes: readonly [Duelliste, Duelliste] }
  | { type: 'presenter' }
  | { type: 'lancer' }
  | { type: 'verdict'; gagnant: 0 | 1 };

export interface TransitionDuel {
  etape: EtapeDuel;
  chrono: Chrono;
  resultat?: { duellistes: readonly [Duelliste, Duelliste]; gagnant?: 0 | 1 };
  /** Présents au verdict, qui termine le passage. */
  points?: ScoresParEquipe;
}

const PERMISES: Record<EtapeDuel, ActionDuel['type'][]> = {
  tirage: ['tirer', 'presenter'],
  face_a_face: ['lancer'],
  chrono: ['verdict'],
  gagne: [],
};

export function actionsDuel(etape: EtapeDuel): ActionDuel['type'][] {
  return PERMISES[etape];
}

export function chronoDuelS(jeu: BetaDuel): number {
  return FICHES[jeu].chronoPassageS;
}

/** `duellistes` : ceux du passage, déjà tirés ; requis pour présenter et pour le verdict. */
export function appliquerDuel(
  jeu: BetaDuel,
  etape: EtapeDuel,
  action: ActionDuel,
  duellistes: readonly [Duelliste, Duelliste] | null,
): TransitionDuel {
  if (!actionsDuel(etape).includes(action.type)) {
    throw new Error(`Duel : « ${action.type} » impossible à l'étape « ${etape} ».`);
  }
  switch (action.type) {
    case 'tirer':
      if (action.duellistes[0].equipe === action.duellistes[1].equipe) {
        throw new Error('Duel : les deux duellistes doivent être de deux équipes différentes.');
      }
      return { etape: 'tirage', chrono: 'garder', resultat: { duellistes: action.duellistes } };
    case 'presenter':
      if (!duellistes) throw new Error('Duel : aucun duelliste tiré.');
      return { etape: 'face_a_face', chrono: 'garder' };
    case 'lancer':
      return { etape: 'chrono', chrono: { demarrer: chronoDuelS(jeu) } };
    case 'verdict': {
      if (!duellistes) throw new Error('Duel : aucun duelliste tiré.');
      return {
        etape: 'gagne',
        chrono: 'arreter',
        resultat: { duellistes, gagnant: action.gagnant },
        points: scoreDuel(duellistes[action.gagnant].equipe),
      };
    }
  }
}
