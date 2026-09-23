/**
 * Catalogue fermé de la spec v3 : cinq jeux socles et deux duels en bêta.
 * Rien d'autre n'existe, et rien d'autre ne doit être ajouté.
 *
 * Les fiches reprennent la table `public.jeux` (migration `programme_et_scores`) :
 * toute modification passe par une migration et par ce fichier, ensemble.
 */

export const SOCLE_GAMES = ['list2', 'qcm2', 'enchere2', 'mime2', 'photo2'] as const;
export const BETA_DUELS = ['grab', 'cup'] as const;

export type SocleGame = (typeof SOCLE_GAMES)[number];
export type BetaDuel = (typeof BETA_DUELS)[number];
export type GameCode = SocleGame | BetaDuel;

export interface FicheJeu {
  nom: string;
  /** Un passage par équipe : le coût en minutes suit le nombre d'équipes. */
  sequentiel: boolean;
  /**
   * Durée d'une unité de jeu, en secondes : un passage (séquentiels), une question (quiz),
   * un thème (surenchère), la diffusion finale (photo), un duel.
   */
  chronoPassageS: number;
  beta: boolean;
}

export const FICHES: Readonly<Record<GameCode, FicheJeu>> = {
  list2: { nom: 'Points communs', sequentiel: true, chronoPassageS: 130, beta: false },
  qcm2: { nom: 'Quiz', sequentiel: false, chronoPassageS: 30, beta: false },
  enchere2: { nom: 'Surenchère', sequentiel: false, chronoPassageS: 120, beta: false },
  mime2: { nom: 'Mime', sequentiel: true, chronoPassageS: 150, beta: false },
  photo2: { nom: 'Photo challenge', sequentiel: false, chronoPassageS: 300, beta: false },
  grab: { nom: "Attrape l'objet", sequentiel: false, chronoPassageS: 30, beta: true },
  cup: { nom: 'Tête, épaule, gobelet', sequentiel: false, chronoPassageS: 45, beta: true },
};

const ALL: readonly GameCode[] = [...SOCLE_GAMES, ...BETA_DUELS];

export function isGameCode(value: string): value is GameCode {
  return (ALL as readonly string[]).includes(value);
}
