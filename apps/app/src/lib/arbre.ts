/**
 * L'arbre du tournoi à l'écran commun (2026-11-21), calculé sans DOM : les deux moitiés du tableau
 * convergent vers la coupe, au centre. Les positions sont des fractions de la scène.
 *
 * Tous les joueurs sont nommés sur le bord de la scène, même à 150 : un prénom par rangée, sur deux
 * colonnes en quinconce au-delà de seize par moitié, ce qui donne à chacun la hauteur de deux
 * rangées. Le trait de la colonne du bord passe entre deux prénoms de la colonne intérieure.
 * Le tour à jouer a ses prénoms sur sa colonne dès qu'il compte seize matchs ou moins.
 */

import { surScene, type Duelliste } from '@teamup/game';
import type { MatchSalle } from './tournoi';

/** Le plus grand tour à avoir sa colonne de prénoms ; seize par moitié, au-delà, en quinconce. */
export const MATCHS_MAX_AVEC_NOMS = 16;

/** La part de la scène laissée au titre et à la coupe. */
const LARGEUR_CENTRE = 0.15;
/** Où les traits de la finale s'arrêtent, juste avant la coupe. */
const BORD_COUPE = 0.46;
const PRENOM_QUINCONCE = 0.092;
const PRENOM_SEUL = 0.17;
const POIDS_COLONNE_NOMMEE = 5.5;
/** Dans une colonne nommée, la part de la place ; le reste est au trait vers le tour suivant. */
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
  rangs: number;
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
const cleJoueur = (j: Duelliste) => j.joueur_id || j.prenom;

const etatDe = (m: MatchSalle, cote: 0 | 1): EtatPlace => {
  if (!(cote === 0 ? m.a : m.b)) return 'vide';
  if (m.gagnant === null) return 'attente';
  return m.gagnant === cote ? 'gagne' : 'perdu';
};

function ecartMin(valeurs: number[]) {
  const triees = [...valeurs].sort((x, y) => x - y);
  let ecart = 1;
  for (let i = 1; i < triees.length; i++) ecart = Math.min(ecart, triees[i]! - triees[i - 1]!);
  return ecart;
}

