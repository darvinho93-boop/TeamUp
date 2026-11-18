/**
 * Portrait mystère (2026-11-18), côté app : lire la grille et la cible dans l'état de la salle,
 * dire où en est chaque équipe, et préparer la grille (compléter au hasard, mélanger). Fonctions
 * pures ; les règles du jeu vivent dans `packages/game` (`appliquerPortrait`).
 */

import {
  CARTES_PORTRAIT,
  CHRONO_TOUR_PORTRAIT_DEFAUT_S,
  CHRONO_TOUR_PORTRAIT_MAX_S,
  CHRONO_TOUR_PORTRAIT_MIN_S,
  MODES_PORTRAIT,
  resultatPortraitDe,
  tirerOrdre,
  type ModePortrait,
} from '@teamup/game';
import type { Langue } from './partie';
import type { EquipeSalle, MancheSalle, ParLangue, PassageSalle } from './salle';

type Alea = () => number;

/** Le chrono d'un tour de vote : `options.chrono_s` de la préparation, 20 s par défaut. */
export function chronoTourPortrait(manche: Pick<MancheSalle, 'options'>): number {
  const reglage = manche.options['chrono_s'];
  return typeof reglage === 'number' &&
    Number.isInteger(reglage) &&
    reglage >= CHRONO_TOUR_PORTRAIT_MIN_S &&
    reglage <= CHRONO_TOUR_PORTRAIT_MAX_S
    ? reglage
    : CHRONO_TOUR_PORTRAIT_DEFAUT_S;
}

/** Le mode fixé au lancement ; `null` avant, ou pour un autre jeu. */
export function modeDuPortrait(manche: MancheSalle): ModePortrait | null {
  if (manche.jeu !== 'portrait' || manche.statut === 'a_venir') return null;
  const mode = manche.options['mode'];
  return (MODES_PORTRAIT as readonly unknown[]).includes(mode) ? (mode as ModePortrait) : 'voix';
}

/** Le nom d'une carte dans la langue voulue, sinon dans la première qui en a un. */
export function nomDeCarte(
  carte: ParLangue | undefined,
  langue: Langue,
  langues: readonly Langue[],
): string {
  for (const l of [langue, ...langues]) {
    const nom = carte?.[l]?.['nom'];
    if (typeof nom === 'string' && nom) return nom;
  }
  return '—';
}

/**
 * La position de la cible de ce passage et celle de la carte noire (0 à 24) : la régie seule
 * les connaît (`grille.ids`, `grille.noire`). `null` ailleurs, ou grille incomplète.
 */
export function positionsDuPassage(
  manche: Pick<MancheSalle, 'grille'>,
  passage: Pick<PassageSalle, 'contenu_id'>,
): { cible: number; noire: number } | null {
  const grille = manche.grille;
  if (!grille?.ids || grille.noire === null || !passage.contenu_id) return null;
  const cible = grille.ids.indexOf(passage.contenu_id);
  return cible < 0 ? null : { cible, noire: grille.noire };
}

/** Les équipes éliminées par la carte noire, sur toutes les cibles sauf `sauf` (numéros). */
export function elimineesDeLaManche(
  manche: Pick<MancheSalle, 'passages'>,
  sauf?: string,
): number[] {
  const toutes = manche.passages
    .filter((p) => p.id !== sauf)
    .flatMap((p) => resultatPortraitDe(p.resultat).eliminees);
  return [...new Set(toutes)].sort((a, b) => a - b);
}

/** Les votes du tour en cours, par numéro d'équipe (régie : la carte ; écran : `true`). */
export function votesDuTour(passage: Pick<PassageSalle, 'votes'>): Record<number, number> {
  const votes: Record<number, number> = {};
  for (const [numero, carte] of Object.entries(passage.votes ?? {})) {
    if (typeof carte === 'number') votes[Number(numero)] = carte;
  }
  return votes;
}

export type StatutEquipePortrait =
  | { statut: 'eliminee' }
  | { statut: 'trouvee'; tour: number }
  | { statut: 'a-vote' }
  | { statut: 'attend' };

/** Où en est chaque équipe sur la cible en cours, pour l'écran et la régie. */
export function statutsDesEquipes(
  equipes: readonly Pick<EquipeSalle, 'numero' | 'joueurs'>[],
  manche: Pick<MancheSalle, 'passages'>,
  passage: Pick<PassageSalle, 'id' | 'resultat' | 'votes'>,
): Record<number, StatutEquipePortrait> {
  const avant = elimineesDeLaManche(manche, passage.id);
  const resultat = resultatPortraitDe(passage.resultat);
  const statuts: Record<number, StatutEquipePortrait> = {};
  for (const { numero, joueurs } of equipes) {
    if (joueurs === 0) continue;
    const trouvee = resultat.trouvees[numero];
    statuts[numero] =
      avant.includes(numero) || resultat.eliminees.includes(numero)
        ? { statut: 'eliminee' }
        : trouvee !== undefined
          ? { statut: 'trouvee', tour: trouvee }
          : passage.votes?.[String(numero)] !== undefined
            ? { statut: 'a-vote' }
            : { statut: 'attend' };
  }
  return statuts;
}

/**
 * La grille est-elle prête à jouer ? 25 cartes, chaque cible dedans, une carte noire qui n'est
 * pas une cible. La régie le vérifie avant « Commencer » (elle seule voit `ids` et `noire`).
 */
export function grillePrete(manche: Pick<MancheSalle, 'grille' | 'passages'>): boolean {
  const grille = manche.grille;
  if (!grille?.ids || grille.ids.length !== CARTES_PORTRAIT || grille.noire === null) return false;
  if (manche.passages.length === 0) return false;
  const noire = grille.ids[grille.noire];
  return manche.passages.every(
    (p) => p.contenu_id !== null && p.contenu_id !== noire && grille.ids!.includes(p.contenu_id),
  );
}

/**
 * Compléter la grille au hasard : les cibles et la carte noire, puis des cartes tirées parmi les
 * contenus disponibles, le tout mélangé. `null` s'il n'y a pas de quoi arriver à 25 cartes.
 */
export function completerGrille({
  cibles,
  noire,
  disponibles,
  alea,
}: {
  cibles: readonly string[];
  noire: string;
  disponibles: readonly string[];
  alea: Alea;
}): { cartes: string[]; noire: number } | null {
  const fixes = [...new Set([...cibles, noire])];
  if (fixes.length !== cibles.length + 1) return null;
  const candidates = [...new Set(disponibles)].filter((id) => !fixes.includes(id));
  const manque = CARTES_PORTRAIT - fixes.length;
  if (manque < 0 || candidates.length < manque) return null;
  const leurres = tirerOrdre(candidates, alea).slice(0, manque);
  const cartes = tirerOrdre([...fixes, ...leurres], alea);
  return { cartes, noire: cartes.indexOf(noire) };
}

/** Mélanger une grille déjà faite, en gardant la carte noire où qu'elle aille. */
export function melangerGrille(
  grille: { cartes: readonly string[]; noire: number },
  alea: Alea,
): { cartes: string[]; noire: number } {
  const noire = grille.cartes[grille.noire]!;
  const cartes = tirerOrdre(grille.cartes, alea);
  return { cartes, noire: cartes.indexOf(noire) };
}
