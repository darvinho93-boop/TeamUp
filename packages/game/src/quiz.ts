/**
 * Quiz (`qcm2`). Survivants × 100 par équipe, calculé une seule fois en fin de manche.
 *
 * Une seule fonction pour les deux modes : en mode croix la régie saisit les survivants,
 * en mode téléphone l'app les compte. Même entrée, même score.
 */

import { type ScoresParEquipe, verifierEntierPositif } from './scores';

export const POINTS_PAR_SURVIVANT = 100;

export function scoreQuiz(survivantsParEquipe: ScoresParEquipe): ScoresParEquipe {
  const scores: ScoresParEquipe = {};
  for (const [equipe, survivants] of Object.entries(survivantsParEquipe)) {
    verifierEntierPositif(survivants, `Les survivants de l'équipe ${equipe}`);
    scores[Number(equipe)] = survivants * POINTS_PAR_SURVIVANT;
  }
  return scores;
}
