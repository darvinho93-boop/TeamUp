#!/usr/bin/env node
/**
 * Les icônes de Team Up! (onglet du navigateur, écran d'accueil du téléphone, app installée),
 * fabriquées à partir du dernier logo : ses quatre calques (`design/brand/logo/calques/`, sans
 * retouche) posés au centre du beige du logo.
 *
 *   pnpm --filter @teamup/site icones
 *
 * Le script vit dans la vitrine parce que `sharp` y est déjà une dépendance ; il écrit dans
 * `design/brand/icons/`, que les deux apps importent. Chaque fichier fait exactement la taille
 * que son nom annonce : ceux du kit d'origine portaient le dessin dans le coin haut gauche d'une
 * image plus grande, sur du blanc, et l'onglet du navigateur le montrait décalé.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const MARQUE = new URL('../../../design/brand/', import.meta.url);
const chemin = (relatif) => fileURLToPath(new URL(relatif, MARQUE));
const BEIGE = JSON.parse(readFileSync(chemin('tokens.json'), 'utf8')).color.semantic.bg;

// L'ordre d'empilement du pictogramme de l'app (`Pictogramme.tsx`).
const CALQUES = ['navy', 'corail', 'sable', 'vert'];

/**
 * `logo` : part du côté que le logo occupe. `rayon` : arrondi des coins, en part du côté ;
 * 0 donne un carré plein, pour les systèmes qui découpent eux-mêmes l'icône (iOS, et l'icône
 * « maskable » d'Android, dont seule la zone centrale de 80 % est garantie visible).
 */
const ICONES = [
  { fichier: 'favicon16.png', cote: 16, logo: 0.88, rayon: 0.2 },
  { fichier: 'favicon32.png', cote: 32, logo: 0.88, rayon: 0.2 },
  { fichier: 'appletouchicon.png', cote: 180, logo: 0.72, rayon: 0 },
  { fichier: 'icon192.png', cote: 192, logo: 0.76, rayon: 0.18 },
  { fichier: 'icon512.png', cote: 512, logo: 0.76, rayon: 0.18 },
  { fichier: 'iconmaskable512.png', cote: 512, logo: 0.6, rayon: 0 },
];

/** Le logo entier, sans marge : les quatre calques empilés, rognés au plus près. */
async function logo() {
  const [fond, ...dessus] = CALQUES.map((nom) => chemin(`logo/calques/${nom}.png`));
  const empile = await sharp(fond)
    .composite(dessus.map((input) => ({ input })))
    .png()
    .toBuffer();
  return sharp(empile).trim().png().toBuffer();
}

/** Le fond beige : arrondi sur du transparent, ou plein et opaque. */
function fond(cote, rayon) {
  if (rayon === 0) {
    return sharp({ create: { width: cote, height: cote, channels: 3, background: BEIGE } });
  }
  const r = cote * rayon;
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${cote}" height="${cote}">` +
        `<rect width="${cote}" height="${cote}" rx="${r}" ry="${r}" fill="${BEIGE}"/></svg>`,
    ),
  );
}

const source = await logo();
for (const { fichier, cote, logo: part, rayon } of ICONES) {
  const boite = Math.round(cote * part);
  const dessin = await sharp(source)
    .resize(boite, boite, { fit: 'inside', kernel: 'lanczos3' })
    .png()
    .toBuffer();
  await fond(cote, rayon)
    .composite([{ input: dessin, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(chemin(`icons/${fichier}`));
  console.log(`${fichier} : ${cote} × ${cote} px`);
}
