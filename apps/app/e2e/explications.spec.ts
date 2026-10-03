import { expect, test } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

/**
 * Critère du lot 12 : « Expliquer » lance sur l'écran commun l'explication animée du jeu
 * présenté ; un second écran ouvert en cours de route montre la même carte ; « Arrêter »
 * ramène l'intro fixe. Les scripts eux-mêmes (20 à 30 s, sept jeux) sont testés dans
 * packages/game.
 */

let evenement: { id: string; code: string };

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr', 'en'] });
  const { error } = await clientService()
    .from('manches')
    .insert({ evenement_id: evenement.id, jeu: 'list2', ordre: 1, options: {} });
  if (error) throw new Error(error.message);
});

test.afterAll(() => supprimerEvenements([evenement.id]));

test('Expliquer joue les cartes à l’écran, au même endroit sur un second écran', async ({
  page: regie,
  context,
  browser,
}) => {
  test.setTimeout(120_000);
  const { code } = evenement;

  await regie.goto(`/regie/${code}/pilotage`);
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL(`**/regie/${code}/pilotage`);

  const ouvrirEcran = async (reducedMotion: 'reduce' | 'no-preference') => {
    const fenetre = await browser.newContext({
      storageState: await context.storageState(),
      viewport: { width: 1920, height: 1080 },
      reducedMotion,
    });
    const ecran = await fenetre.newPage();
    await ecran.goto(`/ecran/${code}`);
    await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });
    return ecran;
  };
  const ecran = await ouvrirEcran('no-preference');
  const explication = ecran.locator('[data-scene="explication"]');

  // --- Présenter : l'intro fixe, comme avant le lot 12.
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await expect(ecran.locator('[data-scene="intro"]')).toBeVisible({ timeout: 10_000 });
  await expect(explication).toHaveCount(0);

  // --- Expliquer : la première carte, dans les deux langues de la soirée.
  await regie.getByRole('button', { name: 'Expliquer', exact: true }).click();
  await expect(explication).toHaveAttribute('data-carte', '1', { timeout: 1_000 });
  const phrase = ecran.getByTestId('phrase-explication');
  await expect(phrase).toContainText("Une équipe s'assoit dos à l'écran");
  await expect(phrase).toContainText('One team sits with its back to the screen');
  await expect(regie.getByRole('button', { name: 'Rejouer' })).toBeVisible();

  // --- Six secondes plus tard, la deuxième carte ; un écran ouvert maintenant, sans
  //     animation, tombe sur la même.
  await expect(explication).toHaveAttribute('data-carte', '2', { timeout: 8_000 });
  const second = await ouvrirEcran('reduce');
  await expect(second.locator('[data-scene="explication"]')).toHaveAttribute('data-carte', '2');
  await expect(second.getByTestId('phrase-explication')).toContainText('point commun');

  // --- Rejouer repart de la première carte.
  await regie.getByRole('button', { name: 'Rejouer' }).click();
  await expect(explication).toHaveAttribute('data-carte', '1', { timeout: 2_000 });

  // --- Arrêter : retour à l'intro fixe, sur les deux écrans.
  await regie.getByRole('button', { name: "Arrêter l'explication" }).click();
  await expect(ecran.locator('[data-scene="intro"]')).toBeVisible({ timeout: 2_000 });
  await expect(second.locator('[data-scene="intro"]')).toBeVisible({ timeout: 2_000 });
  await expect(regie.getByRole('button', { name: 'Expliquer', exact: true })).toBeVisible();
});
