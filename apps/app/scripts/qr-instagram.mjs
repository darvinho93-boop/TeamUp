/**
 * Le QR code du compte Instagram, en SVG fixe (`public/qr-instagram.svg`) : l'adresse ne change
 * pas d'une soirée à l'autre, l'écran commun le sert comme une image (page Instagram, clôture).
 * Mêmes couleurs que le QR de la partie (`src/serveur/qr.ts`).
 *
 *   node scripts/qr-instagram.mjs
 *
 * À relancer si le compte change (`src/marque/instagram.ts`).
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import QRCode from 'qrcode';

const require = createRequire(import.meta.url);
const tokens = require('@teamup/brand/tokens.json');
const URL_INSTAGRAM = 'https://www.instagram.com/teamup_officiel';

const svg = await QRCode.toString(URL_INSTAGRAM, {
  type: 'svg',
  margin: 2,
  errorCorrectionLevel: 'M',
  color: { dark: tokens.color.stage.bg, light: tokens.color.semantic.surface },
});
writeFileSync(new URL('../public/qr-instagram.svg', import.meta.url), svg);
console.log(`QR de ${URL_INSTAGRAM} écrit dans public/qr-instagram.svg`);
