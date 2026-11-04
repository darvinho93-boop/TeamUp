import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

/**
 * « Dévoiler les équipes » au pilotage (2026-11-04), en machine à sous : sur le roulement de
 * tambour, les cartes s'arrêtent une à une ; à la cymbale, la grille et la fête.
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

test('la machine à sous : les cartes s’arrêtent une à une, puis la fête', async ({ browser }) => {
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

  // La machine à sous : des rouleaux dans chaque carte, le roulement, un « tic » par carte.
  const machine = ecran.locator('[data-devoilement="en-cours"]');
  await expect(machine).toBeVisible({ timeout: 5000 });
  await expect(machine.locator('.tu-rouleau').first()).toBeAttached();
  await expect.poll(() => sonsJoues(ecran), { timeout: 3000 }).toContain('roulement');

  // À la cymbale (5 s), tout est posé : la grille, chaque prénom dans sa carte, et la fête.
  await expect(machine).toHaveCount(0, { timeout: 9000 });
  await expect(ecran.locator('.tu-rouleau')).toHaveCount(0);
  await expect(ecran.getByTestId('celebration')).toBeAttached();
  expect((await sonsJoues(ecran)).filter((s) => s === 'tic')).toHaveLength(3);
  for (const [numero, prenoms] of Object.entries(EQUIPES)) {
    const carte = ecran.getByTestId(`membres-${numero}`);
    for (const prenom of prenoms) {
      await expect(carte.getByText(prenom, { exact: true })).toBeVisible();
    }
  }

  // Rejouable ; un écran sous prefers-reduced-motion montre la grille d'emblée, sans machine.
  const calme = await ouvrirEcran(browser, session, 'reduce');
  await regie.getByTestId('devoiler-equipes').click();
  await expect(machine).toBeVisible({ timeout: 5000 });
  await expect(calme.getByTestId('membres-2').getByText('Hugo', { exact: true })).toBeVisible();
  await expect(calme.locator('[data-devoilement]')).toHaveCount(0);
  await expect(machine).toHaveCount(0, { timeout: 9000 });
});
