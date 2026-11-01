/**
 * Le QR code des cartes Team Up! imprimées, en SVG fixe (`public/qr-carte.svg`) : la même adresse
 * pour toutes les soirées, la page des soirées du jour (2026-11-01). Mêmes couleurs que le QR de
 * la partie (`src/serveur/qr.ts`). Pour l'imprimeur : le SVG se met à l'échelle sans perte.
 *
 *   node scripts/qr-carte.mjs
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import QRCode from 'qrcode';

const require = createRequire(import.meta.url);
const tokens = require('@teamup/brand/tokens.json');
const URL_CARTE = 'https://app.teamup-game.fr/soirees';

const svg = await QRCode.toString(URL_CARTE, {
  type: 'svg',
  margin: 2,
  errorCorrectionLevel: 'M',
  color: { dark: tokens.color.stage.bg, light: tokens.color.semantic.surface },
});
writeFileSync(new URL('../public/qr-carte.svg', import.meta.url), svg);
console.log(`QR de ${URL_CARTE} écrit dans public/qr-carte.svg`);
