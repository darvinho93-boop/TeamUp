/**
 * Ce qui prend la main sur le téléphone (parcours joueur, 2026-11-23). Pur et testé : l'écran
 * joueur ne décide rien d'autre. `jeu` est le jeu en cours sur ce téléphone ; `urgent` dit que la
 * régie attend ce joueur tout de suite : sa vue passe devant l'onglet, le formulaire ou la boîte
 * de dialogue ouverts, et la navigation s'efface jusqu'à la fin de l'interaction.
 */

import type { EtatJoueur } from './partie';
import { vueDuTournoi } from './tournoi';

export type JeuEnDirect = 'quiz' | 'surenchere' | 'blind' | 'portrait' | 'tournoi';

export interface Priorite {
  jeu: JeuEnDirect | null;
  urgent: boolean;
  /** L'heure de la base où `urgent` retombera seul (fin d'un chrono) ; `null` sans échéance. */
  finMs: number | null;
}

/** La base accepte encore une réponse une seconde après le chrono : le téléphone aussi. */
export const GRACE_CHRONO_MS = 1000;

type EtatDuDirect = Pick<EtatJoueur, 'quiz' | 'surenchere' | 'blind' | 'portrait' | 'tournoi'>;

const CALME = { urgent: false, finMs: null } as const;

/** Urgent jusqu'à la fin de son chrono ; sans chrono lancé, urgent sans échéance. */
function pendantLeChrono(
  departMs: number | null,
  dureeS: number | null,
  maintenantMs: number,
): Pick<Priorite, 'urgent' | 'finMs'> {
  if (departMs === null || dureeS === null) return { urgent: true, finMs: null };
  const finMs = departMs + dureeS * 1000 + GRACE_CHRONO_MS;
  return maintenantMs < finMs ? { urgent: true, finMs } : CALME;
}

function quizUrgent(
  quiz: NonNullable<EtatJoueur['quiz']>,
  maintenantMs: number,
): Pick<Priorite, 'urgent' | 'finMs'> {
  if (quiz.etape !== 'question' || !quiz.question) return CALME;
  if (quiz.mode === 'telephone') {
    if (!quiz.participant || quiz.elimine || quiz.ma_reponse !== null) return CALME;
    return pendantLeChrono(quiz.chrono_depart_ms, quiz.chrono_duree_s, maintenantMs);
  }
  if (!quiz.equipe || quiz.valide) return CALME;
  // Le capitaine reste attendu tant que sa mise est ouverte, déblocage par la régie compris.
  if (quiz.capitaine && quiz.chrono_depart_ms !== null) {
    return !quiz.fige && quiz.jetons > 0 ? { urgent: true, finMs: null } : CALME;
  }
  return pendantLeChrono(quiz.chrono_depart_ms, quiz.chrono_duree_s, maintenantMs);
}

function surenchereUrgente(
  s: NonNullable<EtatJoueur['surenchere']>,
  maintenantMs: number,
): Pick<Priorite, 'urgent' | 'finMs'> {
  if (!s.equipe) return CALME;
  if (s.etape === 'sujet') return { urgent: true, finMs: null };
  if (s.etape !== 'chrono') return CALME;
  return pendantLeChrono(s.chrono_depart_ms, s.chrono_duree_s, maintenantMs);
}

function blindUrgent(b: NonNullable<EtatJoueur['blind']>): boolean {
  if (b.equipe === null) return false;
  if (b.etape === 'buzz') return b.buzz === b.equipe;
  return b.etape === 'ecoute' && !b.bloquee;
}

function portraitUrgent(
  p: NonNullable<EtatJoueur['portrait']>,
  maintenantMs: number,
): Pick<Priorite, 'urgent' | 'finMs'> {
  if (p.etape !== 'vote' || p.mode !== 'telephones' || p.equipe === null) return CALME;
  if (p.eliminee || p.trouvee !== null) return CALME;
  return pendantLeChrono(p.chrono_depart_ms, p.chrono_duree_s, maintenantMs);
}

/** `maintenantMs` : l'heure de la base, jamais celle du téléphone. */
export function prioriteDuDirect(etat: EtatDuDirect, maintenantMs: number): Priorite {
  if (etat.quiz) return { jeu: 'quiz', ...quizUrgent(etat.quiz, maintenantMs) };
  if (etat.surenchere) {
    return { jeu: 'surenchere', ...surenchereUrgente(etat.surenchere, maintenantMs) };
  }
  if (etat.blind) return { jeu: 'blind', urgent: blindUrgent(etat.blind), finMs: null };
  if (etat.portrait) return { jeu: 'portrait', ...portraitUrgent(etat.portrait, maintenantMs) };
  if (etat.tournoi) {
    return { jeu: 'tournoi', urgent: vueDuTournoi(etat.tournoi).cas === 'appele', finMs: null };
  }
  return { jeu: null, ...CALME };
}
