/**
 * Tournoi de Tête, épaule, gobelet (2026-11-21) : tous les joueurs de la soirée dans un tableau à
 * élimination directe. Jusqu'aux quarts, autant de matchs en même temps qu'il y a de gobelets, sur
 * une seule séquence annoncée par l'animateur ; demi-finales et finale sur scène, une à la fois.
 *
 * Le tableau compte toujours une puissance de 2 de places : celles en trop sont des exemptés, qui
 * passent directement au tour suivant. Aucune horloge ici, l'appelant fournit le hasard.
 */

import type { Alea } from './duels';
import { tirerOrdre } from './ordre';
import type { Duelliste } from './pilotage/duel';
import type { ScoresParEquipe } from './scores';

/** Matchs lancés en même temps, au choix de la régie : de un seul à tout un tour de 64es. */
export const GOBELETS_MIN = 1;
export const GOBELETS_MAX = 64;
export const GOBELETS_DEFAUT = 16;

export const POINTS_VAINQUEUR_TOURNOI = 100;
export const POINTS_FINALISTE_TOURNOI = 60;
export const POINTS_DEMI_TOURNOI = 30;

/**
 * Une séquence au budget de minutes : placement, séquence et file des perdants à la régie. Les
 * transitions du programme (+15 %) la portent à environ 2 minutes.
 */
export const SEQUENCE_TOURNOI_S = 105;

export interface MatchTournoi {
  /** 1 pour le premier tour. */
  tour: number;
  /** Sa place dans le tour, à partir de 0. */
  rang: number;
  a: Duelliste | null;
  b: Duelliste | null;
  /** 0 pour `a`, 1 pour `b`, `null` tant qu'il n'est pas joué. Un exempté a déjà gagné. */
  gagnant: 0 | 1 | null;
  /** La séquence où il est appelé, `null` avant. */
  sequence: number | null;
  /** Son poste dans la salle, à partir de 1, `null` avant l'appel. */
  poste: number | null;
}

export interface DimensionsTableau {
  /** La puissance de 2 au-dessus du nombre de joueurs. */
  places: number;
  exemptes: number;
  tours: number;
}

export function dimensionsTableau(joueurs: number): DimensionsTableau {
  if (!Number.isInteger(joueurs) || joueurs < 2) {
    throw new RangeError(`Un tournoi demande au moins 2 joueurs (reçu : ${joueurs}).`);
  }
  let places = 2;
  let tours = 1;
  while (places < joueurs) {
    places *= 2;
    tours++;
  }
  return { places, exemptes: places - joueurs, tours };
}

/** Le nombre de gobelets, ramené dans ses bornes. */
export function bornerGobelets(valeur: unknown): number {
  const n = typeof valeur === 'number' && Number.isFinite(valeur) ? Math.round(valeur) : NaN;
  if (Number.isNaN(n)) return GOBELETS_DEFAUT;
  return Math.min(GOBELETS_MAX, Math.max(GOBELETS_MIN, n));
}

/** Demi-finales et finale : sur scène, un match à la fois. */
export function surScene(tour: number, tours: number): boolean {
  return tour >= tours - 1;
}

/**
 * Range `joueurs` dans `capacite` cases en coupant chaque moitié du tableau en deux : une équipe
 * s'y partage à une unité près. Des coéquipiers se croisent donc le plus tard possible.
 */
function repartir(
  joueurs: readonly Duelliste[],
  capacite: number,
  alea: Alea,
): (Duelliste | null)[] {
  if (capacite === 1) return [joueurs[0] ?? null];
  const parEquipe = new Map<number, Duelliste[]>();
  for (const j of joueurs) parEquipe.set(j.equipe, [...(parEquipe.get(j.equipe) ?? []), j]);

  const gauche: Duelliste[] = [];
  const droite: Duelliste[] = [];
  const restes: Duelliste[] = [];
  for (const membres of parEquipe.values()) {
    const melanges = tirerOrdre(membres, alea);
    const moitie = Math.floor(melanges.length / 2);
    gauche.push(...melanges.slice(0, moitie));
    droite.push(...melanges.slice(moitie, moitie * 2));
    if (melanges.length % 2 === 1) restes.push(melanges.at(-1)!);
  }
  const depart = alea() < 0.5 ? 0 : 1;
  tirerOrdre(restes, alea).forEach((j, i) => ((i + depart) % 2 === 0 ? gauche : droite).push(j));

  return [...repartir(gauche, capacite / 2, alea), ...repartir(droite, capacite / 2, alea)];
}

