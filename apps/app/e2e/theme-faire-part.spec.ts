import { expect, test, type Page } from '@playwright/test';
import { DEPART_MUSIQUE_MS } from '../src/lib/faire-part';
import { fabriquerPng } from '../tests/png';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

/**
 * Le thème « faire-part » d'une soirée (2026-11-27) : l'ouverture classique, puis l'accueil qui
 * se forme aux couleurs des hôtes sur leur musique. Les fichiers sont fabriqués par le test
 * (rien des hôtes dans le dépôt) ; `CAPTURES=<dossier>` garde des images de l'entrée.
 */

let evenement: { id: string; code: string };
let temoin: { id: string; code: string };
const dossier = `e2e-${Date.now().toString(36)}`;
const fichiers: Record<string, string> = {};

/** Un WAV stéréo de `secondes` : un la à 440 Hz, assez pour décoder et jouer. */
function wav(secondes: number): Buffer {
  const taux = 44_100;
  const n = Math.round(taux * secondes);
  const donnees = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / taux) * 8000);
    donnees.writeInt16LE(v, i * 4);
    donnees.writeInt16LE(v, i * 4 + 2);
  }
  const tete = Buffer.alloc(44);
  tete.write('RIFF', 0);
  tete.writeUInt32LE(36 + donnees.length, 4);
  tete.write('WAVEfmt ', 8);
  tete.writeUInt32LE(16, 16);
  tete.writeUInt16LE(1, 20);
  tete.writeUInt16LE(2, 22);
  tete.writeUInt32LE(taux, 24);
  tete.writeUInt32LE(taux * 4, 28);
  tete.writeUInt16LE(4, 32);
  tete.writeUInt16LE(16, 34);
  tete.write('data', 36);
  tete.writeUInt32LE(donnees.length, 40);
  return Buffer.concat([tete, donnees]);
}

