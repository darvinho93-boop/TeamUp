#!/usr/bin/env node
/**
 * L'image d'aperçu des liens partagés (WhatsApp, iMessage, réseaux sociaux) : 1 200 × 630,
 * sur le beige du site : le pictogramme, dessous le nom, dessous le slogan en petit, sur une
 * ligne.
 *
 *   pnpm --filter @teamup/site apercu
 *
 * Rien n'est redessiné : le logo est celui de l'en-tête du site en ligne, agrandi, et le slogan
 * est composé avec la police des titres du site. Le tout est capturé dans Chrome par Playwright
 * (une dépendance de l'app, pas de la vitrine). Le pictogramme et le nom tiennent dans le carré
 * central de l'image : certaines applications n'en montrent que cette partie.
 * À relancer si le logo ou le slogan changent ; WhatsApp garde un aperçu en mémoire plusieurs
 * jours pour une même adresse.
 */
/* global document -- les fonctions passées à page.evaluate tournent dans le navigateur */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SITE = process.argv[2] ?? 'https://teamup-game.fr';
const SLOGAN = 'On joue. On se rencontre. On crée du lien.';
const SORTIE = fileURLToPath(new URL('../public/apercu-partage.jpg', import.meta.url));
const { chromium } = createRequire(new URL('../../app/package.json', import.meta.url))(
  '@playwright/test',
);

const navigateur = await chromium.launch({ channel: 'chrome' });
const page = await navigateur.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
await page.goto(SITE, { waitUntil: 'networkidle' });

await page.evaluate((slogan) => {
  const marque = document.querySelector('.tu-site-header__brand').cloneNode(true);
  marque.removeAttribute('href');
  Object.assign(marque.style, { flexDirection: 'column', gap: '20px' });
  marque.querySelector('.tu-picto').style.setProperty('--tu-picto-taille', '196px');
  marque.querySelector('.tu-wordmark').style.setProperty('--tu-wordmark-size', '104px');

  const phrases = document.createElement('p');
  Object.assign(phrases.style, {
    margin: '0',
    fontFamily: 'var(--tu-font-display)',
    fontSize: '32px',
    fontWeight: '500',
    lineHeight: '1.3',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    color: 'var(--tu-text)',
  });
  phrases.textContent = slogan;

  document.body.replaceChildren(marque, phrases);
  Object.assign(document.body.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '36px',
    width: '1200px',
    height: '630px',
    margin: '0',
    overflow: 'hidden',
    background: 'var(--tu-bg)',
  });
}, SLOGAN);

await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);
const capture = await page.screenshot({
  type: 'png',
  clip: { x: 0, y: 0, width: 1200, height: 630 },
});
await navigateur.close();

const { size } = await sharp(capture).jpeg({ quality: 88, mozjpeg: true }).toFile(SORTIE);
console.log(`apercu-partage.jpg : 1200 × 630, ${Math.round(size / 1024)} Ko`);