/**
 * Le partage du tableau ne regarde pas qui tombe sans adversaire : on échange ensuite un exempté
 * de l'équipe la plus servie contre un joueur de la moins servie, sans jamais créer un match
 * entre coéquipiers.
 */
function equilibrerExemptes(cases: (Duelliste | null)[]): void {
  for (;;) {
    const exemptes = new Map<number, number[]>();
    const joueurs = new Map<number, number[]>();
    cases.forEach((j, i) => {
      if (!j) return;
      const cible = cases[i ^ 1] ? joueurs : exemptes;
      cible.set(j.equipe, [...(cible.get(j.equipe) ?? []), i]);
    });
    const compte = (e: number) => exemptes.get(e)?.length ?? 0;
    const equipes = [...new Set([...exemptes.keys(), ...joueurs.keys()])].sort(
      (x, y) => compte(y) - compte(x),
    );

    let echange: [number, number] | null = null;
    cherche: for (const servie of equipes) {
      for (const moins of [...equipes].reverse()) {
        if (compte(servie) - compte(moins) < 2) break;
        const remplace = (joueurs.get(moins) ?? []).find((i) => cases[i ^ 1]?.equipe !== servie);
        if (remplace !== undefined) {
          echange = [exemptes.get(servie)![0]!, remplace];
          break cherche;
        }
      }
    }
    if (!echange) return;
    const [x, y] = echange;
    [cases[x], cases[y]] = [cases[y]!, cases[x]!];
  }
}

/**
 * Tire le tableau complet, tous tours compris, exemptés déjà montés au deuxième tour. `null` sans
 * deux joueurs de deux équipes différentes.
 */
export function tirerTableau(joueurs: readonly Duelliste[], alea: Alea): MatchTournoi[] | null {
  if (joueurs.length < 2 || new Set(joueurs.map((j) => j.equipe)).size < 2) return null;
  const { places, tours } = dimensionsTableau(joueurs.length);
  const cases = repartir(joueurs, places, alea);
  equilibrerExemptes(cases);

  const matchs: MatchTournoi[] = [];
  for (let tour = 1; tour <= tours; tour++) {
    const nombre = places / 2 ** tour;
    for (let rang = 0; rang < nombre; rang++) {
      matchs.push({ tour, rang, a: null, b: null, gagnant: null, sequence: null, poste: null });
    }
  }

  matchs
    .filter((m) => m.tour === 1)
    .forEach((m) => {
      const x = cases[m.rang * 2] ?? null;
      const y = cases[m.rang * 2 + 1] ?? null;
      m.a = x ?? y;
      m.b = x && y ? y : null;
      if (m.b) return;
      m.gagnant = 0;
      const suivant = matchs.find((s) => s.tour === 2 && s.rang === m.rang >> 1);
      if (suivant) suivant[m.rang % 2 === 0 ? 'a' : 'b'] = m.a;
    });
  return matchs;
}

/** Un exempté : une ligne du premier tour sans adversaire, qui ne se joue pas. */
export const estExempte = (m: Pick<MatchTournoi, 'tour' | 'b'>): boolean =>
  m.tour === 1 && m.b === null;

const toursDe = (matchs: readonly Pick<MatchTournoi, 'tour'>[]) =>
  Math.max(0, ...matchs.map((m) => m.tour));

export interface SequenceTournoi<T> {
  numero: number;
  tour: number;
  surScene: boolean;
  /** Dans l'ordre des postes : le premier au poste 1. */
  matchs: T[];
}

/**
 * Les matchs à appeler ensuite, `null` si une séquence attend encore ses résultats ou si tout est
 * joué. Un tour se finit avant que le suivant commence : ses qualifiés ne sont connus qu'alors.
 */
