/**
 * Pilotage du Portrait mystère (2026-11-18), une cible par passage :
 *
 *   pret ──indice──▶ vote ──cloturer──▶ tour ──indice──▶ vote …
 *                                         └──reveler──▶ revele ──noire (dernière cible)──▶ noire
 *
 * Une grille de 25 noms ; l'animateur donne trois indices préparés, un par tour. `vote` : le
 * chrono de la salle court, chaque équipe encore en lice vote pour une carte (son capitaine au
 * téléphone, ou la régie pour elle, mode à voix). `tour` : le verdict du tour. Une équipe qui a
 * voté la cible marque 100, 60 ou 30 selon le tour et a fini pour cette cible ; une équipe qui a
 * voté la carte noire est éliminée jusqu'à la fin du jeu (la carte reste cachée) ; un leurre ne
 * coûte rien. Après le troisième tour, ou quand plus aucune équipe n'est en lice, il ne reste qu'à
 * révéler la cible. `noire` : la carte noire se montre enfin, après la dernière cible.
 */

import type { Chrono } from './transition';

export type EtapePortrait = 'pret' | 'vote' | 'tour' | 'revele' | 'noire';
export type ModePortrait = 'voix' | 'telephones';
export const MODES_PORTRAIT: readonly ModePortrait[] = ['voix', 'telephones'];

/** Les points d'une cible trouvée, selon le tour (premier, deuxième, troisième indice). */
export const POINTS_PORTRAIT = [100, 60, 30] as const;
export const TOURS_PORTRAIT = POINTS_PORTRAIT.length;
/** La grille : 5 × 5. */
export const CARTES_PORTRAIT = 25;
export const COTE_PORTRAIT = 5;
/** Nombre de cibles d'une manche, choisi à la préparation. */
export const CIBLES_PORTRAIT_MIN = 3;
export const CIBLES_PORTRAIT_MAX = 8;
export const CIBLES_PORTRAIT_DEFAUT = 5;
/** Le chrono d'un tour de vote, réglable à la préparation. */
export const CHRONO_TOUR_PORTRAIT_DEFAUT_S = 20;
export const CHRONO_TOUR_PORTRAIT_MIN_S = 10;
export const CHRONO_TOUR_PORTRAIT_MAX_S = 60;

export type ActionPortrait =
  { type: 'indice' } | { type: 'cloturer' } | { type: 'reveler' } | { type: 'noire' };

/** Ce qu'une cible garde de son déroulé (le résultat du passage). */
export interface ResultatPortrait {
  /** Les équipes (numéros) qui ont trouvé, et à quel tour. */
  trouvees: Record<number, number>;
  /** Les équipes éliminées par la carte noire pendant cette cible. */
  eliminees: number[];
  /** Le dernier tour terminé (0 avant le premier). */
  tours: number;
}

export const RESULTAT_PORTRAIT_VIDE: ResultatPortrait = { trouvees: {}, eliminees: [], tours: 0 };

export interface EtatPortrait {
  etape: EtapePortrait;
  /** Le tour en cours ou le dernier donné (les indices affichés), 0 à `pret`. */
  tour: number;
  resultat: ResultatPortrait;
  /** Les équipes en jeu (numéros), celles qui ont des joueurs. */
  equipes: readonly number[];
  /** Les équipes déjà éliminées par une cible précédente de la manche. */
  elimineesAvant: readonly number[];
  /** Position (0 à 24) de la cible et de la carte noire dans la grille. */
  cible: number;
  noire: number;
  /** Les votes du tour en cours : numéro d'équipe → position de la carte. */
  votes: Readonly<Record<number, number>>;
  /** C'est la dernière cible de la manche : après elle, la carte noire se montre. */
  derniere: boolean;
  chronoTourS: number;
}

export interface TransitionPortrait {
  etape: EtapePortrait;
  tour: number;
  chrono: Chrono;
  resultat: ResultatPortrait;
  /** Les points donnés par cette touche, par numéro d'équipe. */
  points?: Record<number, number>;
}

/** Les points d'une cible trouvée au tour `tour` (1 à 3). */
export function pointsPortrait(tour: number): number {
  return POINTS_PORTRAIT[tour - 1] ?? 0;
}

