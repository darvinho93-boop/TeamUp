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

/**
 * La scène « Équipes » : jusqu'à trois équipes, une seule rangée de cartes hautes ; au-delà,
 * deux rangées (2 × 2, puis 3 × 2). Les prénoms d'une carte tiennent sur deux colonnes, de 13
 * ou de 5 rangs (`--tu-stage-membres-rangs*`) : la scène 16:9 n'en loge pas plus sans déborder.
 */
export function grilleDesEquipes(equipes: number): { colonnes: number; parPage: number } {
  if (equipes <= 3) return { colonnes: Math.max(1, equipes), parPage: 26 };
  return { colonnes: equipes === 4 ? 2 : 3, parPage: 10 };
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
