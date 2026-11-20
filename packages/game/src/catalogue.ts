/**
 * Catalogue des jeux : les cinq jeux socles de la spec v3, le Blind test (ajouté le 2026-11-15 :
 * l'objectif est d'enrichir la bibliothèque de jeux), le Portrait mystère (2026-11-18), le
 * Ciné-mime (2026-11-20) et deux duels en bêta. Un jeu ne s'ajoute
 * qu'avec sa ligne dans `public.jeux`, sa machine de pilotage et son explication.
 *
 * Les fiches reprennent la table `public.jeux` (migration `programme_et_scores`) :
 * toute modification passe par une migration et par ce fichier, ensemble.
 */

export const SOCLE_GAMES = [
  'list2',
  'qcm2',
  'enchere2',
  'mime2',
  'photo2',
  'blind',
  'portrait',
  'cinemime',
] as const;
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
  // Un titre : l'écoute (30 s par défaut), les réponses, la révélation.
  blind: { nom: 'Blind test', sequentiel: false, chronoPassageS: 60, beta: false },
  // Une cible : trois tours d'indice et de vote (20 s chacun par défaut), puis la révélation.
  portrait: { nom: 'Portrait mystère', sequentiel: false, chronoPassageS: 90, beta: false },
  // Un passage par équipe : la scène (45 s au plus conseillées), puis la chaîne (2 min 30).
  cinemime: { nom: 'Ciné-mime', sequentiel: true, chronoPassageS: 195, beta: false },
  grab: { nom: "Attrape l'objet", sequentiel: false, chronoPassageS: 30, beta: true },
  cup: { nom: 'Tête, épaule, gobelet', sequentiel: false, chronoPassageS: 45, beta: true },
};

const ALL: readonly GameCode[] = [...SOCLE_GAMES, ...BETA_DUELS];

export function isGameCode(value: string): value is GameCode {
  return (ALL as readonly string[]).includes(value);
}
