/**
 * Membres d'une équipe, tels que l'écran commun et la régie les montrent : capitaine en tête,
 * puis ordre alphabétique. Quand ils sont trop nombreux pour l'écran, ils passent par pages.
 */

export interface Membre {
  prenom: string;
  capitaine: boolean;
}

/** Durée d'affichage d'une page de prénoms à l'écran commun. */
export const DUREE_PAGE_MS = 5000;

const collation = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
const comparer = (a: string, b: string) => collation.compare(a, b);

/** Capitaine en tête, puis ordre alphabétique : le même rangement à l'écran et à la régie. */
export function trierMembres<T extends Membre>(membres: readonly T[]): T[] {
  return [...membres].sort(
    (a, b) => Number(b.capitaine) - Number(a.capitaine) || comparer(a.prenom, b.prenom),
  );
}

/**
 * `capitaine` est son prénom, ou rien : la clé manque tant que la base n'a pas la migration
 * du 2026-10-09, et l'équipe s'affiche alors sans capitaine.
 */
export function membresTries(prenoms: readonly string[], capitaine?: string | null): Membre[] {
  const autres = [...prenoms];
  const rang = capitaine ? autres.indexOf(capitaine) : -1;
  if (rang >= 0) autres.splice(rang, 1);
  const membres = autres.sort(comparer).map((prenom) => ({ prenom, capitaine: false }));
  return rang >= 0 && capitaine ? [{ prenom: capitaine, capitaine: true }, ...membres] : membres;
}

/** Comment l'écran montre les membres : tous d'un coup (police ajustée), ou par pages. */
export type ModeMembres = 'tous' | 'carrousel';

/**
 * La scène « Équipes » : jusqu'à trois équipes, une seule rangée de cartes hautes ; au-delà,
 * deux rangées (2 × 2, 3 × 2, puis 4 × 2). Les huit équipes possibles tiennent donc toujours
 * dans la scène.
 */
export function grilleDesEquipes(equipes: number): { colonnes: number; rangees: 1 | 2 } {
  if (equipes <= 3) return { colonnes: Math.max(1, equipes), rangees: 1 };
  return { colonnes: Math.ceil(equipes / 2), rangees: 2 };
}

/** Rangs d'une carte en mode « tous » : en dessous, les prénoms grandiraient sans fin. */
const RANGS_MIN = 5;

/** Colonnes de prénoms qu'une carte loge au plus, selon le nombre de cartes par rangée. */
const COLONNES_DE_PRENOMS: Record<number, number> = { 1: 4, 2: 3, 3: 2, 4: 2 };

/**
 * Les prénoms d'une carte.
 * - « carrousel » : des pages de 13 rangs (une rangée de cartes) ou de 5 (deux), sur deux
 *   colonnes, en 2 rem ; la scène 16:9 n'en loge pas plus à cette taille.
 * - « tous » : jusqu'à 40 prénoms par carte sur une rangée, 20 sur deux, d'un coup ; au-delà,
 *   des pages équilibrées. Une carte large prend plus de colonnes, une équipe réduite une
 *   seule. Les rangs suivent la plus grande équipe, pour que toutes les cartes aient la même
 *   taille de texte ; la police remplit le rang, bornée par la largeur d'une colonne et par
 *   un plafond (`--tu-stage-membre-*`).
 */
export function dispositionDesMembres(
  grille: { colonnes: number; rangees: 1 | 2 },
  plusGrandeEquipe: number,
  mode: ModeMembres,
): { parPage: number; rangs: number; colonnes: number; ajuste: boolean } {
  if (mode === 'carrousel') {
    const rangs = grille.rangees === 1 ? 13 : 5;
    return { parPage: rangs * 2, rangs, colonnes: 2, ajuste: false };
  }
  const parPage = grille.rangees === 1 ? 40 : 20;
  // La plus grande page réellement montrée : `pagesDe` équilibre les pages.
  const pages = Math.max(1, Math.ceil(plusGrandeEquipe / parPage));
  const page = Math.ceil(plusGrandeEquipe / pages);
  const colonnes = Math.max(
    1,
    Math.min(COLONNES_DE_PRENOMS[grille.colonnes] ?? 2, Math.ceil(page / RANGS_MIN)),
  );
  const rangs = Math.max(RANGS_MIN, Math.ceil(page / colonnes));
  return { parPage, rangs, colonnes, ajuste: true };
}

/** Des pages de taille voisine : pas de dernière page réduite à un seul prénom. */
export function pagesDe<T>(elements: readonly T[], parPage: number): T[][] {
  const nombre = Math.ceil(elements.length / parPage);
  const taille = Math.ceil(elements.length / Math.max(1, nombre));
  const pages: T[][] = [];
  for (let i = 0; i < elements.length; i += taille) pages.push(elements.slice(i, i + taille));
  return pages;
}

/**
 * La page à montrer à cet instant. Elle se déduit de l'heure de la base : deux écrans montrent
 * la même, un rechargement retombe au même endroit, et toutes les cartes tournent ensemble.
 */
export function pageA(maintenantMs: number, pages: number, dureeMs = DUREE_PAGE_MS): number {
  return pages <= 1 ? 0 : Math.floor(Math.max(0, maintenantMs) / dureeMs) % pages;
}

const sansAccent = (texte: string) =>
  texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/** Recherche d'un invité par son prénom, sans tenir compte des accents ni de la casse. */
export function correspond(prenom: string, recherche: string): boolean {
  return sansAccent(prenom).includes(sansAccent(recherche));
}
