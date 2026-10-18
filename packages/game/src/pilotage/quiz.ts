/**
 * Pilotage du Quiz (spec v3, jeu 02). Mêmes étapes dans les trois modes :
 *
 *   pret ──afficher──▶ question ──révéler──▶ reponse ──suivante──▶ pret      (question suivante)
 *                         └──annuler──▶ pret                        └──fin──▶ survivants ──valider──▶ resultat
 *
 * `question` se déroule en trois temps (2026-10-18) : la question seule, puis les propositions
 * A, B, C et D une à une (`proposition`, une touche chacune), puis `lancer` démarre le chrono de
 * 30 s. Alors seulement on répond : en mode croix, la salle se place ; en mode téléphone, chacun
 * répond sur son écran ; en mode jetons, le capitaine de chaque équipe répartit les jetons.
 * `reponse` : la bonne réponse est révélée, les mauvaises zones (ou les mauvais téléphones) sortent.
 * `annuler` : la question ne compte pas (réseau tombé en mode téléphone) ; on passe à la suivante.
 * `survivants` : la régie saisit (croix) ou confirme (téléphone) les survivants par équipe ; en
 * mode jetons, elle confirme les jetons restants, qui se comptent comme des survivants.
 *
 * Le score se calcule **une seule fois**, à la validation des survivants, par `scoreQuiz` :
 * le mode n'entre pas dans le calcul, c'est ce qui rend les deux modes comparables.
 */

import { FICHES } from '../catalogue';
import { scoreQuiz } from '../quiz';
import type { ScoresParEquipe } from '../scores';
import type { Chrono } from './transition';

export type ModeQuiz = 'croix' | 'telephone' | 'jetons';
export const MODES_QUIZ: readonly ModeQuiz[] = ['croix', 'telephone', 'jetons'];

export const CHRONO_QUESTION_S = FICHES.qcm2.chronoPassageS;
/**
 * Sans repêchage (décision du 2026-09-24), quatre questions par défaut. Jusqu'à dix depuis le
 * 2026-10-18 : l'animateur en prévoit plus et termine le quiz quand il veut (`fin` après chaque
 * réponse révélée).
 */
export const QUESTIONS_QUIZ = [3, 4, 5, 6, 7, 8, 9, 10] as const;
export const QUESTIONS_QUIZ_DEFAUT = 4;

export type EtapeQuiz = 'pret' | 'question' | 'reponse' | 'survivants' | 'resultat';

/** A, B, C, D : affichées une à une avant le chrono. */
export const PROPOSITIONS_QUIZ = 4;

export type ActionQuiz =
  | { type: 'afficher' }
  | { type: 'proposition' }
  | { type: 'lancer' }
  | { type: 'reveler' }
  | { type: 'annuler' }
  | { type: 'suivante' }
  | { type: 'fin' }
  | { type: 'valider'; survivants: ScoresParEquipe };

export interface EtatQuiz {
  etape: EtapeQuiz;
  /** Reste-t-il une question à jouer après celle-ci ? */
  resteDesQuestions: boolean;
  /** Propositions déjà affichées de la question en cours (0 à 4). */
  propositions?: number;
  /** Le chrono de la question est lancé : on peut répondre, puis révéler. */
  chronoLance?: boolean;
}

export interface TransitionQuiz {
  etape: EtapeQuiz;
  chrono: Chrono;
  /** Propositions affichées après la transition, quand elle les change. */
  propositions?: number;
  /** Présents à la validation des survivants, qui termine la manche. */
  points?: ScoresParEquipe;
  resultat?: { survivants: ScoresParEquipe };
}

export function actionsQuiz(etat: EtatQuiz): ActionQuiz['type'][] {
  switch (etat.etape) {
    case 'pret':
      return ['afficher'];
    case 'question':
      if (etat.chronoLance) return ['reveler', 'annuler'];
      return (etat.propositions ?? 0) < PROPOSITIONS_QUIZ
        ? ['proposition', 'annuler']
        : ['lancer', 'annuler'];
    case 'reponse':
      // Terminer avant la dernière question : les questions non jouées ne comptent pas.
      return etat.resteDesQuestions ? ['suivante', 'fin'] : ['fin'];
    case 'survivants':
      return ['valider'];
    case 'resultat':
      return [];
  }
}

export function appliquerQuiz(etat: EtatQuiz, action: ActionQuiz): TransitionQuiz {
  if (!actionsQuiz(etat).includes(action.type)) {
    throw new Error(`Quiz : « ${action.type} » impossible à l'étape « ${etat.etape} ».`);
  }
  switch (action.type) {
    case 'afficher':
      // La question seule : ni proposition, ni chrono.
      return { etape: 'question', chrono: 'arreter', propositions: 0 };
    case 'proposition':
      return { etape: 'question', chrono: 'garder', propositions: (etat.propositions ?? 0) + 1 };
    case 'lancer':
      return {
        etape: 'question',
        chrono: { demarrer: CHRONO_QUESTION_S },
        propositions: PROPOSITIONS_QUIZ,
      };
    case 'reveler':
      return { etape: 'reponse', chrono: 'arreter' };
    case 'annuler':
      // Une question annulée n'a plus de suite si c'était la dernière : on va aux survivants.
      return {
        etape: etat.resteDesQuestions ? 'pret' : 'survivants',
        chrono: 'arreter',
        propositions: 0,
      };
    case 'suivante':
      return { etape: 'pret', chrono: 'garder', propositions: 0 };
    case 'fin':
      return { etape: 'survivants', chrono: 'garder' };
    case 'valider':
      return {
        etape: 'resultat',
        chrono: 'garder',
        points: scoreQuiz(action.survivants),
        resultat: { survivants: { ...action.survivants } },
      };
  }
}
