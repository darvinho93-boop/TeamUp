/**
 * Quiz en mode jetons (2026-10-18), côté régie : ce qui manque pour lancer, où en est chaque
 * équipe pendant une question, et quand la réponse peut se révéler. La base tranche (mises,
 * chrono, déblocage) ; ces règles ne font que l'annoncer à l'animateur.
 */

import { jetonsDeDepart, MISE_VIDE, totalMise, type Repartition } from '@teamup/game';
import type { EquipeSalle, EtatSalle, MancheSalle, PassageSalle } from './salle';

/** Les équipes qui ont des joueurs mais pas de capitaine : le mode jetons ne peut pas partir. */
export function capitainesManquants(etat: EtatSalle): EquipeSalle[] {
  return etat.equipes.filter((e) => e.joueurs > 0 && !e.capitaine);
}

/** Toutes les équipes partent avec l'effectif de la plus grande. */
export function jetonsDeDepartDe(etat: EtatSalle): number {
  return jetonsDeDepart(etat.equipes.map((e) => e.joueurs));
}

export type StatutMise = 'validee' | 'en_cours' | 'figee' | 'sans_jetons';

export interface MiseEquipe {
  equipe: EquipeSalle;
  repartition: Repartition;
  /** Les jetons à poser sur cette question. */
  dispo: number;
  statut: StatutMise;
  debloquee: boolean;
}

/**
 * Chaque équipe sur la question en cours. Figée : chrono écoulé (une seconde de grâce, comme la
 * base), mise ni validée ni débloquée. `ecouleMs` est le temps du chrono de la salle.
 */
export function misesDesEquipes(
  etat: EtatSalle,
  manche: MancheSalle,
  passage: PassageSalle,
  ecouleMs: number,
): MiseEquipe[] {
  const duree = etat.pilotage.chrono_duree_s;
  const ecoule =
    etat.pilotage.etape === 'question' &&
    etat.pilotage.chrono_depart_ms !== null &&
    duree !== null &&
    ecouleMs > (duree + 1) * 1000;
  return etat.equipes.map((equipe) => {
    const mise = passage.mises?.[String(equipe.numero)];
    const dispo = manche.jetons?.[String(equipe.numero)]?.restants ?? 0;
    const repartition = mise?.repartition ?? MISE_VIDE;
    const debloquee = mise?.debloquee ?? false;
    const statut: StatutMise =
      dispo === 0
        ? 'sans_jetons'
        : mise?.valide
          ? 'validee'
          : ecoule && !debloquee
            ? 'figee'
            : 'en_cours';
    return { equipe, repartition, dispo, statut, debloquee };
  });
}

/** « Révéler » attend que chaque équipe qui a des jetons ait validé. */
export function revelationPrete(mises: readonly MiseEquipe[]): boolean {
  return mises.every((m) => m.statut === 'validee' || m.statut === 'sans_jetons');
}

/** Les jetons qui restent à poser pour une équipe, mise en cours. */
export function resteAPoser(mise: MiseEquipe): number {
  return Math.max(0, mise.dispo - totalMise(mise.repartition));
}
