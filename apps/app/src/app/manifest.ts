import type { MetadataRoute } from 'next';
import brand from '@teamup/brand/manifest.webmanifest' with { type: 'json' };
import icon192 from '@teamup/brand/icons/icon192.png';
import icon512 from '@teamup/brand/icons/icon512.png';
import iconMaskable from '@teamup/brand/icons/iconmaskable512.png';

/**
 * Le manifeste canonique vit dans le kit de marque : on l'importe, on ne le recopie pas.
 * Seules les URL d'icônes sont réécrites vers les fichiers réellement empaquetés
 * (le kit référence un favicon.svg qui n'existe pas — voir les divergences signalées).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    ...(brand as MetadataRoute.Manifest),
    icons: [
      { src: icon192.src, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon512.src, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: iconMaskable.src, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
