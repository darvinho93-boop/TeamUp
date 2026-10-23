import { expect, test } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

let evenement: { id: string; code: string };

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
  // Comme une soirée neuve : l'écran s'ouvre sur l'ouverture.
  await clientService()
    .from('pilotage')
    .update({ scene: 'ouverture' })
    .eq('evenement_id', evenement.id);
});

test.afterAll(() => supprimerEvenements([evenement.id]));

test('l’ouverture mène à la page du QR code par le logo Team Up!', async ({ browser }) => {
  test.setTimeout(120_000);
  const regie = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 }, isMobile: false })
  ).newPage();
  await regie.goto('/regie');
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL('**/regie');

  // --- L'écran tourne sur l'ouverture : les quatre ronds.
  const ecran = await (
    await browser.newContext({
      storageState: await regie.context().storageState(),
      viewport: { width: 1920, height: 1080 },
      isMobile: false,
    })
  ).newPage();
  await ecran.goto(`/ecran/${evenement.code}`);
  await expect(ecran.locator('[data-scene="ouverture"]')).toBeVisible();
  await expect(ecran.locator('[data-scene="ouverture"] .tu-rond')).toHaveCount(4);
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });

  // --- « Accueil » au pilotage : le logo Team Up! une dernière fois, puis la page du QR.
  await regie.goto(`/regie/${evenement.code}/pilotage`);
  await expect(regie.getByRole('button', { name: 'Ouverture' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await regie.getByRole('button', { name: 'Accueil', exact: true }).click();

  // La passe finale prend la boucle au vol, ou après la fin du cycle si la boucle défaisait déjà
  // le logo (l'écran reste alors sur l'ouverture) : le logo et son nom, puis la page du QR code.
  const finale = ecran.getByTestId('finale');
  await expect(finale).toBeVisible({ timeout: 6000 });
  await expect(finale.locator('.tu-ronds__nom')).toBeVisible();
  await expect(ecran.locator('[data-fin-de-boucle="true"]')).toHaveCount(0);
  await expect(finale).toHaveCount(0, { timeout: 12_000 });
  await expect(ecran.locator('[data-scene="accueil"]')).toBeVisible();
  await expect(ecran.getByTestId('code')).toHaveText(evenement.code);
});
