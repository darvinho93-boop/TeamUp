import { expect, test, type Browser } from '@playwright/test';
import { creerEvenementJetable, supprimerEvenements } from '../tests/base';

// Messages sur le grand écran (2026-11-15) : un joueur écrit, la bulle paraît à l'écran sans
// touche de régie ; la régie retire, écrit sous « Team Up! », ferme les envois.

let evenement: { id: string; code: string };

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
});

test.afterAll(() => supprimerEvenements([evenement.id]));

async function arriver(browser: Browser, prenom: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`/${evenement.code}`);
  await page.getByLabel('Prénom').fill(prenom);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Confirmer mon inscription' }).click();
  await expect(page.getByText(`Bienvenue, ${prenom}`)).toBeVisible();
  return page;
}

test('un joueur écrit sur le grand écran ; la régie retire, écrit et ferme les envois', async ({
  browser,
}) => {
  const zoe = await arriver(browser, 'Zoé');

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

  // --- Le joueur écrit : la bulle paraît, avec son prénom, sans aucune touche de régie.
  await zoe.getByTestId('ouvrir-message').click();
  await zoe.getByLabel('Votre message').fill('  Vive les\nmariés ! 🎉 ');
  await zoe.getByRole('button', { name: 'Publier sur le grand écran' }).click();
  await expect(zoe.getByTestId('statut-message')).toHaveText(
    'Votre message a été envoyé au grand écran.',
  );
  const bulle = ecran.getByTestId('bulle').filter({ hasText: 'Zoé' });
  await expect(bulle).toContainText('Vive les mariés ! 🎉', { timeout: 3000 });

  // La bulle tient dans la scène, dans son quart bas droit (loin des marques du haut).
  const cadre = (await ecran.locator('.tu-stage').first().boundingBox())!;
  const boite = (await bulle.boundingBox())!;
  expect(boite.x + boite.width).toBeLessThanOrEqual(cadre.x + cadre.width);
  expect(boite.y + boite.height).toBeLessThanOrEqual(cadre.y + cadre.height);
  expect(boite.x).toBeGreaterThan(cadre.x + cadre.width / 2);
  expect(boite.y).toBeGreaterThan(cadre.y + cadre.height / 2);

  // Un second message tout de suite : le téléphone fait attendre.
  await expect(zoe.locator('dialog[open]')).toHaveCount(0);
  await zoe.getByTestId('ouvrir-message').click();
  await expect(zoe.getByTestId('statut-message')).toContainText('Prochain message dans');
  await expect(zoe.getByRole('button', { name: 'Publier sur le grand écran' })).toBeDisabled();
  await zoe.getByRole('button', { name: 'Annuler' }).click();

  // --- La régie retire le message : il quitte l'écran tout de suite.
  await regie.goto(`/regie/${evenement.code}/pilotage`);
  const panneau = regie.getByTestId('panneau-messages');
  const ligne = panneau.getByTestId('message-regie').filter({ hasText: 'Vive les mariés' });
  await expect(ligne).toContainText('Zoé');
  await ligne.getByRole('button', { name: 'Retirer' }).click();
  await expect(ligne.getByRole('button', { name: 'Remettre' })).toBeVisible();
  await expect(bulle).toHaveCount(0, { timeout: 3000 });

  // --- La régie écrit sous « Team Up! ».
  await panneau.getByLabel('Message de Team Up!').fill('Place au Quiz !');
  await panneau.getByRole('button', { name: "Envoyer à l'écran" }).click();
  await expect(ecran.locator('.tu-bulle--regie')).toContainText('Place au Quiz !', {
    timeout: 3000,
  });

  // --- Envois fermés : le bouton quitte le téléphone (à sa relecture) et la route refuse.
  await panneau.getByTestId('messages-ouverts').click();
  await expect(panneau.getByTestId('messages-ouverts')).toHaveText('Envois des joueurs fermés');
  await expect(zoe.getByTestId('ouvrir-message')).toHaveCount(0, { timeout: 10_000 });
  const refus = await zoe.request.post(`/api/partie/${evenement.code}/message`, {
    data: { texte: 'Encore moi' },
  });
  expect(refus.status()).toBe(403);
});
