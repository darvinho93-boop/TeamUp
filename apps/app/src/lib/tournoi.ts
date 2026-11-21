/**
 * Tournoi de Tête, épaule, gobelet (2026-11-21), côté app : lire le tableau de la base, nommer un
 * tour, et dire à un joueur où il en est. Les règles vivent dans `packages/game` (`tournoi.ts`).
 */

import { estExempte, type Duelliste, type MatchTournoi } from '@teamup/game';
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

const NOMS_DES_TOURS = ['finale', 'demi', 'quart', 't16', 't32', 't64', 't128', 't256'] as const;
export type CleDuTour = (typeof NOMS_DES_TOURS)[number];

/**
 * Le nom d'un tour d'après son nombre de places : le « tour des 16 » compte 16 joueurs, 8 matchs.
 * À 100 joueurs, le tableau de 128 places part du tour des 128 ; les exemptés entrent directement
 * au tour des 64.
 */
export function nomDuTour(tour: number, tours: number): CleDuTour {
  return NOMS_DES_TOURS[Math.min(NOMS_DES_TOURS.length - 1, Math.max(0, tours - tour))]!;
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

/** Les vrais matchs d'un tour, dans l'ordre où ils se jouent, et ses exemptés à part. */
export function affichesDuTour<T extends MatchTournoi>(
  matchs: readonly T[],
): { matchs: T[]; exemptes: Duelliste[] } {
  const ordre = [...matchs].sort((x, y) => x.rang - y.rang);
  return {
    matchs: ordre.filter((m) => !estExempte(m)),
    exemptes: ordre.filter(estExempte).flatMap((m) => m.a ?? []),
  };
}

/** Ce qu'un téléphone reçoit du tournoi : son seul match (`tournoi_du_joueur`). */
export interface TournoiJoueur {
  etape: string | null;
  tire: boolean;
  tours: number | null;
  sequence: number | null;
  exempte: boolean;
  match: {
    tour: number;
    sequence: number | null;
    poste: number | null;
    adversaire: Duelliste | null;
    /** `null` tant que ce match n'est pas jugé. */
    gagne: boolean | null;
  } | null;
}

export type VueTournoi =
  | { cas: 'prepare' | 'spectateur' | 'elimine' | 'champion' }
  | { cas: 'appele'; poste: number; adversaire: Duelliste | null; etape: string | null }
  | { cas: 'attente'; passe: 'exempte' | 'qualifie' | null; adversaire: Duelliste | null };

/** Où en est ce joueur : ce que son téléphone doit lui dire. */
export function vueDuTournoi(t: TournoiJoueur): VueTournoi {
  if (!t.tire) return { cas: 'prepare' };
  const m = t.match;
  if (!m) return { cas: 'spectateur' };
  if (m.gagne === false) return { cas: 'elimine' };
  if (m.gagne === true) return { cas: 'champion' };
  if (
    m.sequence !== null &&
    m.sequence === t.sequence &&
    m.poste !== null &&
    (t.etape === 'appel' || t.etape === 'jeu' || t.etape === 'resultats')
  ) {
    return { cas: 'appele', poste: m.poste, adversaire: m.adversaire, etape: t.etape };
  }
  const passe = m.tour === 1 ? null : t.exempte && m.tour === 2 ? 'exempte' : 'qualifie';
  return { cas: 'attente', passe, adversaire: m.adversaire };
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
