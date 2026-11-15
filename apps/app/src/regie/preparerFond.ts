import {
  dimensionsFond,
  fondRecadre,
  fondTropPetit,
  QUALITES_FOND,
  recadrage,
  TAILLE_MAX_FOND,
} from '@/lib/fonds';

/**
 * La photo de fond d'un jeu, préparée dans le navigateur de l'animateur avant l'envoi : décodée
 * (orientation de l'appareil appliquée), recadrée au milieu en 16:9, réduite à la taille de la
 * scène et convertie en JPEG sous le poids permis.
 */

export type RefusFond = 'illisible' | 'lourd';

export class FondRefuse extends Error {
  constructor(readonly refus: RefusFond) {
    super(refus);
  }
}

export interface FondPret {
  blob: Blob;
  /** Une bonne partie de la photo est partie au recadrage (photo en hauteur). */
  recadre: boolean;
  /** Trop petite pour l'écran : elle sera floue. */
  petit: boolean;
}

export async function preparerFond(fichier: File): Promise<FondPret> {
  const image = await createImageBitmap(fichier, { imageOrientation: 'from-image' }).catch(() => {
    throw new FondRefuse('illisible');
  });
  try {
    const { width: l, height: h } = image;
    if (!(l > 0 && h > 0)) throw new FondRefuse('illisible');
    const cadre = recadrage(l, h);
    const { largeur, hauteur } = dimensionsFond(cadre);
    const toile = document.createElement('canvas');
    toile.width = largeur;
    toile.height = hauteur;
    const contexte = toile.getContext('2d');
    if (!contexte) throw new FondRefuse('illisible');
    contexte.imageSmoothingQuality = 'high';
    contexte.drawImage(
      image,
      cadre.x,
      cadre.y,
      cadre.largeur,
      cadre.hauteur,
      0,
      0,
      largeur,
      hauteur,
    );
    for (const qualite of QUALITES_FOND) {
      const blob = await new Promise<Blob | null>((ok) => toile.toBlob(ok, 'image/jpeg', qualite));
      if (blob && blob.size <= TAILLE_MAX_FOND) {
        return { blob, recadre: fondRecadre(l, h), petit: fondTropPetit(cadre) };
      }
    }
    throw new FondRefuse('lourd');
  } finally {
    image.close();
  }
}
