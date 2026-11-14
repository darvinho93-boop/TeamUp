/**
 * Le logo du partenaire d'une soirée (2026-11-11) : déposé à la préparation, montré en haut à
 * gauche de l'écran commun, dans la même boîte que la marque Team Up! en haut à droite.
 *
 * Le navigateur de l'animateur rogne les marges vides du fichier, le réduit et le convertit en
 * PNG avant l'envoi : deux logos exportés avec des marges différentes sortent à la même taille,
 * et le serveur ne reçoit jamais que du PNG, dont il revérifie les octets.
 */

/**
 * La boîte du logo sur la scène de référence (1 920 × 1 080) : la largeur de la marque Team Up!
 * (`--tu-stage-marque`, 21 rem) sur la hauteur de son pictogramme (`--tu-picto-coin`, 5,5 rem).
 */
export const BOITE_LOGO_PX = { largeur: 336, hauteur: 88 } as const;

/** Le fichier gardé fait au plus quatre fois la boîte : net sur un projecteur 4K. */
export const LOGO_MAX_PX = {
  largeur: BOITE_LOGO_PX.largeur * 4,
  hauteur: BOITE_LOGO_PX.hauteur * 4,
} as const;

/** Poids maximal du PNG envoyé : celui du bucket (migration 20261111090000). */
export const TAILLE_MAX_LOGO = 512 * 1024;

/** En deçà, un pixel compte pour vide : les bavures d'un export ne font pas une marge. */
export const SEUIL_VISIBLE = 8;
/** Au-delà, un pixel compte pour plein. */
const SEUIL_PLEIN = 250;

export interface Cadre {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

type Pixels = Uint8ClampedArray | Uint8Array;

const alpha = (rgba: Pixels, largeur: number, x: number, y: number) =>
  rgba[(y * largeur + x) * 4 + 3] ?? 0;

/**
 * La boîte des pixels visibles d'une image RGBA : ce que l'on garde du fichier. `null` si
 * l'image est entièrement transparente.
 */
export function cadreUtile(
  rgba: Pixels,
  largeur: number,
  hauteur: number,
  seuil: number = SEUIL_VISIBLE,
): Cadre | null {
  let haut = -1;
  let bas = -1;
  let gauche = largeur;
  let droite = -1;
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      if (alpha(rgba, largeur, x, y) < seuil) continue;
      if (haut < 0) haut = y;
      bas = y;
      if (x < gauche) gauche = x;
      if (x > droite) droite = x;
    }
  }
  if (haut < 0) return null;
  return { x: gauche, y: haut, largeur: droite - gauche + 1, hauteur: bas - haut + 1 };
}

/**
 * Le logo a un fond : les quatre coins de son cadre sont pleins. À l'écran, il paraîtra dans un
 * rectangle au lieu de se poser sur le beige.
 */
export function aUnFond(rgba: Pixels, largeur: number, cadre: Cadre): boolean {
  const droite = cadre.x + cadre.largeur - 1;
  const bas = cadre.y + cadre.hauteur - 1;
  return [
    [cadre.x, cadre.y],
    [droite, cadre.y],
    [cadre.x, bas],
    [droite, bas],
  ].every(([x, y]) => alpha(rgba, largeur, x!, y!) >= SEUIL_PLEIN);
}

/** Les dimensions du PNG gardé : le cadre ramené dans `LOGO_MAX_PX`, jamais agrandi. */
export function dimensionsLogo(
  largeur: number,
  hauteur: number,
  max: { largeur: number; hauteur: number } = LOGO_MAX_PX,
): { largeur: number; hauteur: number } {
  if (!(largeur > 0 && hauteur > 0)) throw new RangeError('Image sans dimensions.');
  const ratio = Math.min(1, max.largeur / largeur, max.hauteur / hauteur);
  return {
    largeur: Math.max(1, Math.round(largeur * ratio)),
    hauteur: Math.max(1, Math.round(hauteur * ratio)),
  };
}

/**
 * Le logo est plus petit que sa boîte à l'écran : un projecteur 1 080p devra l'agrandir, il
 * risque d'être flou.
 */
export function logoTropPetit(largeur: number, hauteur: number): boolean {
  return largeur < BOITE_LOGO_PX.largeur && hauteur < BOITE_LOGO_PX.hauteur;
}

const SIGNATURE_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const IHDR = [0x49, 0x48, 0x44, 0x52] as const;

/**
 * Les dimensions d'un PNG, lues dans son en-tête (signature, puis le bloc IHDR), quel que soit
 * le type annoncé par le navigateur. `null` si ce n'est pas un PNG.
 */
export function dimensionsPng(octets: Uint8Array): { largeur: number; hauteur: number } | null {
  if (octets.length < 24) return null;
  if (SIGNATURE_PNG.some((o, i) => octets[i] !== o)) return null;
  if (IHDR.some((o, i) => octets[12 + i] !== o)) return null;
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  const largeur = vue.getUint32(16);
  const hauteur = vue.getUint32(20);
  return largeur > 0 && hauteur > 0 ? { largeur, hauteur } : null;
}

/** Un PNG que le serveur accepte : le bon format, dans les dimensions et le poids prévus. */
export function logoAcceptable(octets: Uint8Array): boolean {
  if (octets.length === 0 || octets.length > TAILLE_MAX_LOGO) return false;
  const dimensions = dimensionsPng(octets);
  return (
    dimensions !== null &&
    dimensions.largeur <= LOGO_MAX_PX.largeur &&
    dimensions.hauteur <= LOGO_MAX_PX.hauteur
  );
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const CHEMIN = new RegExp(`^${UUID}/${UUID}\\.png$`);

/** Le chemin d'un nouveau dépôt : un fichier neuf à chaque fois, sous le dossier de la soirée. */
export function cheminLogo(evenementId: string, depotId: string): string {
  return `${evenementId}/${depotId}.png`;
}

/**
 * L'adresse publique du logo (bucket public « logos »), ou `null` sans logo. Un chemin d'une
 * autre forme que celle de la base est ignoré : rien d'autre ne se glisse dans l'adresse.
 */
export function urlLogo(
  chemin: string | null | undefined,
  base: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string | null {
  if (!chemin || !base || !CHEMIN.test(chemin)) return null;
  return `${base.replace(/\/+$/, '')}/storage/v1/object/public/logos/${chemin}`;
}
