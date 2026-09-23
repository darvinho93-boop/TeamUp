/**
 * Surenchère (`enchere2`). Tenu : +100 à l'équipe du champion.
 * Raté : +20 à chacune des autres équipes ayant des joueurs.
 */

import type { ScoresParEquipe } from './scores';

export const POINTS_TENU = 100;
export const POINTS_RATE_PAR_AUTRE_EQUIPE = 20;

export interface ResultatSurenchere {
  equipeChampion: number;
  tenu: boolean;
  /** Numéros des équipes qui comptent au moins un joueur. */
  equipesAvecJoueurs: readonly number[];
}

export function scoreSurenchere({
  equipeChampion,
  tenu,
  equipesAvecJoueurs,
}: ResultatSurenchere): ScoresParEquipe {
  if (!equipesAvecJoueurs.includes(equipeChampion)) {
    throw new RangeError(`L'équipe du champion (${equipeChampion}) n'a aucun joueur.`);
  }
  if (tenu) return { [equipeChampion]: POINTS_TENU };
  const scores: ScoresParEquipe = {};
  for (const equipe of new Set(equipesAvecJoueurs)) {
    if (equipe !== equipeChampion) scores[equipe] = POINTS_RATE_PAR_AUTRE_EQUIPE;
  }
  return scores;
}
