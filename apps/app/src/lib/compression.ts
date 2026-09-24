/**
 * Compression d'une photo sur le téléphone, avant la file d'attente : l'original d'un téléphone
 * récent pèse 3 à 8 Mo, la version envoyée moins d'1 Mo. Plus léger à stocker hors ligne,
 * plus rapide à faire partir sur le réseau d'une salle des fêtes.
 */

import { TAILLE_MAX_PHOTO } from './partie';

/** Plus grand côté de la photo envoyée : assez pour l'écran projeté, en plein cadre. */
export const COTE_MAX_PX = 1600;
export const QUALITES_JPEG = [0.8, 0.65, 0.5] as const;

/** Dimensions réduites en gardant les proportions ; une petite image n'est jamais agrandie. */
export function dimensionsReduites(
  largeur: number,
  hauteur: number,
  coteMax: number = COTE_MAX_PX,
): { largeur: number; hauteur: number } {
  if (!(largeur > 0 && hauteur > 0)) throw new RangeError('Image sans dimensions.');
  const ratio = Math.min(1, coteMax / Math.max(largeur, hauteur));
  return {
    largeur: Math.max(1, Math.round(largeur * ratio)),
    hauteur: Math.max(1, Math.round(hauteur * ratio)),
  };
}

/**
 * La photo en JPEG réduit, orientation EXIF appliquée. Si l'image reste trop lourde, la qualité
 * baisse d'un cran. Lève une erreur si le navigateur ne sait pas la décoder.
 */
export async function compresserPhoto(fichier: Blob): Promise<Blob> {
  const image = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  const { largeur, hauteur } = dimensionsReduites(image.width, image.height);
  const toile = document.createElement('canvas');
  toile.width = largeur;
  toile.height = hauteur;
  const contexte = toile.getContext('2d');
  if (!contexte) throw new Error('Canvas indisponible.');
  contexte.drawImage(image, 0, 0, largeur, hauteur);
  image.close();

  for (const qualite of QUALITES_JPEG) {
    const blob = await new Promise<Blob | null>((ok) => toile.toBlob(ok, 'image/jpeg', qualite));
    if (blob && blob.size <= TAILLE_MAX_PHOTO) return blob;
  }
  throw new Error('Photo trop lourde, même compressée.');
}
