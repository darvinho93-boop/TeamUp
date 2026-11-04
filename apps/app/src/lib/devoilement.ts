import { aleaDepuis, DUREE_TIRAGE_S } from '@teamup/game';

/**
 * Le dévoilement des équipes à l'écran commun (2026-11-04) : sur le roulement de tambour, les
 * cartes paraissent vides, les prénoms tourbillonnent au centre, puis chacun file vers sa carte,
 * un par équipe à tour de rôle ; la cymbale tombe quand tout est posé. Logique pure, testée ;
 * le mouvement est dans `src/ecran/Devoilement.tsx`.
 */

/** Le temps du roulement : 5 s de caisse claire, puis la cymbale (comme le tirage de l'ordre). */
export const DUREE_DEVOILEMENT_MS = DUREE_TIRAGE_S * 1000;
/** Les cartes vides paraissent d'abord ; les prénoms entrent ensuite dans le tourbillon… */
export const TOURBILLON_DEBUT_MS = 500;
/** … en ce temps-là… */
export const TOURBILLON_ENTREE_MS = 600;
/** … puis le premier part vers sa carte… */
export const DEPARTS_DEBUT_MS = 2400;
/** … et le dernier à cet instant… */
export const DEPARTS_FIN_MS = 4000;
/** … pour un vol de cette durée : le dernier se pose à 4,6 s, avant la cymbale. */
export const VOL_MS = 600;
/** Un tour du tourbillon, au plus loin du centre ; plus près, il tourne plus vite. */
export const TOUR_MS = 2200;
/** Un prénom du tourbillon, par rapport à sa taille dans la carte. */
export const ECHELLE_TOURBILLON = 0.75;

/** Un prénom à poser : son équipe (rang dans la grille) et sa place dans la carte. */
export interface Depart {
  equipe: number;
  rang: number;
}

/**
 * L'ordre des départs : un prénom par équipe à tour de rôle (le premier de chaque équipe, puis le
 * deuxième…), pour que toutes les cartes se remplissent ensemble.
 */
export function ordreDesDeparts(effectifs: readonly number[]): Depart[] {
  const ordre: Depart[] = [];
  const plusGrande = Math.max(0, ...effectifs);
  for (let rang = 0; rang < plusGrande; rang++) {
    effectifs.forEach((n, equipe) => {
      if (rang < n) ordre.push({ equipe, rang });
    });
  }
  return ordre;
}

/** L'instant de départ du k-ième prénom sur `total`, en ms depuis le début du dévoilement. */
export function departDu(k: number, total: number): number {
  if (total <= 1) return DEPARTS_DEBUT_MS;
  return DEPARTS_DEBUT_MS + (k * (DEPARTS_FIN_MS - DEPARTS_DEBUT_MS)) / (total - 1);
}

/** La place d'un prénom dans le tourbillon : son angle au départ, sa distance au centre (0 à 1). */
export interface PlaceTourbillon {
  angle: number;
  rayon: number;
}

/**
 * Les places du tourbillon, tirées de la graine (l'événement et l'instant du dévoilement) : deux
 * écrans, ou un écran rechargé, tirent les mêmes. Répartition uniforme sur le disque, en évitant
 * le cœur, où les prénoms s'entasseraient.
 */
export function placesDuTourbillon(total: number, graine: string): PlaceTourbillon[] {
  const alea = aleaDepuis(graine);
  return Array.from({ length: total }, () => ({
    angle: alea() * 2 * Math.PI,
    rayon: 0.25 + 0.75 * Math.sqrt(alea()),
  }));
}

/** Où est un prénom du tourbillon à l'instant t : entre -1 et 1 sur chaque axe. */
export function dansLeTourbillon(place: PlaceTourbillon, t: number): { x: number; y: number } {
  const vitesse = ((2 * Math.PI) / TOUR_MS) * (1.6 - 0.6 * place.rayon);
  const angle = place.angle + vitesse * t;
  return { x: place.rayon * Math.cos(angle), y: place.rayon * Math.sin(angle) };
}

/** L'avancée d'un vol, adoucie à l'arrivée : 0 avant le départ, 1 une fois posé. */
export function avanceeDuVol(t: number, depart: number): number {
  const p = Math.min(1, Math.max(0, (t - depart) / VOL_MS));
  return 1 - (1 - p) ** 3;
}

/** Le centre et les demi-axes du tourbillon, et l'arrivée d'un prénom, en px de la scène. */
export interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface EtatDuPrenom {
  /** Le centre du prénom. */
  x: number;
  y: number;
  echelle: number;
  opacite: number;
}

/** Un prénom à l'instant t : dans le tourbillon, en vol, ou posé à son arrivée. */
export function etatDuPrenom(
  t: number,
  place: PlaceTourbillon,
  depart: number,
  arrivee: { x: number; y: number },
  tourbillon: Ellipse,
): EtatDuPrenom {
  const point = (instant: number) => {
    const p = dansLeTourbillon(place, instant);
    return { x: tourbillon.cx + tourbillon.rx * p.x, y: tourbillon.cy + tourbillon.ry * p.y };
  };
  const entree = Math.min(1, Math.max(0, (t - TOURBILLON_DEBUT_MS) / TOURBILLON_ENTREE_MS));
  if (t < depart) return { ...point(t), echelle: ECHELLE_TOURBILLON, opacite: entree };
  const a = avanceeDuVol(t, depart);
  const parti = point(depart);
  return {
    x: parti.x + (arrivee.x - parti.x) * a,
    y: parti.y + (arrivee.y - parti.y) * a,
    echelle: ECHELLE_TOURBILLON + (1 - ECHELLE_TOURBILLON) * a,
    opacite: 1,
  };
}
