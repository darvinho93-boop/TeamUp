/**
 * Où en est la soirée : quelle manche vient ensuite, quel passage dans la manche.
 * Les manches et les passages se jouent dans leur ordre ; une manche annulée est sautée.
 */

import type { GameCode } from '../catalogue';

export type StatutManche = 'a_venir' | 'en_cours' | 'terminee' | 'annulee';
export type StatutPassage = 'a_venir' | 'en_cours' | 'termine';

export interface PassageDuProgramme {
  id: string;
  ordre: number;
  statut: StatutPassage;
}

export interface MancheDuProgramme {
  id: string;
  jeu: GameCode;
  ordre: number;
  statut: StatutManche;
  passages: PassageDuProgramme[];
}

const parOrdre = <T extends { ordre: number }>(a: T, b: T) => a.ordre - b.ordre;

/** La prochaine manche à lancer, ou `null` quand le programme est joué. */
export function mancheSuivante(programme: readonly MancheDuProgramme[]): MancheDuProgramme | null {
  return [...programme].sort(parOrdre).find((m) => m.statut === 'a_venir') ?? null;
}

/** Le prochain passage à jouer dans la manche, ou `null` quand tous sont joués. */
export function passageSuivant(manche: MancheDuProgramme): PassageDuProgramme | null {
  return [...manche.passages].sort(parOrdre).find((p) => p.statut !== 'termine') ?? null;
}

export function mancheJouee(manche: MancheDuProgramme): boolean {
  return manche.passages.every((p) => p.statut === 'termine');
}
