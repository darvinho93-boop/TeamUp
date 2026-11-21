/**
 * L'arbre du tournoi à l'écran commun (2026-11-21), calculé sans DOM : les deux moitiés du tableau
 * convergent vers la finale, au centre. Les positions sont des fractions de la scène.
 *
 * Un grand tableau ne tient pas en toutes lettres : au-delà de 16 matchs dans un tour, et pour les
 * tours déjà joués, chaque joueur est une pastille à la couleur de son équipe. La place gagnée va
 * aux tours à venir, qui gardent les prénoms.
 */

import { surScene, type Duelliste } from '@teamup/game';
import type { MatchSalle } from './tournoi';

/** Le plus grand tour écrit en toutes lettres : seize prénoms par moitié de scène. */
export const MATCHS_MAX_AVEC_NOMS = 16;

const POIDS_PASTILLE = 0.32;
const POIDS_CENTRE = 1.4;
/** Le tour à jouer a la colonne la plus large : c'est là que se lisent les prénoms. */
const POIDS_TOUR_A_JOUER = 1.4;
/** Dans une colonne, la part de la place ; le reste est au trait qui la relie au tour suivant. */
const PART_PLACE = 0.82;
/** Une place ne grandit pas au-delà d'une rangée sur huit, même seule dans sa colonne. */
const RANGS_MIN = 8;
/** Le repère du dessin des traits (`viewBox`). */
const VUE = 1000;

export type Cote = 'g' | 'd';
export type EtatPlace = 'vide' | 'attente' | 'gagne' | 'perdu';

export interface PlaceArbre {
  cle: string;
  joueur: Duelliste | null;
  etat: EtatPlace;
  cote: Cote;
  tour: number;
  /** Bord gauche et largeur, en fraction de la scène. */
  x: number;
  largeur: number;
  /** Centre vertical, en fraction de la scène. */
  y: number;
  /** Le nombre de rangées de sa colonne : il donne sa hauteur et sa police. */
  rangs: number;
  pastille: boolean;
  /** Son match est appelé et n'a pas encore de résultat. */
  actif: boolean;
}

export interface LigneArbre {
  cle: string;
  d: string;
  /** L'équipe du joueur passé par ce trait, `null` tant que personne n'y est passé. */
  equipe: number | null;
  active: boolean;
}

export interface PosteArbre {
  cle: string;
  poste: number;
  x: number;
  y: number;
  juge: boolean;
}

export interface DispositionArbre {
  places: PlaceArbre[];
  lignes: LigneArbre[];
  postes: PosteArbre[];
  /** Le tour à jouer : le premier qui a encore un match sans résultat. */
  tourVisible: number;
  champion: Duelliste | null;
}

const arrondi = (n: number) => Math.round(n * 10) / 10;

const etatDe = (m: MatchSalle, cote: 0 | 1): EtatPlace => {
  if (!(cote === 0 ? m.a : m.b)) return 'vide';
  if (m.gagnant === null) return 'attente';
  return m.gagnant === cote ? 'gagne' : 'perdu';
};

