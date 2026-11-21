/**
 * L'arbre du tournoi à l'écran commun (2026-11-21), calculé sans DOM : les deux moitiés du tableau
 * convergent vers la coupe, au centre. Les positions sont des fractions de la scène.
 *
 * Seuls les prénoms du tour en cours sont écrits, à intervalles réguliers, sur deux colonnes en
 * quinconce au-delà de seize par moitié (le trait d'une colonne passe entre deux prénoms de
 * l'autre). Les tours passés ne sont plus que le chemin : un point par joueur au départ, et le
 * trait de chaque joueur encore en lice à la couleur de son équipe.
 */

import { surScene, type Duelliste } from '@teamup/game';
import type { MatchSalle } from './tournoi';

/** Le nombre de prénoms qu'une moitié de scène loge sur une seule colonne. */
const PRENOMS_PAR_COLONNE = 16;
/** La part de la scène laissée au titre et à la coupe. */
const LARGEUR_CENTRE = 0.15;
/** Où les traits de la finale s'arrêtent, juste avant la coupe. */
const BORD_COUPE = 0.46;
const PRENOM_QUINCONCE = 0.092;
const PRENOM_SEUL = 0.17;
/** Le chemin d'un tour passé : une colonne étroite, après le retrait des points de départ. */
const DEPART_CHEMIN = 0.006;
const PAS_CHEMIN = 0.036;
/** La colonne du tour en cours porte les postes : elle est plus large que celles à venir. */
const POIDS_TOUR_EN_COURS = 1.6;
/** La part de sa rangée où un prénom déploie les points de départ de son chemin. */
const PART_BANDE = 0.8;
const BANDE_FINALE = 0.92;
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
  /** L'équipe du joueur encore en lice passé par ce trait, sinon `null`. */
  equipe: number | null;
  active: boolean;
  /** Un trait d'un tour déjà joué : il n'est plus que le chemin. */
  passe: boolean;
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
  /** Le tour dont les prénoms sont écrits. */
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

/**
 * Ce qui change la largeur des prénoms écrits : leur texte et leur état, car un gagnant passe en
 * gras. Quand cette clé change, l'écran réajuste leur taille.
 */
export const signaturePrenoms = (places: readonly PlaceArbre[]): string =>
  places
    .filter((p) => !p.pastille)
    .map((p) => `${p.cle}:${p.joueur?.prenom ?? ''}:${p.etat}`)
    .join();

/**
 * `tourEnCours` est celui de la séquence lancée : ses prénoms restent écrits jusqu'à ce que la régie
 * lance le tour suivant. Sans séquence, c'est le premier tour qui a encore un match à jouer.
 */
