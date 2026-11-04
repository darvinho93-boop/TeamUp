import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

/**
 * La page du QR code fait défiler les prénoms des joueurs déjà arrivés, et salue chaque arrivée
 * vue par l'écran (2026-11-04). Soirée sans équipes : les inscrits attendent la formation.
 */

let evenement: { id: string; code: string };

/** La relecture de sûreté de l'écran (20 s, `useEtatSalle`), plus de la marge. */
const RELECTURE_MS = 25_000;

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ langues: ['fr'] });
});

test.afterAll(() => supprimerEvenements([evenement.id]));

async function connecter(browser: Browser): Promise<BrowserContext> {
  const contexte = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const regie = await contexte.newPage();
  await regie.goto('/regie');
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL('**/regie');
  return contexte;
}

async function ouvrirEcran(
  browser: Browser,
  session: BrowserContext,
  reducedMotion: 'reduce' | 'no-preference',
): Promise<Page> {
  const fenetre = await browser.newContext({
    storageState: await session.storageState(),
    viewport: { width: 1920, height: 1080 },
    isMobile: false,
    reducedMotion,
  });
  const ecran = await fenetre.newPage();
  await ecran.goto(`/ecran/${evenement.code}`);
  await expect(ecran.locator('[data-scene="accueil"]')).toBeVisible();
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });
  return ecran;
}

/** Une arrivée par le QR code, depuis un téléphone neuf. */
async function arriver(browser: Browser, prenom: string) {
  const telephone = await browser.newContext();
  const r = await telephone.request.post(`/api/partie/${evenement.code}/rejoindre`, {
    data: { prenom, langue: 'fr', volontaire: false },
  });
  expect(r.status()).toBe(200);
  await telephone.close();
}

/** Le décalage horizontal d'une piste du bandeau. */
const decalage = (ecran: Page, rangee: number) =>
  ecran
    .locator('.tu-bandeau__piste')
    .nth(rangee)
    .evaluate((piste) => new DOMMatrixReadOnly(getComputedStyle(piste).transform).m41);

test('les prénoms défilent sous le QR code, et chaque arrivée est saluée', async ({ browser }) => {
  test.setTimeout(120_000);
  for (const prenom of ['Léa', 'Sam', 'Priya']) await arriver(browser, prenom);

  const session = await connecter(browser);
  const ecran = await ouvrirEcran(browser, session, 'no-preference');
  const bandeau = ecran.getByTestId('bandeau-prenoms');
  for (const prenom of ['Léa', 'Sam', 'Priya']) await expect(bandeau).toContainText(prenom);
  // Ni au chargement : seulement les arrivées que l'écran voit se produire.
  await expect(ecran.getByTestId('bienvenue')).toHaveText('');
  // Trois prénoms tiennent dans la largeur : rien ne bouge.
  await expect(ecran.locator('.tu-bandeau__rangee[data-defile]')).toHaveCount(0);

  // L'écran relit à l'arrivée (temps réel), au pire à sa relecture de sûreté (20 s) : le premier
  // essai, serveur froid, a vu le signal arriver après 5 s.
  await arriver(browser, 'Inès');
  await expect(ecran.getByTestId('bienvenue')).toContainText('Bienvenue, Inès', {
    timeout: RELECTURE_MS,
  });
  await expect(bandeau).toContainText('Inès');
  await expect(ecran.getByTestId('joueurs')).toHaveText('4 joueurs');

  // Trente de plus d'un coup : un seul message, qui compte les autres, et les rangées défilent.
  const arrivants = Array.from(
    { length: 30 },
    (_, i) => `Invité ${String(i + 1).padStart(2, '0')}`,
  );
  const { error } = await clientService()
    .from('joueurs')
    .insert(arrivants.map((prenom) => ({ evenement_id: evenement.id, prenom, langue: 'fr' })));
  expect(error).toBeNull();
  await expect(ecran.getByTestId('bienvenue')).toContainText('et 27 autres', {
    timeout: RELECTURE_MS,
  });
  await expect(ecran.locator('.tu-bandeau__rangee[data-defile]')).toHaveCount(2);
  const avant = await decalage(ecran, 0);
  await ecran.waitForTimeout(600);
  expect(await decalage(ecran, 0)).not.toBe(avant);

  // Le QR code reste entier dans la scène, au-dessus du bandeau.
  const qr = await ecran.locator('.tu-stage-qr').boundingBox();
  const haut = await bandeau.boundingBox();
  expect(qr && haut && qr.y + qr.height <= haut.y).toBe(true);

  // Sous prefers-reduced-motion, rien ne bouge, les plus récents d'abord (les trente arrivés
  // ensemble, dans un ordre quelconque, avant les quatre premiers).
  const calme = await ouvrirEcran(browser, session, 'reduce');
  const debut = await decalage(calme, 0);
  await calme.waitForTimeout(600);
  expect(await decalage(calme, 0)).toBe(debut);
  await expect(calme.locator('.tu-bandeau__prenom').first()).toHaveText(/^Invité \d{2}$/);
});