export function dispositionArbre(
  matchs: readonly MatchSalle[],
  sequence: number | null,
): DispositionArbre {
  const tours = Math.max(1, ...matchs.map((m) => m.tour));
  const aJouer = matchs.filter((m) => m.gagnant === null);
  const tourVisible = aJouer.length > 0 ? Math.min(...aJouer.map((m) => m.tour)) : tours;
  const matchsDuTour = (t: number) => 2 ** (tours - t);
  const enPastilles = (t: number) => t < tourVisible || matchsDuTour(t) > MATCHS_MAX_AVEC_NOMS;

  // Les colonnes, du bord de la scène vers le centre ; l'autre moitié en est le miroir.
  const poidsDu = (t: number) =>
    enPastilles(t) ? POIDS_PASTILLE : t === tourVisible ? POIDS_TOUR_A_JOUER : 1;
  let somme = 0;
  for (let t = 1; t <= tours; t++) somme += poidsDu(t);
  const total = 2 * somme + POIDS_CENTRE;
  const colonnes = new Map<number, { debut: number; largeur: number }>();
  let cumul = 0;
  for (let t = 1; t <= tours; t++) {
    colonnes.set(t, { debut: cumul / total, largeur: poidsDu(t) / total });
    cumul += poidsDu(t);
  }
  const bordCentre = cumul / total;
  const X = (cote: Cote, f: number) => arrondi((cote === 'g' ? f : 1 - f) * VUE);
  const Y = (y: number) => arrondi(y * VUE);

  const places: PlaceArbre[] = [];
  const lignes: LigneArbre[] = [];
  const postes: PosteArbre[] = [];

  for (const m of matchs) {
    const { debut, largeur } = colonnes.get(m.tour)!;
    const finale = m.tour === tours;
    const n = matchsDuTour(m.tour);
    const actif = sequence !== null && m.sequence === sequence && m.gagnant === null;
    const gagnantDe = m.gagnant === 0 ? m.a : m.gagnant === 1 ? m.b : null;
    // Une pastille est centrée sur le début de sa colonne : le trait du tour d'avant y arrive, le
    // sien en repart, et la branche reste d'un seul tenant.
    const pastille = enPastilles(m.tour);
    const bordPlace = pastille ? debut : debut + largeur * PART_PLACE;
    const place = (cote: 0 | 1, moitie: Cote, y: number) => {
      const largeurPlace = pastille ? 0 : largeur * PART_PLACE;
      places.push({
        cle: `${m.tour}-${m.rang}-${cote}`,
        joueur: cote === 0 ? m.a : m.b,
        etat: etatDe(m, cote),
        cote: moitie,
        tour: m.tour,
        x: moitie === 'g' ? debut : 1 - debut - largeurPlace,
        largeur: largeurPlace,
        y,
        rangs: Math.max(RANGS_MIN, n),
        pastille,
        actif,
      });
    };

    if (finale) {
      place(0, 'g', 0.5);
      place(1, 'd', 0.5);
      for (const [cote, moitie] of [
        [0, 'g'],
        [1, 'd'],
      ] as const) {
        const joueur = cote === 0 ? m.a : m.b;
        lignes.push({
          cle: `${m.tour}-${m.rang}-${cote}`,
          d: `M${X(moitie, bordPlace)},${Y(0.5)}H${X(moitie, bordCentre)}`,
          equipe: m.gagnant === cote ? (joueur?.equipe ?? null) : null,
          active: actif,
        });
      }
      continue;
    }

    const moitie: Cote = m.rang < n / 2 ? 'g' : 'd';
    const s = moitie === 'g' ? m.rang : m.rang - n / 2;
    const ya = (2 * s + 0.5) / n;
    const yb = (2 * s + 1.5) / n;
    const milieu = (2 * s + 1) / n;
    const axe = pastille
      ? debut + largeur / 2
      : debut + largeur * (PART_PLACE + (1 - PART_PLACE) / 2);
    const exempte = m.tour === 1 && !m.b;

    place(0, moitie, ya);
    lignes.push({
      cle: `${m.tour}-${m.rang}-a`,
      d: `M${X(moitie, bordPlace)},${Y(ya)}H${X(moitie, axe)}V${Y(milieu)}`,
      equipe: m.gagnant === 0 ? (m.a?.equipe ?? null) : null,
      active: actif,
    });
    if (!exempte) {
      place(1, moitie, yb);
      lignes.push({
        cle: `${m.tour}-${m.rang}-b`,
        d: `M${X(moitie, bordPlace)},${Y(yb)}H${X(moitie, axe)}V${Y(milieu)}`,
        equipe: m.gagnant === 1 ? (m.b?.equipe ?? null) : null,
        active: actif,
      });
    }
    lignes.push({
      cle: `${m.tour}-${m.rang}-t`,
      d: `M${X(moitie, axe)},${Y(milieu)}H${X(moitie, debut + largeur)}`,
      equipe: gagnantDe?.equipe ?? null,
      active: actif,
    });
    // Le poste sur le trait du match ; demi-finales et finale se jouent sur scène, sans poste.
    if (
      sequence !== null &&
      m.sequence === sequence &&
      m.poste !== null &&
      !pastille &&
      !surScene(m.tour, tours)
    ) {
      postes.push({
        cle: `${m.tour}-${m.rang}`,
        poste: m.poste,
        x: X(moitie, axe) / VUE,
        y: milieu,
        juge: m.gagnant !== null,
      });
    }
  }

  const finale = matchs.find((m) => m.tour === tours);
  const champion =
    finale?.gagnant === 0 ? finale.a : finale?.gagnant === 1 ? (finale.b ?? null) : null;
  return { places, lignes, postes, tourVisible, champion: champion ?? null };
}