/** Les équipes qui votent encore pour cette cible : en jeu, pas éliminées, pas déjà trouvé. */
export function equipesEnLice(
  etat: Pick<EtatPortrait, 'equipes' | 'elimineesAvant' | 'resultat'>,
): number[] {
  return etat.equipes.filter(
    (e) =>
      !etat.elimineesAvant.includes(e) &&
      !etat.resultat.eliminees.includes(e) &&
      etat.resultat.trouvees[e] === undefined,
  );
}

export function actionsPortrait(etat: EtatPortrait): ActionPortrait['type'][] {
  switch (etat.etape) {
    case 'pret':
      return ['indice'];
    case 'vote':
      return ['cloturer'];
    case 'tour': {
      const encore = etat.resultat.tours < TOURS_PORTRAIT && equipesEnLice(etat).length > 0;
      return encore ? ['indice', 'reveler'] : ['reveler'];
    }
    case 'revele':
      return etat.derniere ? ['noire'] : [];
    case 'noire':
      return [];
  }
}

export function appliquerPortrait(etat: EtatPortrait, action: ActionPortrait): TransitionPortrait {
  if (!actionsPortrait(etat).includes(action.type)) {
    throw new Error(
      `Portrait mystère : « ${action.type} » impossible à l'étape « ${etat.etape} ».`,
    );
  }
  const r = etat.resultat;
  switch (action.type) {
    case 'indice':
      return {
        etape: 'vote',
        tour: etat.tour + 1,
        chrono: { demarrer: etat.chronoTourS },
        resultat: r,
      };
    case 'cloturer': {
      const trouvees = { ...r.trouvees };
      const eliminees = [...r.eliminees];
      const points: Record<number, number> = {};
      for (const equipe of equipesEnLice(etat)) {
        const carte = etat.votes[equipe];
        if (carte === etat.cible) {
          trouvees[equipe] = etat.tour;
          points[equipe] = pointsPortrait(etat.tour);
        } else if (carte === etat.noire) {
          eliminees.push(equipe);
        }
      }
      return {
        etape: 'tour',
        tour: etat.tour,
        chrono: 'arreter',
        resultat: { trouvees, eliminees, tours: etat.tour },
        points,
      };
    }
    case 'reveler':
      return { etape: 'revele', tour: etat.tour, chrono: 'arreter', resultat: r };
    case 'noire':
      return { etape: 'noire', tour: etat.tour, chrono: 'arreter', resultat: r };
  }
}

/** Le total d'une cible : la somme de ce que chaque équipe a gagné. */
export function totalPortrait(r: ResultatPortrait): number {
  return Object.values(r.trouvees).reduce((total, tour) => total + pointsPortrait(tour), 0);
}

/** Le repère d'une carte : A1 à E5, colonne puis rangée. */
export function repereCarte(position: number): string {
  const colonne = String.fromCharCode(65 + (position % COTE_PORTRAIT));
  return `${colonne}${Math.floor(position / COTE_PORTRAIT) + 1}`;
}

/** Le résultat d'un passage tel que la base le garde, lu sans confiance. */
export function resultatPortraitDe(
  brut: Record<string, unknown> | null | undefined,
): ResultatPortrait {
  const entier = (v: unknown) =>
    typeof v === 'number' && Number.isInteger(v)
      ? v
      : typeof v === 'string' && /^\d+$/.test(v)
        ? Number(v)
        : null;
  const trouvees: Record<number, number> = {};
  const brutes = brut?.['trouvees'];
  if (brutes && typeof brutes === 'object' && !Array.isArray(brutes)) {
    for (const [numero, tour] of Object.entries(brutes as Record<string, unknown>)) {
      const n = entier(numero);
      const t = entier(tour);
      if (n !== null && t !== null) trouvees[n] = t;
    }
  }
  const eliminees = Array.isArray(brut?.['eliminees'])
    ? (brut['eliminees'] as unknown[]).flatMap((v) => {
        const n = entier(v);
        return n === null ? [] : [n];
      })
    : [];
  return { trouvees, eliminees, tours: entier(brut?.['tours']) ?? 0 };
}

/** Le même, prêt à écrire en base. */
export function resultatPortraitVers(r: ResultatPortrait): Record<string, unknown> {
  return { trouvees: r.trouvees, eliminees: r.eliminees, tours: r.tours };
}