export function prochaineSequence<T extends MatchTournoi>(
  matchs: readonly T[],
  gobelets: number,
): SequenceTournoi<T> | null {
  if (matchs.some((m) => m.sequence !== null && m.gagnant === null)) return null;
  const aJouer = matchs.filter((m) => m.gagnant === null);
  if (aJouer.length === 0) return null;

  const tour = Math.min(...aJouer.map((m) => m.tour));
  const scene = surScene(tour, toursDe(matchs));
  const appeles = aJouer
    .filter((m) => m.tour === tour)
    .sort((x, y) => x.rang - y.rang)
    .slice(0, scene ? 1 : bornerGobelets(gobelets));
  if (appeles.some((m) => !m.a || !m.b)) return null;
  return {
    numero: 1 + Math.max(0, ...matchs.map((m) => m.sequence ?? 0)),
    tour,
    surScene: scene,
    matchs: appeles,
  };
}

/** Les matchs de la dernière séquence appelée, dans l'ordre des postes. */
export function sequenceCourante<T extends MatchTournoi>(matchs: readonly T[]): T[] {
  const numero = Math.max(0, ...matchs.map((m) => m.sequence ?? 0));
  if (numero === 0) return [];
  return matchs
    .filter((m) => m.sequence === numero)
    .sort((x, y) => (x.poste ?? 0) - (y.poste ?? 0));
}

export interface ClassementTournoi {
  vainqueur: Duelliste;
  finaliste: Duelliste;
  /** Les perdants des demi-finales : aucun à deux joueurs, un seul à trois. */
  demis: Duelliste[];
}

const perdantDe = (m: MatchTournoi) => (m.gagnant === 0 ? m.b : m.gagnant === 1 ? m.a : null);

/** Le classement une fois la finale jouée, `null` avant. */
export function classementTournoi(matchs: readonly MatchTournoi[]): ClassementTournoi | null {
  const tours = toursDe(matchs);
  const finale = matchs.find((m) => m.tour === tours);
  if (!finale || finale.gagnant === null) return null;
  const vainqueur = finale.gagnant === 0 ? finale.a : finale.b;
  const finaliste = perdantDe(finale);
  if (!vainqueur || !finaliste) return null;
  const demis = matchs.filter((m) => m.tour === tours - 1).flatMap((m) => perdantDe(m) ?? []);
  return { vainqueur, finaliste, demis };
}

/** Les points de fin de tournoi, cumulés par équipe ; `null` tant que la finale n'est pas jouée. */
export function pointsTournoi(matchs: readonly MatchTournoi[]): ScoresParEquipe | null {
  const classement = classementTournoi(matchs);
  if (!classement) return null;
  const points: ScoresParEquipe = {};
  const ajouter = (j: Duelliste, n: number) => {
    points[j.equipe] = (points[j.equipe] ?? 0) + n;
  };
  ajouter(classement.vainqueur, POINTS_VAINQUEUR_TOURNOI);
  ajouter(classement.finaliste, POINTS_FINALISTE_TOURNOI);
  for (const demi of classement.demis) ajouter(demi, POINTS_DEMI_TOURNOI);
  return points;
}

/** Combien de séquences il faut pour ce nombre de joueurs et de gobelets. */
export function sequencesDuTournoi(joueurs: number, gobelets: number): number {
  const { places, tours } = dimensionsTableau(joueurs);
  const parSequence = bornerGobelets(gobelets);
  let total = 0;
  for (let tour = 1; tour <= tours; tour++) {
    const nombre = tour === 1 ? joueurs - places / 2 : places / 2 ** tour;
    total += surScene(tour, tours) ? nombre : Math.ceil(nombre / parSequence);
  }
  return total;
}

/** La durée d'un tournoi au budget de minutes, avant la part de transitions du programme. */
export function dureeTournoiS(joueurs: number, gobelets: number): number {
  return sequencesDuTournoi(joueurs, gobelets) * SEQUENCE_TOURNOI_S;
}
