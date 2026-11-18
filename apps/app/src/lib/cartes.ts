/**
 * Cartes « Faisons connaissance » (2026-11-18) : la saisie du joueur et le choix de l'équipe à
 * célébrer, en fonctions pures. La base revérifie tout (`enregistrer_carte`, `tirer_carte`).
 */
import { nettoyerLigne } from './avis';

export const CARTE_AGE_MIN = 10;
export const CARTE_AGE_MAX = 110;
export const CARTE_METIER_MAX = 60;
export const CARTE_ANECDOTE_MAX = 120;

/** À l'écran, la carte se retourne après la célébration de l'équipe (ms depuis le départ). */
export const CONNAISSANCE_CARTE_MS = 2500;
/** Le chrono de la salle posé par la touche de la régie : il porte les délais de l'écran. */
export const CONNAISSANCE_DUREE_S = 4;

/** Ce que le joueur envoie : chaque champ est facultatif ; tous vides, la carte est supprimée. */
export interface CarteSaisie {
  age: number | null;
  metier: string | null;
  anecdote: string | null;
  accord: boolean;
}

/** La carte telle que `etat_joueur` la rend au joueur. */
export interface CarteDuJoueur {
  age: number | null;
  metier: string | null;
  anecdote: string | null;
  accord: boolean;
  /** Déjà présentée sur le grand écran. */
  tiree: boolean;
}

export type ErreurCarte = 'age' | 'metierLong' | 'anecdoteLong';

const longueur = (texte: string) => Array.from(texte).length;

/** Caractères restants dans un champ (négatif : trop long). */
export function restants(texte: string, max: number): number {
  return max - longueur(nettoyerLigne(texte));
}

/**
 * La saisie prête à partir, ou la première erreur. L'âge accepte un champ vide ; sinon un
 * entier entre 10 et 110.
 */
export function saisieCarte(champs: {
  age: string;
  metier: string;
  anecdote: string;
  accord: boolean;
}): { ok: true; carte: CarteSaisie } | { ok: false; erreur: ErreurCarte } {
  const ageBrut = champs.age.trim();
  const age = ageBrut === '' ? null : Number(ageBrut);
  if (age !== null && (!Number.isInteger(age) || age < CARTE_AGE_MIN || age > CARTE_AGE_MAX)) {
    return { ok: false, erreur: 'age' };
  }
  const metier = nettoyerLigne(champs.metier);
  if (longueur(metier) > CARTE_METIER_MAX) return { ok: false, erreur: 'metierLong' };
  const anecdote = nettoyerLigne(champs.anecdote);
  if (longueur(anecdote) > CARTE_ANECDOTE_MAX) return { ok: false, erreur: 'anecdoteLong' };
  return {
    ok: true,
    carte: { age, metier: metier || null, anecdote: anecdote || null, accord: champs.accord },
  };
}

/** Une carte vide : rien à montrer, et rien que la base garde. */
export const carteVide = (c: Pick<CarteSaisie, 'age' | 'metier' | 'anecdote'>) =>
  c.age === null && !c.metier && !c.anecdote;

/**
 * L'équipe à célébrer par défaut : celle qui a le plus marqué sur ce jeu. En cas d'égalité, la
 * première par numéro, signalée : la régie choisit alors elle-même.
 */
export function equipeParDefaut(
  points: readonly { equipe_id: string; numero: number; points: number }[],
): { equipeId: string; egalite: boolean } | null {
  if (points.length === 0) return null;
  const meilleur = Math.max(...points.map((p) => p.points));
  const premieres = points.filter((p) => p.points === meilleur).sort((a, b) => a.numero - b.numero);
  return { equipeId: premieres[0]!.equipe_id, egalite: premieres.length > 1 };
}

/** Les points marqués par chaque équipe sur un jeu, à partir des lignes du journal des scores. */
export function pointsParEquipe(
  equipes: readonly { id: string; numero: number }[],
  scores: readonly { equipe_id: string; points: number }[],
): { equipe_id: string; numero: number; points: number }[] {
  return equipes.map((eq) => ({
    equipe_id: eq.id,
    numero: eq.numero,
    points: scores.filter((s) => s.equipe_id === eq.id).reduce((t, s) => t + s.points, 0),
  }));
}
