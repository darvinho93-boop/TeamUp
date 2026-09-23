/**
 * Durée d'un programme, face au créneau obtenu (spec v3, « Le budget de minutes »).
 *
 * Les jeux séquentiels coûtent un passage par équipe ; les autres coûtent selon leur
 * contenu (questions, thèmes, duels). Les transitions ajoutent environ 15 % aux chronos.
 * Le calcul chiffre, il ne tranche rien : retirer un passage ou un thème reste le choix
 * de l'animateur.
 */

import { FICHES, type GameCode } from './catalogue';
import { verifierEntierPositif } from './scores';

export const PART_TRANSITIONS = 0.15;

export type ElementProgramme =
  /** `passages` vaut le nombre d'équipes, sauf à ne faire jouer qu'une partie d'entre elles. */
  | { jeu: 'list2' | 'mime2'; passages: number }
  | { jeu: 'qcm2'; questions: number }
  | { jeu: 'enchere2'; themes: number }
  /** La prise de vue dure toute la soirée ; seule la diffusion finale prend du créneau. */
  | { jeu: 'photo2' }
  | { jeu: 'grab' | 'cup'; duels: number };

export interface DureeProgramme {
  parJeu: { jeu: GameCode; secondes: number }[];
  sequentielS: number;
  nonSequentielS: number;
  chronosS: number;
  transitionsS: number;
  totalS: number;
  /** Total arrondi à la minute, comme les estimations de la spec. */
  totalMin: number;
  /** Présent quand un créneau est fourni et que le total le dépasse. */
  depassement?: { creneauMin: number; ecartMin: number };
}

function unites(element: ElementProgramme): number {
  switch (element.jeu) {
    case 'list2':
    case 'mime2':
      return element.passages;
    case 'qcm2':
      return element.questions;
    case 'enchere2':
      return element.themes;
    case 'photo2':
      return 1;
    case 'grab':
    case 'cup':
      return element.duels;
  }
}

export function dureeElement(element: ElementProgramme): number {
  const n = unites(element);
  verifierEntierPositif(n, `Le nombre d'unités de ${element.jeu}`);
  return n * FICHES[element.jeu].chronoPassageS;
}

export function dureeProgramme(
  elements: readonly ElementProgramme[],
  options: { creneauMin?: number } = {},
): DureeProgramme {
  const parJeu = elements.map((e) => ({ jeu: e.jeu, secondes: dureeElement(e) }));
  const somme = (sequentiel: boolean) =>
    parJeu
      .filter((l) => FICHES[l.jeu].sequentiel === sequentiel)
      .reduce((t, l) => t + l.secondes, 0);

  const sequentielS = somme(true);
  const nonSequentielS = somme(false);
  const chronosS = sequentielS + nonSequentielS;
  const transitionsS = Math.round(chronosS * PART_TRANSITIONS);
  const totalS = chronosS + transitionsS;
  const totalMin = Math.round(totalS / 60);

  const resultat: DureeProgramme = {
    parJeu,
    sequentielS,
    nonSequentielS,
    chronosS,
    transitionsS,
    totalS,
    totalMin,
  };
  const { creneauMin } = options;
  if (creneauMin !== undefined && totalS > creneauMin * 60) {
    resultat.depassement = { creneauMin, ecartMin: Math.ceil(totalS / 60 - creneauMin) };
  }
  return resultat;
}
