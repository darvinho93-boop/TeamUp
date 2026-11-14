import { dimensionsReduites } from '@/lib/compression';
import {
  aUnFond,
  cadreUtile,
  dimensionsLogo,
  LOGO_MAX_PX,
  logoTropPetit,
  TAILLE_MAX_LOGO,
} from '@/lib/logo';

/**
 * Le logo du partenaire, préparé dans le navigateur de l'animateur avant l'envoi : décodé (PNG,
 * WebP ou SVG), rogné à ses pixels visibles, réduit à la taille gardée et converti en PNG.
 */

export type RefusLogo = 'illisible' | 'vide' | 'lourd';

export class LogoRefuse extends Error {
  constructor(readonly refus: RefusLogo) {
    super(refus);
  }
}

export interface LogoPret {
  blob: Blob;
  largeur: number;
  hauteur: number;
  /** Les quatre coins sont pleins : le logo paraîtra dans un rectangle. */
  fond: boolean;
  /** Plus petit que sa boîte à l'écran : il sera agrandi, donc peut-être flou. */
  petit: boolean;
}

/** Plus grand côté de la toile de travail : un fichier énorme est réduit avant le rognage. */
const TOILE_MAX_PX = 4096;
/** Un SVG n'a pas de pixels : dessiné assez grand pour que le rognage laisse de la matière. */
const SVG_COTE_PX = 2 * LOGO_MAX_PX.largeur;
/** Trop lourd : on réduit d'un cran, trois fois au plus. */
const REDUCTIONS = [1, 0.7, 0.5, 0.35] as const;

function toile(largeur: number, hauteur: number) {
  const element = document.createElement('canvas');
  element.width = largeur;
  element.height = hauteur;
  const contexte = element.getContext('2d', { willReadFrequently: true });
  if (!contexte) throw new LogoRefuse('illisible');
  return { element, contexte };
}

export async function preparerLogo(fichier: File): Promise<LogoPret> {
  const vectoriel = fichier.type === 'image/svg+xml' || /\.svg$/i.test(fichier.name);
  const adresse = URL.createObjectURL(fichier);
  try {
    const image = new Image();
    image.src = adresse;
    await image.decode().catch(() => {
      throw new LogoRefuse('illisible');
    });
    const { naturalWidth: l, naturalHeight: h } = image;
    // Certains SVG sans dimensions ne donnent aucune taille : rien à dessiner.
    if (!(l > 0 && h > 0)) throw new LogoRefuse('illisible');

    const travail = vectoriel
      ? dimensionsReduites(
          (l * SVG_COTE_PX) / Math.max(l, h),
          (h * SVG_COTE_PX) / Math.max(l, h),
          TOILE_MAX_PX,
        )
      : dimensionsReduites(l, h, TOILE_MAX_PX);
    const source = toile(travail.largeur, travail.hauteur);
    source.contexte.drawImage(image, 0, 0, travail.largeur, travail.hauteur);

    let pixels: ImageData;
    try {
      pixels = source.contexte.getImageData(0, 0, travail.largeur, travail.hauteur);
    } catch {
      // Un SVG qui embarque du contenu étranger rend la toile illisible.
      throw new LogoRefuse('illisible');
    }
    const cadre = cadreUtile(pixels.data, travail.largeur, travail.hauteur);
    if (!cadre) throw new LogoRefuse('vide');
    const fond = aUnFond(pixels.data, travail.largeur, cadre);
    const petit = !vectoriel && logoTropPetit(cadre.largeur, cadre.hauteur);

    const cible = dimensionsLogo(cadre.largeur, cadre.hauteur);
    for (const reduction of REDUCTIONS) {
      const largeur = Math.max(1, Math.round(cible.largeur * reduction));
      const hauteur = Math.max(1, Math.round(cible.hauteur * reduction));
      const sortie = toile(largeur, hauteur);
      sortie.contexte.imageSmoothingQuality = 'high';
      sortie.contexte.drawImage(
        source.element,
        cadre.x,
        cadre.y,
        cadre.largeur,
        cadre.hauteur,
        0,
        0,
        largeur,
        hauteur,
      );
      const blob = await new Promise<Blob | null>((ok) => sortie.element.toBlob(ok, 'image/png'));
      if (blob && blob.size <= TAILLE_MAX_LOGO) return { blob, largeur, hauteur, fond, petit };
    }
    throw new LogoRefuse('lourd');
  } finally {
    URL.revokeObjectURL(adresse);
  }
}
