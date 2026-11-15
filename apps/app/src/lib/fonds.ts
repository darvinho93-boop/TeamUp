import type { EtatSalle } from './salle';

/**
 * Les photos de fond des jeux (2026-11-15) : une par jeu du programme, déposée à la préparation,
 * montrée sur l'écran commun sous un voile beige pendant le jeu seulement (scène `jeu`).
 *
 * Le navigateur de l'animateur la recadre au milieu en 16:9 et la réduit à la taille de la scène
 * avant l'envoi : le serveur ne reçoit jamais qu'un JPEG, dont il revérifie les octets.
 */

/** La scène de référence de l'écran commun : la photo n'a pas besoin d'être plus grande. */
export const FOND_PX = { largeur: 1920, hauteur: 1080 } as const;

/** En deçà, un projecteur 1 080p devra l'agrandir de plus de moitié : elle sera floue. */
export const FOND_MIN_LARGEUR_PX = 1280;

/** Poids maximal du JPEG envoyé : celui du bucket (migration 20261117090000). */
export const TAILLE_MAX_FOND = 1024 * 1024;

/** La qualité JPEG baisse d'un cran tant que la photo dépasse le poids permis. */
export const QUALITES_FOND = [0.82, 0.7, 0.58, 0.45] as const;

/** Sous cette part de l'image gardée, on prévient : seul le milieu restera (photo en hauteur). */
const PART_GARDEE_MIN = 0.6;

export interface Cadre {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/** Le plus grand rectangle 16:9 centré dans l'image : ce que l'on garde. */
export function recadrage(largeur: number, hauteur: number): Cadre {
  if (!(largeur > 0 && hauteur > 0)) throw new RangeError('Image sans dimensions.');
  const ratio = FOND_PX.largeur / FOND_PX.hauteur;
  const l = Math.min(largeur, Math.round(hauteur * ratio));
  const h = Math.min(hauteur, Math.round(l / ratio));
  return {
    x: Math.floor((largeur - l) / 2),
    y: Math.floor((hauteur - h) / 2),
    largeur: l,
    hauteur: h,
  };
}

/** Les dimensions du JPEG gardé : le cadre ramené dans `FOND_PX`, jamais agrandi. */
export function dimensionsFond(cadre: Cadre): { largeur: number; hauteur: number } {
  const ratio = Math.min(1, FOND_PX.largeur / cadre.largeur);
  return {
    largeur: Math.max(1, Math.round(cadre.largeur * ratio)),
    hauteur: Math.max(1, Math.round(cadre.hauteur * ratio)),
  };
}

/** Une bonne partie de l'image part au recadrage (photo en hauteur, panorama). */
export function fondRecadre(largeur: number, hauteur: number): boolean {
  const cadre = recadrage(largeur, hauteur);
  return (cadre.largeur * cadre.hauteur) / (largeur * hauteur) < PART_GARDEE_MIN;
}

/** Trop petite pour l'écran : elle sera floue une fois agrandie. */
export function fondTropPetit(cadre: Cadre): boolean {
  return cadre.largeur < FOND_MIN_LARGEUR_PX;
}

/**
 * Les dimensions d'un JPEG, lues dans son marqueur de début d'image (SOF0 à SOF15, hors DHT,
 * JPG et DAC), quel que soit le type annoncé. `null` si ce n'est pas un JPEG lisible.
 */
export function dimensionsJpeg(octets: Uint8Array): { largeur: number; hauteur: number } | null {
  if (octets.length < 4 || octets[0] !== 0xff || octets[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < octets.length) {
    if (octets[i] !== 0xff) return null;
    const marqueur = octets[i + 1]!;
    // Remplissage : plusieurs FF de suite avant un marqueur.
    if (marqueur === 0xff) {
      i += 1;
      continue;
    }
    const longueur = (octets[i + 2]! << 8) | octets[i + 3]!;
    const debutImage =
      marqueur >= 0xc0 && marqueur <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marqueur);
    if (debutImage) {
      const hauteur = (octets[i + 5]! << 8) | octets[i + 6]!;
      const largeur = (octets[i + 7]! << 8) | octets[i + 8]!;
      return largeur > 0 && hauteur > 0 ? { largeur, hauteur } : null;
    }
    // Début des données compressées sans en-tête d'image : illisible.
    if (marqueur === 0xda || longueur < 2) return null;
    i += 2 + longueur;
  }
  return null;
}

/** Un JPEG que le serveur accepte : le bon format, dans les dimensions et le poids prévus. */
export function fondAcceptable(octets: Uint8Array): boolean {
  if (octets.length === 0 || octets.length > TAILLE_MAX_FOND) return false;
  const dimensions = dimensionsJpeg(octets);
  return (
    dimensions !== null &&
    dimensions.largeur <= FOND_PX.largeur &&
    dimensions.hauteur <= FOND_PX.hauteur
  );
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const CHEMIN = new RegExp(`^${UUID}/${UUID}\\.jpg$`);

/** Le chemin d'un nouveau dépôt : un fichier neuf à chaque fois, sous le dossier de la soirée. */
export function cheminFond(evenementId: string, depotId: string): string {
  return `${evenementId}/${depotId}.jpg`;
}

/** Un chemin de la forme posée par la base ; tout le reste est ignoré. */
export function estCheminFond(chemin: unknown): chemin is string {
  return typeof chemin === 'string' && CHEMIN.test(chemin);
}

/** Les photos de fond de la soirée, par manche : ce que l'écran télécharge d'avance. */
export function fondsDuProgramme(etat: EtatSalle): string[] {
  return [...new Set(etat.programme.flatMap((m) => (estCheminFond(m.fond) ? [m.fond] : [])))];
}

/**
 * La photo à montrer maintenant : celle du jeu en cours, pendant le jeu seulement (scène `jeu`).
 * Présentation, explication, scores et autres scènes restent beiges (choix du 2026-11-15).
 */
export function fondDeLaScene(etat: EtatSalle): string | null {
  const { scene, manche_id: mancheId } = etat.pilotage;
  if (scene !== 'jeu' || !mancheId) return null;
  const fond = etat.programme.find((m) => m.id === mancheId)?.fond;
  return estCheminFond(fond) ? fond : null;
}
