import { aleaDepuis, DUREE_TIRAGE_S } from '@teamup/game';

/**
 * Le dévoilement des équipes à l'écran commun (2026-11-04), en machine à sous : sur le roulement
 * de tambour, chaque carte d'équipe fait tourner des rouleaux de prénoms ; les cartes s'arrêtent
 * l'une après l'autre (un « tic » à chaque arrêt), leurs vrais membres tombent un à un et leur
 * compteur monte ; la cymbale tombe quand tout est posé. Logique pure, testée ; l'image est dans
 * `src/ecran/Scenes.tsx` et `stage.css`.
 */

/** Le temps du roulement : 5 s de caisse claire, puis la cymbale (comme le tirage de l'ordre). */
export const DUREE_DEVOILEMENT_MS = DUREE_TIRAGE_S * 1000;
/** La première carte s'arrête à cet instant… */
export const PREMIER_ARRET_MS = 2200;
/** … la dernière à celui-ci… */
export const DERNIER_ARRET_MS = 4200;
/** … et ses prénoms tombent en ce temps au plus : tout est posé avant la cymbale. */
export const CASCADE_MAX_MS = 600;
/** L'écart entre deux prénoms qui tombent, pour une petite équipe. */
export const PAS_CASCADE_MAX_MS = 70;
/**
 * La grille quitte le mode « machine » à cet instant : la dernière chute (700 ms) et le dernier
 * flash de carte sont finis, rien ne saute. La fête, elle, part à la cymbale.
 */
export const FIN_DEVOILEMENT_MS = DUREE_DEVOILEMENT_MS + 1000;
/** Une seule équipe : elle s'arrête au milieu du roulement. */
const ARRET_SEUL_MS = 3000;

/** L'instant où la carte de rang `k` (sur `total`, dans l'ordre de la grille) s'arrête. */
export function arretDe(k: number, total: number): number {
  if (total <= 1) return ARRET_SEUL_MS;
  return PREMIER_ARRET_MS + (k * (DERNIER_ARRET_MS - PREMIER_ARRET_MS)) / (total - 1);
}

/** L'écart entre deux prénoms d'une carte de `n` prénoms : la cascade tient en 600 ms. */
export function pasDeCascade(n: number): number {
  return Math.min(PAS_CASCADE_MAX_MS, CASCADE_MAX_MS / Math.max(1, n));
}

/** L'instant où tombe le prénom de rang `i` d'une carte de `n` prénoms qui s'arrête à `arret`. */
export function chuteDe(arret: number, i: number, n: number): number {
  return arret + i * pasDeCascade(n);
}

/**
 * Le compteur d'une carte à l'instant t : il suit les prénoms tombés, de 0 jusqu'à l'effectif
 * (une carte peut n'en montrer qu'une page : le compteur arrive quand même au total).
 */
export function compteA(t: number, arret: number, affiches: number, effectif: number): number {
  if (t < arret) return 0;
  if (affiches === 0) return effectif;
  const tombes = Math.min(affiches, Math.floor((t - arret) / pasDeCascade(affiches)) + 1);
  return Math.round((tombes * effectif) / affiches);
}

/**
 * La bande d'un rouleau : des prénoms de la salle tirés au hasard (graine : l'événement, l'instant
 * du dévoilement, la carte et la colonne), pour que deux écrans tournent pareil.
 */
export function bandeDuRouleau(
  prenoms: readonly string[],
  graine: string,
  longueur: number,
): string[] {
  if (prenoms.length === 0) return [];
  const alea = aleaDepuis(graine);
  return Array.from({ length: longueur }, () => prenoms[Math.floor(alea() * prenoms.length)]!);
}
