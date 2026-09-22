/**
 * Couleurs d'équipe : huit, comme la spec v3 va jusqu'à huit équipes.
 *
 * 1 à 4 viennent de la charte (navy, corail, sauge, ambre) ; 5 à 8 ont été ajoutées au lot 3
 * dans quatre familles absentes du kit (prune, turquoise, olive, framboise), pour rester
 * distinguables à dix mètres en salle sombre. Les valeurs sont dans `tokens.css`.
 */
export const TEAM_COLOR_COUNT = 8;

export type TeamIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export function teamModifier(index: number): string {
  if (!Number.isInteger(index) || index < 1 || index > TEAM_COLOR_COUNT) {
    throw new RangeError(
      `Couleur d'équipe ${index} inconnue : le kit en définit ${TEAM_COLOR_COUNT}.`,
    );
  }
  return `tu-team--${index}`;
}