export function dispositionArbre(
  matchs: readonly MatchSalle[],
  sequence: number | null,
  tourEnCours: number | null = null,
): DispositionArbre {
  const tours = Math.max(1, ...matchs.map((m) => m.tour));
  const aJouer = matchs.filter((m) => m.gagnant === null);
  const tourVisible =
    tourEnCours ?? (aJouer.length > 0 ? Math.min(...aJouer.map((m) => m.tour)) : tours);
  const tries = [...matchs].sort((x, y) => x.tour - y.tour || x.rang - y.rang);
  const parCle = new Map(tries.map((m) => [`${m.tour}-${m.rang}`, m]));
  const matchsDuTour = (t: number) => 2 ** (tours - t);
  const moitieDe = (m: MatchSalle, cote: 0 | 1): Cote =>
    m.tour === tours ? (cote === 0 ? 'g' : 'd') : m.rang < matchsDuTour(m.tour) / 2 ? 'g' : 'd';
  const estAppele = (m: MatchSalle | undefined) =>
    sequence !== null && m?.sequence === sequence && m.gagnant === null;

  // Le parcours de chaque joueur : son chemin perd sa couleur quand il sort, à n'importe quel tour.
  const vainqueurs = new Set<string>();
  const elimines = new Set<string>();
  const enJeu = new Set<string>();
  for (const m of tries) {
    if (estAppele(m)) for (const j of [m.a, m.b]) if (j) enJeu.add(cleJoueur(j));
    if (!m.a || !m.b || m.gagnant === null) continue;
    vainqueurs.add(cleJoueur(m.gagnant === 0 ? m.a : m.b));
    elimines.add(cleJoueur(m.gagnant === 0 ? m.b : m.a));
  }
  const enLice = (j: Duelliste | null): j is Duelliste => !!j && !elimines.has(cleJoueur(j));

  // Une rangée par prénom du tour en cours ; au premier tour, un exempté n'en prend qu'une.
  const rangees: Record<Cote, string[]> = { g: [], d: [] };
  for (const m of tries) {
    if (m.tour !== tourVisible) continue;
    rangees[moitieDe(m, 0)].push(`${m.rang}-0`);
    if (m.tour > 1 || m.b) rangees[moitieDe(m, 1)].push(`${m.rang}-1`);
  }
  const rangeesMax = Math.max(rangees.g.length, rangees.d.length);
  const quinconce = rangeesMax > PRENOMS_PAR_COLONNE;
  const courantes = new Map<string, { y: number; interieur: boolean }>();
  for (const liste of [rangees.g, rangees.d]) {
    liste.forEach((cle, i) =>
      courantes.set(cle, { y: (i + 1) / (liste.length + 1), interieur: quinconce && i % 2 === 1 }),
    );
  }

  // Les points de départ : ceux du chemin de chaque prénom, resserrés dans sa rangée.
  const yDepart = new Map<string, number>();
  let pasDepart = 1 / (rangeesMax + 1);
  if (tourVisible === 1) {
    for (const [cle, place] of courantes) yDepart.set(cle, place.y);
  } else {
    const nombre = 2 ** (tourVisible - 2);
    const chemins = [...courantes].map(([cle, place]) => {
      const [rang, cote] = cle.split('-').map(Number) as [number, number];
      const premier = (2 * rang + cote) * nombre;
      const departs: string[] = [];
      for (let r = premier; r < premier + nombre; r++) {
        departs.push(`${r}-0`);
        if (parCle.get(`1-${r}`)?.b) departs.push(`${r}-1`);
      }
      return { y: place.y, departs };
    });
    // Seul dans sa moitié, le finaliste déploie son chemin sur toute la hauteur.
    const bande = rangeesMax === 1 ? BANDE_FINALE : PART_BANDE / (rangeesMax + 1);
    pasDepart = bande / Math.max(1, ...chemins.map((c) => c.departs.length));
    for (const { y, departs } of chemins) {
      departs.forEach((cle, k) => yDepart.set(cle, y + (k - (departs.length - 1) / 2) * pasDepart));
    }
  }

  // Un match est à mi-hauteur de ses joueurs ; les deux demi-finales arrivent sur la coupe.
  const yMatch = new Map<string, number>();
  const yPlace = (m: MatchSalle, cote: 0 | 1) =>
    (m.tour === 1
      ? yDepart.get(`${m.rang}-${cote}`)
      : yMatch.get(`${m.tour - 1}-${2 * m.rang + cote}`)) ?? 0.5;
  for (const m of tries) {
    if (m.tour === tours) continue;
    const milieu =
      m.tour === tourVisible - 1
        ? (courantes.get(`${m.rang >> 1}-${m.rang % 2}`)?.y ?? 0.5)
        : m.tour === tours - 1
          ? 0.5
          : m.tour === 1 && !m.b
            ? yPlace(m, 0)
            : (yPlace(m, 0) + yPlace(m, 1)) / 2;
    yMatch.set(`${m.tour}-${m.rang}`, milieu);
  }

  const rangsPrenom = Math.max(RANGS_MIN, quinconce ? (rangeesMax + 1) / 2 : rangeesMax + 1);
  const rangsPoste = Math.max(RANGS_MIN, (rangeesMax + 1) / 2);
  const rangsPoint = Math.max(RANGS_MIN, tourVisible > 1 ? 1 / pasDepart : rangeesMax + 1);

  // Les colonnes, du bord de la scène vers le centre : le chemin, les prénoms, les tours à venir.
  const debutNoms = tourVisible > 1 ? DEPART_CHEMIN + (tourVisible - 1) * PAS_CHEMIN : 0;
  const largeurNom = quinconce ? PRENOM_QUINCONCE : PRENOM_SEUL;
  const finNoms = debutNoms + (quinconce ? 2 : 1) * largeurNom;
  const zoneAVenir = (1 - LARGEUR_CENTRE) / 2 - finNoms;
  const poidsDu = (t: number) => (t === tourVisible ? POIDS_TOUR_EN_COURS : 1);
  let somme = 0;
  for (let t = tourVisible; t <= tours; t++) somme += poidsDu(t);
  const colonnes = new Map<number, { debut: number; largeur: number }>();
  for (let t = 1; t < tourVisible; t++) {
    colonnes.set(t, { debut: DEPART_CHEMIN + (t - 1) * PAS_CHEMIN, largeur: PAS_CHEMIN });
  }
  let cumul = 0;
  for (let t = tourVisible; t <= tours; t++) {
    colonnes.set(t, {
      debut: finNoms + (cumul / somme) * zoneAVenir,
      largeur: (poidsDu(t) / somme) * zoneAVenir,
    });
    cumul += poidsDu(t);
  }
  const X = (cote: Cote, f: number) => arrondi((cote === 'g' ? f : 1 - f) * VUE);
  const Y = (y: number) => arrondi(y * VUE);

  const places: PlaceArbre[] = [];
  const lignes: LigneArbre[] = [];
  const postes: PosteArbre[] = [];

  /** Pose le joueur à sa place, s'il y en a une à montrer, et rend le bord d'où part son trait. */
  const poser = (m: MatchSalle, cote: 0 | 1): number => {
    const joueur = cote === 0 ? m.a : m.b;
    const moitie = moitieDe(m, cote);
    const { debut } = colonnes.get(m.tour)!;
    const cle = joueur ? cleJoueur(joueur) : '';
    // Au premier tour, l'état dit où en est le joueur : un exempté n'a encore rien gagné.
    const etat: EtatPlace =
      m.tour > 1
        ? etatDe(m, cote)
        : elimines.has(cle)
          ? 'perdu'
          : vainqueurs.has(cle)
            ? 'gagne'
            : 'attente';
    const commun = {
      cle: `${m.tour}-${m.rang}-${cote}`,
      joueur,
      etat,
      cote: moitie,
      tour: m.tour,
      y: yPlace(m, cote),
    };
    if (m.tour === tourVisible) {
      const gauche = debutNoms + (courantes.get(`${m.rang}-${cote}`)?.interieur ? largeurNom : 0);
      places.push({
        ...commun,
        x: moitie === 'g' ? gauche : 1 - gauche - largeurNom,
        largeur: largeurNom,
        rangs: rangsPrenom,
        pastille: false,
        actif: enJeu.has(cle),
      });
      return gauche + largeurNom;
    }
    // Un point : au départ du chemin, ou là où un qualifié attend déjà son prochain match.
    if (joueur && (m.tour === 1 || m.tour > tourVisible)) {
      places.push({
        ...commun,
        x: moitie === 'g' ? debut : 1 - debut,
        largeur: 0,
        rangs: m.tour === 1 ? rangsPoint : Math.max(RANGS_MIN, rangeesMax + 1),
        pastille: true,
        actif: false,
      });
    }
    return debut;
  };

  for (const m of tries) {
    const { debut, largeur } = colonnes.get(m.tour)!;
    const actif = estAppele(m);
    const passe = m.tour < tourVisible;
    const equipeDe = (cote: 0 | 1) => {
      const joueur = cote === 0 ? m.a : m.b;
      return m.gagnant === cote && enLice(joueur) ? joueur.equipe : null;
    };

    if (m.tour === tours) {
      for (const cote of [0, 1] as const) {
        const moitie = moitieDe(m, cote);
        const bord = poser(m, cote);
        lignes.push({
          cle: `${m.tour}-${m.rang}-${cote}`,
          d: `M${X(moitie, bord)},${Y(0.5)}H${X(moitie, BORD_COUPE)}`,
          equipe: equipeDe(cote),
          active: actif,
          passe: false,
        });
      }
      continue;
    }

    const moitie = moitieDe(m, 0);
    const milieu = yMatch.get(`${m.tour}-${m.rang}`)!;
    const axe = debut + largeur / 2;
    const exempte = m.tour === 1 && !m.b;
    // Un exempté n'a rien joué au premier tour : son chemin s'allume une fois ce tour passé.
    const equipeExempte = tourVisible > 1 && enLice(m.a) ? m.a.equipe : null;
    const brancheActive = actif || (exempte && estAppele(parCle.get(`2-${m.rang >> 1}`)));

    const relier = (cote: 0 | 1, suffixe: 'a' | 'b') => {
      const bord = poser(m, cote);
      lignes.push({
        cle: `${m.tour}-${m.rang}-${suffixe}`,
        d: `M${X(moitie, bord)},${Y(yPlace(m, cote))}H${X(moitie, axe)}V${Y(milieu)}`,
        equipe: exempte ? equipeExempte : equipeDe(cote),
        active: brancheActive,
        passe,
      });
    };
    relier(0, 'a');
    if (!exempte) relier(1, 'b');

    // Le trait du dernier tour passé va jusqu'au prénom, à travers l'autre colonne s'il le faut.
    const cible = courantes.get(`${m.rang >> 1}-${m.rang % 2}`);
    const fin =
      m.tour === tourVisible - 1
        ? debutNoms + (cible?.interieur ? largeurNom : 0)
        : debut + largeur;
    const gagnant = m.gagnant === 0 ? m.a : m.gagnant === 1 ? m.b : null;
    lignes.push({
      cle: `${m.tour}-${m.rang}-t`,
      d: `M${X(moitie, axe)},${Y(milieu)}H${X(moitie, fin)}`,
      equipe: exempte ? equipeExempte : enLice(gagnant) ? gagnant.equipe : null,
      active: brancheActive,
      passe,
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
        rangs: rangsPoste,
        juge: m.gagnant !== null,
      });
    }
  }

  const finale = matchs.find((m) => m.tour === tours);
  const champion =
    finale?.gagnant === 0 ? finale.a : finale?.gagnant === 1 ? (finale.b ?? null) : null;
  return { places, lignes, postes, tourVisible, champion: champion ?? null };
}