export function dispositionArbre(
  matchs: readonly MatchSalle[],
  sequence: number | null,
): DispositionArbre {
  const tours = Math.max(1, ...matchs.map((m) => m.tour));
  const aJouer = matchs.filter((m) => m.gagnant === null);
  const tourVisible = aJouer.length > 0 ? Math.min(...aJouer.map((m) => m.tour)) : tours;
  const tries = [...matchs].sort((x, y) => x.tour - y.tour || x.rang - y.rang);
  const parCle = new Map(tries.map((m) => [`${m.tour}-${m.rang}`, m]));
  const matchsDuTour = (t: number) => 2 ** (tours - t);
  const moitieDe = (m: MatchSalle, cote: 0 | 1): Cote =>
    m.tour === tours ? (cote === 0 ? 'g' : 'd') : m.rang < matchsDuTour(m.tour) / 2 ? 'g' : 'd';
  const estAppele = (m: MatchSalle | undefined) =>
    sequence !== null && m?.sequence === sequence && m.gagnant === null;

  // Le parcours de chaque joueur : sa place de départ s'éteint quand il sort, à n'importe quel tour.
  const vainqueurs = new Set<string>();
  const elimines = new Set<string>();
  const enJeu = new Set<string>();
  for (const m of tries) {
    if (estAppele(m)) for (const j of [m.a, m.b]) if (j) enJeu.add(cleJoueur(j));
    if (!m.a || !m.b || m.gagnant === null) continue;
    vainqueurs.add(cleJoueur(m.gagnant === 0 ? m.a : m.b));
    elimines.add(cleJoueur(m.gagnant === 0 ? m.b : m.a));
  }

  // Une rangée par joueur du premier tour : un exempté en prend une, un match deux.
  const rangees: Record<Cote, string[]> = { g: [], d: [] };
  for (const m of tries) {
    if (m.tour !== 1) continue;
    rangees[moitieDe(m, 0)].push(`${m.rang}-0`);
    if (m.b) rangees[moitieDe(m, 1)].push(`${m.rang}-1`);
  }
  const quinconce = Math.max(rangees.g.length, rangees.d.length) > MATCHS_MAX_AVEC_NOMS;
  const feuilles = new Map<string, { y: number; interieur: boolean }>();
  for (const liste of [rangees.g, rangees.d]) {
    liste.forEach((cle, i) =>
      feuilles.set(cle, { y: (i + 1) / (liste.length + 1), interieur: quinconce && i % 2 === 1 }),
    );
  }

  // Un match est à mi-hauteur de ses deux joueurs ; les deux demi-finales arrivent sur la coupe.
  const yMatch = new Map<string, number>();
  const yPlace = (m: MatchSalle, cote: 0 | 1) =>
    (m.tour === 1
      ? feuilles.get(`${m.rang}-${cote}`)?.y
      : yMatch.get(`${m.tour - 1}-${2 * m.rang + cote}`)) ?? 0.5;
  for (const m of tries) {
    if (m.tour === tours) continue;
    const milieu =
      m.tour === tours - 1
        ? 0.5
        : m.tour === 1 && !m.b
          ? yPlace(m, 0)
          : (yPlace(m, 0) + yPlace(m, 1)) / 2;
    yMatch.set(`${m.tour}-${m.rang}`, milieu);
  }

  // La hauteur d'une place : ce que laissent ses deux plus proches voisines.
  const rangsDu = new Map<number, number>();
  for (let t = 1; t <= tours; t++) {
    const duTour = tries.filter((m) => m.tour === t);
    const ys = (moitie: Cote) =>
      duTour.flatMap((m) =>
        ([0, 1] as const)
          .filter((c) => moitieDe(m, c) === moitie && (t > 1 || c === 0 || m.b))
          .map((c) => yPlace(m, c)),
      );
    const ecart = Math.min(ecartMin(ys('g')), ecartMin(ys('d')));
    rangsDu.set(t, Math.max(RANGS_MIN, 1 / (t === 1 && quinconce ? 2 * ecart : ecart)));
  }

  // Les colonnes, du bord de la scène vers le centre ; l'autre moitié en est le miroir.
  const nommee = (t: number) =>
    t > 1 && t === tourVisible && matchsDuTour(t) <= MATCHS_MAX_AVEC_NOMS;
  const poidsDu = (t: number) => (nommee(t) ? POIDS_COLONNE_NOMMEE : 1);
  const zonePrenoms = quinconce ? 2 * PRENOM_QUINCONCE : PRENOM_SEUL;
  const zoneArbre = (1 - LARGEUR_CENTRE) / 2 - zonePrenoms;
  let somme = 0;
  for (let t = 1; t <= tours; t++) somme += poidsDu(t);
  const colonnes = new Map<number, { debut: number; largeur: number }>();
  let cumul = 0;
  for (let t = 1; t <= tours; t++) {
    colonnes.set(t, {
      debut: zonePrenoms + (cumul / somme) * zoneArbre,
      largeur: (poidsDu(t) / somme) * zoneArbre,
    });
    cumul += poidsDu(t);
  }
  const X = (cote: Cote, f: number) => arrondi((cote === 'g' ? f : 1 - f) * VUE);
  const Y = (y: number) => arrondi(y * VUE);

  const places: PlaceArbre[] = [];
  const lignes: LigneArbre[] = [];
  const postes: PosteArbre[] = [];

  /** Pose le joueur à sa place et rend le bord d'où part son trait. */
  const poser = (m: MatchSalle, cote: 0 | 1): number => {
    const joueur = cote === 0 ? m.a : m.b;
    const moitie = moitieDe(m, cote);
    const { debut, largeur } = colonnes.get(m.tour)!;
    const commun = {
      cle: `${m.tour}-${m.rang}-${cote}`,
      joueur,
      cote: moitie,
      tour: m.tour,
      y: yPlace(m, cote),
      rangs: rangsDu.get(m.tour)!,
      actif: joueur ? enJeu.has(cleJoueur(joueur)) : false,
    };
    if (m.tour === 1) {
      const interieur = feuilles.get(`${m.rang}-${cote}`)?.interieur ?? false;
      const large = quinconce ? PRENOM_QUINCONCE : PRENOM_SEUL;
      const bord = interieur ? PRENOM_QUINCONCE : 0;
      const cle = joueur ? cleJoueur(joueur) : '';
      places.push({
        ...commun,
        etat: elimines.has(cle) ? 'perdu' : vainqueurs.has(cle) ? 'gagne' : 'attente',
        x: moitie === 'g' ? bord : 1 - bord - large,
        largeur: large,
        pastille: false,
      });
      return bord + large;
    }
    if (nommee(m.tour)) {
      const large = largeur * PART_PLACE;
      places.push({
        ...commun,
        etat: etatDe(m, cote),
        x: moitie === 'g' ? debut : 1 - debut - large,
        largeur: large,
        pastille: false,
      });
      return debut + large;
    }
    // Un tour sans colonne de prénoms : un point à la couleur de qui y est arrivé, sinon le trait.
    if (joueur) {
      places.push({
        ...commun,
        etat: etatDe(m, cote),
        x: moitie === 'g' ? debut : 1 - debut,
        largeur: 0,
        pastille: true,
      });
    }
    return debut;
  };

  for (const m of tries) {
    const { debut, largeur } = colonnes.get(m.tour)!;
    const actif = estAppele(m);
    const equipeDe = (cote: 0 | 1) =>
      m.gagnant === cote ? ((cote === 0 ? m.a : m.b)?.equipe ?? null) : null;

    if (m.tour === tours) {
      for (const cote of [0, 1] as const) {
        const moitie = moitieDe(m, cote);
        const bord = poser(m, cote);
        lignes.push({
          cle: `${m.tour}-${m.rang}-${cote}`,
          d: `M${X(moitie, bord)},${Y(0.5)}H${X(moitie, BORD_COUPE)}`,
          equipe: equipeDe(cote),
          active: actif,
        });
      }
      continue;
    }

    const moitie = moitieDe(m, 0);
    const milieu = yMatch.get(`${m.tour}-${m.rang}`)!;
    const axe = debut + largeur * (nommee(m.tour) ? PART_PLACE + (1 - PART_PLACE) / 2 : 0.5);
    const exempte = m.tour === 1 && !m.b;
    // Un exempté n'a rien gagné encore : son trait s'allume avec son premier vrai match.
    const suivant = parCle.get(`${m.tour + 1}-${m.rang >> 1}`);
    const equipeExempte = suivant?.gagnant === m.rang % 2 ? (m.a?.equipe ?? null) : null;
    const brancheActive = actif || (exempte && estAppele(suivant));

    const relier = (cote: 0 | 1, suffixe: 'a' | 'b') => {
      const bord = poser(m, cote);
      lignes.push({
        cle: `${m.tour}-${m.rang}-${suffixe}`,
        d: `M${X(moitie, bord)},${Y(yPlace(m, cote))}H${X(moitie, axe)}V${Y(milieu)}`,
        equipe: exempte ? equipeExempte : equipeDe(cote),
        active: brancheActive,
      });
    };
    relier(0, 'a');
    if (!exempte) relier(1, 'b');

    const gagnant = m.gagnant === 0 ? m.a : m.gagnant === 1 ? m.b : null;
    lignes.push({
      cle: `${m.tour}-${m.rang}-t`,
      d: `M${X(moitie, axe)},${Y(milieu)}H${X(moitie, debut + largeur)}`,
      equipe: exempte ? equipeExempte : (gagnant?.equipe ?? null),
      active: brancheActive,
    });

    // Le poste au croisement du match ; demi-finales et finale se jouent sur scène, sans poste.
    if (
      sequence !== null &&
      m.sequence === sequence &&
      m.poste !== null &&
      !surScene(m.tour, tours)
    ) {
      postes.push({
        cle: `${m.tour}-${m.rang}`,
        poste: m.poste,
        x: X(moitie, axe) / VUE,
        y: milieu,
        // Au premier tour, deux vrais matchs sont toujours à deux rangées l'un de l'autre.
        rangs:
          m.tour > 1
            ? rangsDu.get(m.tour + 1)!
            : quinconce
              ? rangsDu.get(1)!
              : Math.max(RANGS_MIN, rangsDu.get(1)! / 2),
        juge: m.gagnant !== null,
      });
    }
  }

  const finale = matchs.find((m) => m.tour === tours);
  const champion =
    finale?.gagnant === 0 ? finale.a : finale?.gagnant === 1 ? (finale.b ?? null) : null;
  return { places, lignes, postes, tourVisible, champion: champion ?? null };
}
