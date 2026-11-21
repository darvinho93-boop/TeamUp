/**
 * Tournoi de Tête, épaule, gobelet (2026-11-21), côté app : lire le tableau de la base, nommer un
 * tour, et dire à un joueur où il en est. Les règles vivent dans `packages/game` (`tournoi.ts`).
 */

import type { Duelliste, MatchTournoi } from '@teamup/game';
import { correspond } from './membres';
import type { MancheSalle, TournoiSalle } from './salle';

export type MatchSalle = MatchTournoi & { id: string };

export const estTournoi = (manche: Pick<MancheSalle, 'jeu' | 'options'> | null | undefined) =>
  manche?.jeu === 'cup' && manche.options['format'] === 'tournoi';

/** Une ligne de `matchs_tournoi`. */
export interface LigneMatch {
  id: string;
  tour: number;
  rang: number;
  joueur_a: string | null;
  prenom_a: string | null;
  equipe_a: number | null;
  joueur_b: string | null;
  prenom_b: string | null;
  equipe_b: number | null;
  gagnant: number | null;
  sequence: number | null;
  poste: number | null;
}

export const COLONNES_MATCH =
  'id, tour, rang, joueur_a, prenom_a, equipe_a, joueur_b, prenom_b, equipe_b, gagnant, sequence, poste';

const duelliste = (
  id: string | null,
  prenom: string | null,
  equipe: number | null,
): Duelliste | null =>
  // Un joueur retiré de la Salle garde son prénom au tableau, sans identifiant.
  prenom === null ? null : { joueur_id: id ?? '', prenom, equipe: equipe ?? 0 };

export function matchDepuisLigne(l: LigneMatch): MatchSalle {
  return {
    id: l.id,
    tour: l.tour,
    rang: l.rang,
    a: duelliste(l.joueur_a, l.prenom_a, l.equipe_a),
    b: duelliste(l.joueur_b, l.prenom_b, l.equipe_b),
    gagnant: l.gagnant === 0 || l.gagnant === 1 ? l.gagnant : null,
    sequence: l.sequence,
    poste: l.poste,
  };
}

export type NomDuTour =
  | { cle: 'finale' | 'demi' | 'quart' | 'huitieme' | 'seizieme' }
  | { cle: 'places'; places: number };

/** « Quarts de finale », ou « Tour de 64 » au-delà des seizièmes. */
export function nomDuTour(tour: number, tours: number): NomDuTour {
  const restants = tours - tour;
  if (restants === 0) return { cle: 'finale' };
  if (restants === 1) return { cle: 'demi' };
  if (restants === 2) return { cle: 'quart' };
  if (restants === 3) return { cle: 'huitieme' };
  if (restants === 4) return { cle: 'seizieme' };
  return { cle: 'places', places: 2 ** (restants + 1) };
}

/**
 * L'étape où reprendre un tournoi quitté par une scène libre : le tirage s'il n'a pas commencé,
 * l'appel si personne n'a encore de résultat (la séquence se relance), sinon les résultats.
 */
export function etapeDeReprise(
  tournoi: Pick<TournoiSalle, 'sequence' | 'matchs'> | null | undefined,
): 'tirage' | 'appel' | 'resultats' {
  if (!tournoi?.sequence) return 'tirage';
  return tournoi.matchs.some((m) => m.gagnant !== null) ? 'resultats' : 'appel';
}

/** Les matchs où figure ce prénom, pour retrouver vite un perdant venu à la régie. */
export function matchsDuPrenom<T extends Pick<MatchTournoi, 'a' | 'b'>>(
  matchs: readonly T[],
  recherche: string,
): T[] {
  if (!recherche.trim()) return [...matchs];
  return matchs.filter(
    (m) =>
      (m.a !== null && correspond(m.a.prenom, recherche)) ||
      (m.b !== null && correspond(m.b.prenom, recherche)),
  );
}
