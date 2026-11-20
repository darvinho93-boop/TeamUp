import type { ElementProgramme, GameCode } from '@teamup/game';

/** Une manche telle que la préparation la connaît : son jeu, ses options, ses passages. */
export interface MancheAChiffrer {
  jeu: GameCode;
  options: Record<string, unknown>;
  passages: number;
}

const nombre = (valeur: unknown, defaut: number) =>
  typeof valeur === 'number' && Number.isInteger(valeur) && valeur >= 0 ? valeur : defaut;

/** Traduit une manche en élément du budget de minutes (`dureeProgramme`, packages/game). */
export function elementDuProgramme({ jeu, options, passages }: MancheAChiffrer): ElementProgramme {
  switch (jeu) {
    case 'list2':
    case 'mime2':
    case 'cinemime':
      return { jeu, passages };
    case 'qcm2':
      return { jeu, questions: nombre(options['questions'], 4) };
    case 'enchere2':
      return { jeu, themes: passages || nombre(options['themes'], 3) };
    case 'photo2':
      return { jeu };
    case 'grab':
    case 'cup':
      return { jeu, duels: nombre(options['duels'], passages) };
    case 'blind':
      return { jeu, titres: passages || nombre(options['titres_n'], 8) };
    case 'portrait':
      return { jeu, cibles: passages || nombre(options['cibles_n'], 5) };
  }
}
