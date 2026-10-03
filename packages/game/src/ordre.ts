/**
 * Tirage au sort de l'ordre de passage des équipes (lot 13), pour les jeux qui se jouent une
 * équipe à la fois. La régie tire en direct ; l'écran anime : les équipes se mélangent, puis
 * se rangent une à une. L'appelant fournit le hasard : rien ici ne dépend d'une horloge.
 */

import type { Alea } from './duels';

/** Mélange de Fisher-Yates : chaque ordre a la même chance. */
export function tirerOrdre<T>(elements: readonly T[], alea: Alea): T[] {
  const tire = [...elements];
  for (let i = tire.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [tire[i], tire[j]] = [tire[j]!, tire[i]!];
  }
  return tire;
}

/**
 * Les passages d'une manche dans le nouvel ordre : un tour par équipe, et chaque tour reprend
 * l'ordre tiré (décision du 2026-10-03). Le k-ième passage d'une équipe va au tour k.
 */
export function ordreDesPassages(
  passages: readonly { id: string; ordre: number; equipe_id: string | null }[],
  ordreEquipes: readonly string[],
): string[] {
  const parEquipe = new Map<string, string[]>();
  for (const p of [...passages].sort((a, b) => a.ordre - b.ordre)) {
    if (!p.equipe_id || !ordreEquipes.includes(p.equipe_id)) {
      throw new RangeError(`passage ${p.id} hors des équipes tirées`);
    }
    parEquipe.set(p.equipe_id, [...(parEquipe.get(p.equipe_id) ?? []), p.id]);
  }
  const tours = Math.max(0, ...[...parEquipe.values()].map((l) => l.length));
  const resultat: string[] = [];
  for (let tour = 0; tour < tours; tour++) {
    for (const equipe of ordreEquipes) {
      const id = parEquipe.get(equipe)?.[tour];
      if (id) resultat.push(id);
    }
  }
  return resultat;
}

/** Animation du tirage à l'écran : 3 s de mélange, puis une équipe rangée tous les quarts de seconde. */
export const MELANGE_TIRAGE_MS = 3000;
export const RANGEMENT_TIRAGE_MS = 250;
/** Assez pour ranger huit équipes. */
export const DUREE_TIRAGE_S = 5;

/** Combien d'équipes sont déjà rangées `ecouleMs` après le départ (0 pendant le mélange). */
export function equipesRangees(ecouleMs: number, equipes: number): number {
  if (ecouleMs < MELANGE_TIRAGE_MS) return 0;
  return Math.min(equipes, 1 + Math.floor((ecouleMs - MELANGE_TIRAGE_MS) / RANGEMENT_TIRAGE_MS));
}
