/**
 * Capture les visuels du jeu qui servent à la vidéo : les illustrations de la vitrine
 * (écrans de salle, téléphones) et deux vrais écrans de l'app (accueil de l'écran commun,
 * arrivée d'un joueur). Les deux serveurs de dev et la base locale doivent tourner.
 *
 *   node video/scripts/capture.mjs [hôte]     (hôte par défaut : 10.1.0.75)
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Playwright est une dépendance de l'app : on la prend là où elle est installée.
const require = createRequire(new URL('../../apps/app/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const HOTE = process.argv[2] ?? '10.1.0.75';
const SITE = `http://${HOTE}:4321`;
const APP = `http://${HOTE}:3000`;
const SORTIE = fileURLToPath(new URL('../public/captures/', import.meta.url));
mkdirSync(SORTIE, { recursive: true });

/** Les barres d'outils de dev d'Astro et de Next n'ont rien à faire sur une capture. */
const SANS_OUTILS = 'astro-dev-toolbar,nextjs-portal{display:none!important}';

const PAGES = ['', 'particuliers', 'entreprises', 'les-jeux', 'comment-ca-marche'];

const navigateur = await chromium.launch();

// 1. Les illustrations de la vitrine, élément par élément, en haute densité.
const vitrine = await navigateur.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 3,
  reducedMotion: 'reduce',
});
const page = await vitrine.newPage();
for (const chemin of PAGES) {
  const nom = chemin || 'accueil';
  for (const [classe, autre] of [
    ['screen', 'phone'],
    ['phone', 'screen'],
  ]) {
    await page.goto(`${SITE}/${chemin}`, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    // Sur les scènes de la vitrine, le téléphone chevauche l'écran : on masque l'autre.
    await page.addStyleTag({
      content: `.${autre}{visibility:hidden!important} .desktop-only{display:block!important} ${SANS_OUTILS}`,
    });
    const elements = page.locator(`.${classe}`);
    const total = await elements.count();
    for (let i = 0; i < total; i += 1) {
      const element = elements.nth(i);
      if (!(await element.isVisible())) continue;
      await element.scrollIntoViewIfNeeded();
      await element.screenshot({ path: `${SORTIE}${nom}-${classe}-${i}.png` });
    }
  }
}
await vitrine.close();

// 2. Le vrai écran commun de la soirée de démo, sous la session de l'animateur.
const salle = await navigateur.newContext({
  viewport: { width: 1920, height: 1080 },
  reducedMotion: 'reduce',
});
const ecran = await salle.newPage();
await ecran.goto(`${APP}/regie/connexion`);
await ecran.getByLabel('E-mail').fill('anna@teamup.test');
await ecran.getByLabel('Mot de passe').fill('motdepasse');
await ecran.getByLabel('Mot de passe').press('Enter');
await ecran.waitForURL(/\/regie(?!\/connexion)/);
await ecran.goto(`${APP}/ecran/FETE24`, { waitUntil: 'load' });
await ecran.addStyleTag({ content: SANS_OUTILS });
await ecran.waitForTimeout(1500);
await ecran.screenshot({ path: `${SORTIE}app-ecran.png` });
await salle.close();

// 3. Le vrai téléphone d'un invité qui arrive.
const poche = await navigateur.newContext({
  viewport: { width: 390, height: 780 },
  deviceScaleFactor: 3,
  reducedMotion: 'reduce',
});
const telephone = await poche.newPage();
await telephone.goto(`${APP}/FETE24`, { waitUntil: 'load' });
await telephone.addStyleTag({ content: SANS_OUTILS });
await telephone.waitForTimeout(1000);
await telephone.screenshot({ path: `${SORTIE}app-telephone.png` });
await poche.close();

await navigateur.close();
console.log(`Captures écrites dans ${SORTIE}`);
