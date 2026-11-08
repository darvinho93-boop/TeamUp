/**
 * Surenchère (`enchere2`), deux modes, choisis au lancement de la manche :
 *
 * - **à la voix** (spec v3) : un champion par équipe surenchérit. Tenu : +100 à l'équipe du
 *   champion. Raté : +20 à chacune des autres équipes ayant des joueurs.
 * - **téléphones** (2026-11-08, écart assumé à la spec v3) : pendant le chrono, le capitaine de
 *   chaque équipe tape le plus de mots possible sur le sujet. L'animateur raye les mots hors sujet,
 *   puis le podium du thème rapporte +100, +60 et +30.
 */

import type { ScoresParEquipe } from './scores';

export const POINTS_TENU = 100;
export const POINTS_RATE_PAR_AUTRE_EQUIPE = 20;

export type ModeSurenchere = 'voix' | 'telephones';
export const MODES_SURENCHERE: readonly ModeSurenchere[] = ['voix', 'telephones'];

export interface ResultatSurenchere {
  equipeChampion: number;
  tenu: boolean;
  /** Numéros des équipes qui comptent au moins un joueur. */
  equipesAvecJoueurs: readonly number[];
}

export function scoreSurenchere({
  equipeChampion,
  tenu,
  equipesAvecJoueurs,
}: ResultatSurenchere): ScoresParEquipe {
  if (!equipesAvecJoueurs.includes(equipeChampion)) {
    throw new RangeError(`L'équipe du champion (${equipeChampion}) n'a aucun joueur.`);
  }
  if (tenu) return { [equipeChampion]: POINTS_TENU };
  const scores: ScoresParEquipe = {};
  for (const equipe of new Set(equipesAvecJoueurs)) {
    if (equipe !== equipeChampion) scores[equipe] = POINTS_RATE_PAR_AUTRE_EQUIPE;
  }
  return scores;
}

// ---------------------------------------------------------------------------
// Mode téléphones
// ---------------------------------------------------------------------------

/** Le podium d'un thème : le 1er, le 2e, le 3e. */
export const POINTS_PODIUM = [100, 60, 30] as const;
/** Un mot tient sur une carte de l'écran. */
export const LONGUEUR_MOT_MAX = 40;
/** Par équipe et par thème : au-delà, la carte de l'écran ne se lirait plus. */
export const MOTS_MAX = 60;
/** Taper prend plus de temps que parler : le chrono du mode téléphones a son propre réglage. */
export const CHRONO_SURENCHERE_TELEPHONES_DEFAUT_S = 60;

const ACCENTS = 'àáâãäåāçćčèéêëēėęìíîïīñńòóôõöøōùúûüūýÿžźżšœæ';
const SANS_ACCENTS = 'aaaaaaaccceeeeeeeiiiiinnooooooouuuuuyyzzzsoa';

/**
 * La forme comparée d'un mot, la même que `cle_mot` en base (et que `cle_prenom`) : sans casse,
 * sans accents latins, espaces réduits. « Éléphant », « elephant » et « ÉLÉPHANT » sont un doublon.
 */
export function cleMot(mot: string): string {
  const simple = mot.trim().replace(/\s+/gu, ' ').toLowerCase();
  let cle = '';
  for (const lettre of simple) {
    const i = ACCENTS.indexOf(lettre);
    cle += i < 0 ? lettre : SANS_ACCENTS[i];
  }
  return cle;
}

export interface ClassementMots {
  /** Le rang de chaque équipe qui a au moins un mot validé (1 = la première). */
  rangs: Record<number, number>;
  /** Les points du podium, seulement pour les équipes qui en marquent. */
  points: ScoresParEquipe;
}

/**
 * Le podium d'un thème, d'après le nombre de mots validés de chaque équipe. Ex aequo : même rang
 * et mêmes points, le rang suivant est sauté (12, 12 et 9 mots : 100, 100, 30). Une équipe sans
 * aucun mot validé n'a ni rang ni point.
 */
export function podiumDesMots(comptes: Readonly<Record<number, number>>): ClassementMots {
  const enJeu = Object.entries(comptes)
    .map(([numero, n]) => ({ numero: Number(numero), n }))
    .filter((e) => Number.isInteger(e.numero) && e.n > 0);
  const rangs: Record<number, number> = {};
  const points: ScoresParEquipe = {};
  for (const e of enJeu) {
    const rang = 1 + enJeu.filter((autre) => autre.n > e.n).length;
    rangs[e.numero] = rang;
    const gagnes = POINTS_PODIUM[rang - 1];
    if (gagnes !== undefined) points[e.numero] = gagnes;
  }
  return { rangs, points };
}
