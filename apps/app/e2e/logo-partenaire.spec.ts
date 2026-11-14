import { expect, test, type Locator } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';
import { fabriquerPng } from '../tests/png';

/**
 * Le logo du partenaire (2026-11-11) : déposé à la préparation, il paraît en haut à gauche de
 * l'écran commun, dans la boîte de la marque Team Up! (même ligne, même hauteur, même marge) ;
 * le compte Instagram descend en bas à gauche. Retiré, tout revient comme avant.
 */
let evenement: { id: string; code: string };

// Un fichier aux marges vides inégales : le dessin tient dans 300 × 100, sans fond (le coin
// haut droit de son cadre est transparent).
const LOGO = fabriquerPng(640, 400, [
  { x: 150, y: 120, l: 100, h: 100 },
  { x: 270, y: 150, l: 180, h: 40 },
]);

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
  // Une scène qui porte la marque Team Up! dans son coin (l'accueil l'a en grand).
  await clientService()
    .from('pilotage')
    .update({ scene: 'equipes' })
    .eq('evenement_id', evenement.id);
});

test.afterAll(async () => {
  const service = clientService();
  const { data } = await service.storage.from('logos').list(evenement.id);
  const restes = (data ?? []).map((f) => `${evenement.id}/${f.name}`);
  if (restes.length) await service.storage.from('logos').remove(restes);
  await supprimerEvenements([evenement.id]);
});

const boite = async (cible: Locator) => {
  const b = await cible.boundingBox();
  if (!b) throw new Error('élément sans boîte');
  return b;
};

test('la préparation dépose le logo du partenaire, l’écran le cale sur la marque Team Up!', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const regie = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 }, isMobile: false })
  ).newPage();
  await regie.goto('/regie');
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL('**/regie');

  const ecran = await (
    await browser.newContext({
      storageState: await regie.context().storageState(),
      viewport: { width: 1920, height: 1080 },
      isMobile: false,
    })
  ).newPage();
  await ecran.goto(`/ecran/${evenement.code}`);
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });

  // --- Sans partenaire : le compte Instagram en haut à gauche, comme avant.
  const insta = ecran.getByTestId('insta-coin');
  const logo = ecran.getByTestId('logo-partenaire');
  const marque = ecran.locator('.tu-stage__picto');
  await expect(logo).toHaveCount(0);
  expect((await boite(insta)).y).toBeLessThan(60);

  // --- Préparation : le fichier est rogné à son dessin avant d'être montré.
  await regie.goto(`/regie/${evenement.code}/preparation`);
  const section = regie.getByTestId('logo-partenaire');
  await expect(section.getByTestId('logo-statut')).toContainText('Aucun logo partenaire');
  await expect(section.getByRole('button', { name: 'Enregistrer le logo' })).toBeDisabled();
  await section
    .getByLabel('Fichier du logo')
    .setInputFiles({ name: 'partenaire.png', mimeType: 'image/png', buffer: LOGO });
  const apercu = section.getByTestId('logo-apercu');
  await expect(section.getByTestId('logo-statut')).toContainText('pas encore enregistré');
  await expect
    .poll(() => apercu.evaluate((i: HTMLImageElement) => [i.naturalWidth, i.naturalHeight]))
    .toEqual([300, 100]);
  await expect(section.getByTestId('logo-fond')).toHaveCount(0);
  await expect(section.getByTestId('logo-petit')).toHaveCount(0);
  // Rien n'est parti tant qu'on n'a pas enregistré.
  await expect(logo).toHaveCount(0);

  await section.getByRole('button', { name: 'Enregistrer le logo' }).click();
  await expect(section.getByTestId('logo-statut')).toContainText('Logo enregistré');

  // --- L'écran suit sans recharger : le logo chargé, dans la boîte de la marque Team Up!.
  await expect(logo).toBeVisible({ timeout: 5000 });
  await expect.poll(() => logo.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(300);
  const [l, m, i] = await Promise.all([boite(logo), boite(marque), boite(insta)]);
  // Même ligne, même hauteur.
  expect(Math.abs(l.y - m.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(l.height - m.height)).toBeLessThanOrEqual(1);
  // Proportions du dessin (3 pour 1), jamais plus large que la marque.
  expect(Math.abs(l.width - 3 * l.height)).toBeLessThanOrEqual(1);
  expect(l.width).toBeLessThanOrEqual(336);
  // Même marge au bord gauche que la marque au bord droit, dans le cadre.
  expect(Math.abs(l.x - (1920 - (m.x + m.width)))).toBeLessThanOrEqual(1);
  expect(l.x).toBeGreaterThan(0);
  // Le compte Instagram : en bas à gauche, dans le cadre, sous le même bord.
  expect(i.y + i.height).toBeLessThanOrEqual(1080);
  expect(i.y).toBeGreaterThan(1080 - 60);
  expect(Math.abs(i.x - l.x)).toBeLessThanOrEqual(1);
  // Le titre de la scène, aligné à gauche, commence sous le bandeau : il ne passe plus sous le logo.
  const titre = ecran.getByRole('heading', { level: 1, name: 'Voici les équipes !' });
  expect((await boite(titre)).y).toBeGreaterThanOrEqual(l.y + l.height);

  // --- Un écran ouvert après coup le trouve d'emblée (rechargement, second écran).
  await ecran.reload();
  await expect(logo).toBeVisible();

  // --- Le serveur revérifie le fichier : un faux PNG est refusé, le logo en place reste.
  const faux = await regie.request.post(`/regie/${evenement.code}/logo`, {
    multipart: {
      fichier: { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from('<svg/>') },
    },
  });
  expect(faux.status()).toBe(422);
  await expect(logo).toBeVisible();

  // --- Retirer (deux appuis) : l'écran revient à son haut habituel.
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });
  await section.getByRole('button', { name: 'Retirer le logo' }).click();
  await section.getByRole('button', { name: 'Retirer du grand écran ?' }).click();
  await expect(section.getByTestId('logo-statut')).toContainText('Aucun logo partenaire');
  await expect(logo).toHaveCount(0, { timeout: 5000 });
  expect((await boite(insta)).y).toBeLessThan(60);
  // … et le titre remonte à sa place.
  expect((await boite(titre)).y).toBeLessThan(l.y + l.height);
  const { data } = await clientService().storage.from('logos').list(evenement.id);
  expect(data ?? []).toHaveLength(0);
});
