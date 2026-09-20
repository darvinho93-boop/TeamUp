/**
 * Couleurs d'équipe.
 *
 * La charte n'en définit que quatre (navy, corail, sauge, ambre). Les couleurs 5 à 8
 * sont une décision ouverte : tant qu'elle n'est pas prise, on refuse bruyamment
 * plutôt que de réutiliser une couleur et de rendre deux équipes indiscernables en salle.
 */
export const TEAM_COLOR_COUNT = 4;

export type TeamIndex = 1 | 2 | 3 | 4;

export function teamModifier(index: number): string {
  if (!Number.isInteger(index) || index < 1 || index > TEAM_COLOR_COUNT) {
    throw new RangeError(
      `Couleur d'équipe ${index} inconnue : la charte n'en définit que ${TEAM_COLOR_COUNT}. ` +
        `Les couleurs 5 à 8 restent à trancher (docs/cahier-des-charges.md §8).`,
    );
  }
  return `tu-team--${index}`;
}
