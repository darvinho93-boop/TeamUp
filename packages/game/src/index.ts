/**
 * Logique de jeu pure — aucune I/O.
 *
 * Le contenu réel (barèmes, paliers, chronos, budget de minutes) arrive au lot 4.
 * Ce module ne pose pour l'instant que le catalogue fermé de la spec v3 : cinq jeux
 * socles et deux duels en bêta. Rien d'autre n'existe, et rien d'autre ne doit être ajouté.
 */

export const SOCLE_GAMES = ['list2', 'qcm2', 'enchere2', 'mime2', 'photo2'] as const;
export const BETA_DUELS = ['grab', 'cup'] as const;

export type SocleGame = (typeof SOCLE_GAMES)[number];
export type BetaDuel = (typeof BETA_DUELS)[number];
export type GameCode = SocleGame | BetaDuel;

const ALL: readonly GameCode[] = [...SOCLE_GAMES, ...BETA_DUELS];

export function isGameCode(value: string): value is GameCode {
  return (ALL as readonly string[]).includes(value);
}
