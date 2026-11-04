import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

/**
 * « Dévoiler les équipes » au pilotage (2026-11-04) : sur le roulement de tambour, les prénoms
 * tourbillonnent puis filent vers leurs cartes ; à la cymbale, la grille et la fête.
 */

const EQUIPES: Record<number, string[]> = {
  1: ['Léa', 'Sam', 'Priya'],
  2: ['Hugo', 'Emma', 'Malik'],
  3: ['Zoé', 'Nadia', 'Tom'],
};

let evenement: { id: string; code: string };

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 3, langues: ['fr'] });
  const service = clientService();
  const { data } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id);
  const ids = new Map((data as { id: string; numero: number }[]).map((e) => [e.numero, e.id]));
  const { error } = await service.from('joueurs').insert(
    Object.entries(EQUIPES).flatMap(([numero, prenoms]) =>
      prenoms.map((prenom) => ({
        evenement_id: evenement.id,
        equipe_id: ids.get(Number(numero)) ?? null,
        prenom,
        langue: 'fr',
      })),
    ),
  );
  if (error) throw new Error(error.message);
});

test.afterAll(() => supprimerEvenements([evenement.id]));

async function connecter(browser: Browser): Promise<{ session: BrowserContext; regie: Page }> {
  const session = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const regie = await session.newPage();
  await regie.goto('/regie');
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL('**/regie');
  return { session, regie };
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
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });
  return ecran;
}

/** Les sons joués par l'écran, une fois le son activé. */
const sonsJoues = (ecran: Page) =>
  ecran.evaluate(
    () =>
      (
        window as unknown as { __tuLecteur?: { journal: { son: string }[] } }
      ).__tuLecteur?.journal.map((j) => j.son) ?? [],
  );

test('les prénoms tourbillonnent, filent vers leurs cartes, puis la fête', async ({ browser }) => {
  test.setTimeout(120_000);
  const { session, regie } = await connecter(browser);

  // La Salle dit où dévoiler les équipes une fois formées.
  await regie.goto(`/regie/${evenement.code}/salle`);
  await expect(regie.getByTestId('devoiler-au-pilotage')).toBeVisible();

  const ecran = await ouvrirEcran(browser, session, 'no-preference');
  await ecran.getByRole('button', { name: 'Activer le son' }).click();
  await expect(ecran.getByRole('button', { name: 'Activer le son' })).toHaveCount(0);

  await regie.goto(`/regie/${evenement.code}/pilotage`);
  await regie.getByTestId('devoiler-equipes').click();

  // Le vol : la couche des prénoms, ceux des cartes masqués, le roulement de tambour.
  const couche = ecran.getByTestId('devoilement');
  await expect(couche).toBeVisible({ timeout: 3000 });
  await expect(ecran.locator('.tu-stage-equipes--en-vol')).toHaveCount(1);
  await expect(ecran.getByTestId('membres-1').getByText('Léa', { exact: true })).toBeHidden();
  await expect(couche.getByText('Léa', { exact: true })).toBeAttached();
  await expect.poll(() => sonsJoues(ecran), { timeout: 3000 }).toContain('roulement');

  // À la cymbale (5 s), tout est posé : la grille, chaque prénom dans sa carte, et la fête.
  await expect(couche).toHaveCount(0, { timeout: 8000 });
  await expect(ecran.getByTestId('celebration')).toBeAttached();
  for (const [numero, prenoms] of Object.entries(EQUIPES)) {
    const carte = ecran.getByTestId(`membres-${numero}`);
    for (const prenom of prenoms) {
      await expect(carte.getByText(prenom, { exact: true })).toBeVisible();
    }
  }

  // Rejouable ; un écran sous prefers-reduced-motion montre la grille d'emblée, sans vol.
  const calme = await ouvrirEcran(browser, session, 'reduce');
  await regie.getByTestId('devoiler-equipes').click();
  await expect(couche).toBeVisible({ timeout: 3000 });
  await expect(calme.getByTestId('membres-2').getByText('Hugo', { exact: true })).toBeVisible();
  await expect(calme.getByTestId('devoilement')).toHaveCount(0);
  await expect(couche).toHaveCount(0, { timeout: 8000 });
});