const svg = (corps: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40">${corps}</svg>`);

test.beforeAll(async () => {
  const service = clientService();
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
  temoin = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
  await service.from('pilotage').update({ scene: 'ouverture' }).eq('evenement_id', evenement.id);
  const aDeposer: Record<string, [Buffer, string]> = {
    monogramme: [fabriquerPng(120, 130, [{ x: 20, y: 20, l: 80, h: 90 }]), 'image/png'],
    prenoms: [fabriquerPng(300, 160, [{ x: 10, y: 60, l: 280, h: 40 }]), 'image/png'],
    illustration: [
      svg(
        '<rect x="10" y="10" width="80" height="25" fill="gainsboro" stroke="slategray"/>' +
          '<line x1="10" y1="38" x2="90" y2="38" stroke="slategray" stroke-dasharray="2 2"/>' +
          '<script>window.__piege = true</script>' +
          '<path d="M10 10 L50 2 L90 10" fill="none" stroke="slategray" onload="window.__piege = true"/>',
      ),
      'image/svg+xml',
    ],
    rinceau: [
      svg('<path d="M50 0 C20 10 80 30 50 40" fill="none" stroke="darkseagreen"/>'),
      'image/svg+xml',
    ],
    grain: [svg('<rect width="100" height="40" fill="black" opacity=".03"/>'), 'image/svg+xml'],
    musique: [wav(4), 'audio/wav'],
  };
  for (const [role, [contenu, type]] of Object.entries(aDeposer)) {
    const chemin = `${dossier}/${role}.${type.split('/')[1]?.replace('svg+xml', 'svg')}`;
    const { error } = await service.storage
      .from('themes')
      .upload(chemin, contenu, { contentType: type, upsert: true });
    if (error) throw new Error(error.message);
    fichiers[role] = chemin;
  }
  const { error } = await service.from('themes_soiree').insert({
    evenement_id: evenement.id,
    theme: 'faire-part',
    fichiers,
    reglages: { date: 'Samedi 5 décembre 2026', orchestre_ms: 1000, notes_ms: [50, 400] },
  });
  if (error) throw new Error(error.message);
});

test.afterAll(async () => {
  await clientService().storage.from('themes').remove(Object.values(fichiers));
  await supprimerEvenements([evenement.id, temoin.id]);
});

async function connecter(page: Page) {
  await page.goto('/regie');
  await page.getByLabel('E-mail').fill('anna@teamup.test');
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/regie');
}

test('l’ouverture classique se change en accueil aux couleurs des hôtes, sur leur musique', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const regie = await (
    await browser.newContext({ viewport: { width: 1366, height: 768 }, isMobile: false })
  ).newPage();
  await connecter(regie);
  const ecran = await (
    await browser.newContext({
      storageState: await regie.context().storageState(),
      viewport: { width: 1920, height: 1080 },
      isMobile: false,
    })
  ).newPage();
  await ecran.goto(`/ecran/${evenement.code}`);
  await expect(ecran.locator('[data-scene="ouverture"]')).toBeVisible();
  // Le thème est prêt (tous ses fichiers téléchargés), le son activé.
  await expect(ecran.locator('.tu-stage[data-theme-soiree="faire-part"]')).toBeVisible({
    timeout: 20_000,
  });
  await ecran.getByRole('button', { name: 'Activer le son' }).click();
  await expect(ecran.getByRole('button', { name: 'Activer le son' })).toHaveCount(0);
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });

  await regie.goto(`/regie/${evenement.code}/pilotage`);
  await regie.getByTestId('ouvrir-inscriptions').click();

  // L'entrée à thème remplace la passe finale classique : les ronds, puis le reste.
  const entree = ecran.locator('.tu-fp-accueil--entree');
  await expect(entree).toBeVisible({ timeout: 6000 });
  await expect(ecran.getByTestId('finale')).toHaveCount(0);
  await expect(entree.locator('.tu-ronds--finale')).toBeVisible();
  const depuis = Number(await entree.getAttribute('data-depuis'));
  // Ses animations se comptent toutes depuis un même instant, celui sur lequel les sons sont calés
  // (2026-11-28), et non depuis la fin de son premier rendu.
  const departs = await entree.evaluate((el) => [
    ...new Set(el.getAnimations({ subtree: true }).map((a) => Number(a.startTime))),
  ]);
  expect(departs).toHaveLength(1);
  const departMs = departs[0]!;
  if (process.env['CAPTURES']) {
    for (const t of [2000, 6000, 9000, 12_000]) {
      await ecran.waitForTimeout(t === 2000 ? 2000 : 3000);
      await ecran.screenshot({ path: `${process.env['CAPTURES']}/theme-entree-${t}.png` });
    }
  }

  // L'illustration est nettoyée : ni script, ni gestionnaire d'évènement.
  await expect(ecran.locator('.tu-fp-illustration script')).toHaveCount(0);
  await expect(ecran.locator('.tu-fp-illustration [onload]')).toHaveCount(0);
  expect(await ecran.evaluate(() => (window as { __piege?: boolean }).__piege)).toBeUndefined();
  await expect(ecran.locator('.tu-fp-illustration .tu-fp-trace')).toHaveCount(2);
  await expect(ecran.locator('.tu-fp-illustration .tu-fp-pointille')).toHaveCount(1);

  // Formé : l'accueil, ses repères habituels, la date des hôtes.
  await expect(entree).toHaveCount(0, { timeout: 30_000 });
  const accueil = ecran.locator('[data-scene="accueil"][data-theme-soiree="faire-part"]');
  await expect(accueil).toBeVisible();
  await expect(ecran.getByTestId('code')).toHaveText(evenement.code);
  await expect(ecran.getByTestId('scannez')).toHaveText('Scannez pour jouer');
  await expect(ecran.getByTestId('lien')).toContainText(`/${evenement.code}`);
  await expect(accueil.locator('.tu-fp-date')).toHaveText('Samedi 5 décembre 2026');
  if (process.env['CAPTURES'])
    await ecran.screenshot({ path: `${process.env['CAPTURES']}/theme-accueil.png` });

  // Les sons : le reel, puis la musique des hôtes là où le QR code paraissait.
  const journal = await ecran.evaluate(() => window.__tuLecteur?.journal ?? []);
  const finale = journal.find((j) => j.son === 'finale');
  const fairePart = journal.find((j) => j.son === 'faire-part');
  expect(finale).toBeDefined();
  expect(fairePart).toBeDefined();
  // Le reel commence à 2 332 ms de la passe (pris en route quand elle reprend la boucle plus loin),
  // la musique des hôtes quand il s'éteint, à 6 950 ms (DEPART_MUSIQUE_MS). Tous deux programmés
  // sur l'horloge audio (2026-11-28) : leur écart s'y mesure à la milliseconde, sans les aléas des
  // minuteurs (0,3 s de trop mesurés en ligne le 2026-11-28, quand ils en dépendaient).
  const ecartAudioMs = (fairePart!.audio! - finale!.audio!) * 1000;
  expect(Math.abs(ecartAudioMs - (DEPART_MUSIQUE_MS - 2332))).toBeLessThan(10);
  // Et la musique vise l'instant des animations, programmée avant son heure.
  expect(Math.abs(fairePart!.a - (departMs + DEPART_MUSIQUE_MS - depuis))).toBeLessThanOrEqual(1);
  test.info().annotations.push({
    type: 'sons',
    description: JSON.stringify({ depuis, ecartAudioMs: Math.round(ecartAudioMs * 10) / 10 }),
  });

  // Rechargé : l'accueil déjà formé, sans entrée.
  await ecran.reload();
  await expect(ecran.locator('[data-scene="accueil"][data-theme-soiree="faire-part"]')).toBeVisible(
    { timeout: 20_000 },
  );
  await expect(ecran.locator('.tu-fp-accueil--entree')).toHaveCount(0);
  await expect(ecran.locator('.tu-ronds')).toHaveCount(0);

  // L'aperçu de la régie montre le même accueil, muet.
  const apercu = regie.locator('.tu-stage--apercu [data-theme-soiree="faire-part"]');
  await expect(apercu).toBeVisible({ timeout: 20_000 });

  // Une soirée sans thème garde son accueil habituel.
  await ecran.goto(`/ecran/${temoin.code}`);
  await expect(ecran.locator('[data-scene="accueil"]')).toBeVisible();
  await ecran.waitForTimeout(2000);
  await expect(ecran.locator('[data-theme-soiree]')).toHaveCount(0);
});
