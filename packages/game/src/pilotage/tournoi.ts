/**
 * Pilotage du tournoi de Tête, épaule, gobelet (2026-11-21), un seul passage pour tout le tableau :
 *
 *   tirage ──appeler──▶ appel ──lancer──▶ jeu ──fin──▶ resultats ──appeler──▶ appel …
 *                                                          └──conclure──▶ vainqueur
 *
 * `appel` : la salle voit qui va à quel poste. `jeu` : l'animateur annonce la séquence, tous les
 * postes la jouent en même temps. `resultats` : les perdants viennent à la régie ; on ne passe à
 * la suite qu'une fois chaque match de la séquence jugé.
 */

import { FICHES } from '../catalogue';
import type { Chrono } from './transition';

export type EtapeTournoi = 'tirage' | 'appel' | 'jeu' | 'resultats' | 'vainqueur';
export type ActionTournoi = 'appeler' | 'lancer' | 'fin' | 'conclure';

export interface ContexteTournoi {
  /** Tous les matchs de la séquence en cours ont un gagnant (vrai s'il n'y en a pas encore). */
  sequenceJugee: boolean;
  /** Il reste au moins un match à appeler. */
  resteAJouer: boolean;
}

export interface TransitionTournoi {
  etape: EtapeTournoi;
  chrono: Chrono;
}

const PERMISES: Record<EtapeTournoi, ActionTournoi[]> = {
  tirage: ['appeler'],
  appel: ['lancer'],
  jeu: ['fin'],
  resultats: ['appeler', 'conclure'],
  vainqueur: [],
};

export function actionsTournoi(etape: EtapeTournoi): ActionTournoi[] {
  return PERMISES[etape];
}

export function appliquerTournoi(
  etape: EtapeTournoi,
  action: ActionTournoi,
  { sequenceJugee, resteAJouer }: ContexteTournoi,
): TransitionTournoi {
  if (!actionsTournoi(etape).includes(action)) {
    throw new Error(`Tournoi : « ${action} » impossible à l'étape « ${etape} ».`);
  }
  switch (action) {
    case 'appeler':
      if (!sequenceJugee) throw new Error('Tournoi : des matchs attendent leur résultat.');
      if (!resteAJouer) throw new Error('Tournoi : plus aucun match à appeler.');
      return { etape: 'appel', chrono: 'arreter' };
    case 'lancer':
      return { etape: 'jeu', chrono: { demarrer: FICHES.cup.chronoPassageS } };
    case 'fin':
      return { etape: 'resultats', chrono: 'arreter' };
    case 'conclure':
      if (!sequenceJugee || resteAJouer) throw new Error('Tournoi : la finale n’est pas jouée.');
      return { etape: 'vainqueur', chrono: 'arreter' };
  }
}
