/**
 * Photo challenge (`photo2`). 100 par thème gagné ; une seule gagnante par thème, aucun vote.
 * La forme de l'entrée (une équipe ou personne, par thème) interdit deux gagnantes.
 */

import type { ScoresParEquipe } from './scores';

export const POINTS_THEME_GAGNE = 100;

/** Gagnante de chaque thème, par identifiant de thème ; `null` tant que personne n'est désigné. */
export function scorePhoto(gagnanteParTheme: Record<string, number | null>): ScoresParEquipe {
  const scores: ScoresParEquipe = {};
  for (const equipe of Object.values(gagnanteParTheme)) {
    if (equipe === null) continue;
    scores[equipe] = (scores[equipe] ?? 0) + POINTS_THEME_GAGNE;
  }
  return scores;
}
