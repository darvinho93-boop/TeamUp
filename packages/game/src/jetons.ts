/**
 * Quiz en mode jetons (décision du 2026-10-18). Chaque équipe, réunie, confie la mise à son
 * capitaine : il répartit tous ses jetons sur les quatre réponses, ceux posés sur une mauvaise
 * réponse sont perdus. En fin de manche, les jetons restants se comptent comme des survivants
 * (`scoreQuiz`, × 100) : le barème reste celui des modes croix et téléphone.
 */

/** Une mise : les jetons posés sur A, B, C et D, dans cet ordre. */
export type Repartition = readonly [number, number, number, number];

export const MISE_VIDE: Repartition = [0, 0, 0, 0];

/** Toutes les équipes partent avec autant de jetons que la plus grande compte de joueurs. */
export function jetonsDeDepart(effectifs: readonly number[]): number {
  return Math.max(0, ...effectifs.map((n) => Math.max(0, Math.trunc(n))));
}

export function totalMise(repartition: readonly number[]): number {
  return repartition.reduce((total, n) => total + n, 0);
}

/**
 * Une mise recevable : quatre entiers positifs, pas plus que les jetons disponibles, et tous
 * posés pour valider (on ne se met pas à l'abri).
 */
export function miseValide(
  repartition: readonly number[],
  dispo: number,
  valider: boolean,
): boolean {
  if (repartition.length !== 4) return false;
  if (!repartition.every((n) => Number.isInteger(n) && n >= 0)) return false;
  const total = totalMise(repartition);
  return valider ? total === dispo : total <= dispo;
}

/**
 * Ce qui reste après une question révélée : les jetons posés sur la bonne réponse. Les jetons
 * mal placés et ceux qui n'ont pas été posés (équipe révélée sans avoir validé) sont perdus.
 */
export function jetonsApres(repartition: readonly number[], bonne: number): number {
  return repartition[bonne] ?? 0;
}
