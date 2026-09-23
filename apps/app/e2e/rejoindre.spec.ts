import { expect, test } from '@playwright/test';
import { creerEvenementJetable, supprimerEvenements } from '../tests/base';

let evenement: { id: string; code: string };

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr', 'en', 'ta'] });
});

test.afterAll(() => supprimerEvenements([evenement.id]));

test('du code tapé à la main jusqu’à l’attente, puis retour sans ressaisie', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Caractère 1').click();
  await page.keyboard.type(evenement.code.toLowerCase());
  await page.getByRole('button', { name: 'Rejoindre' }).click();
  await expect(page).toHaveURL(`/${evenement.code}`);

  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Your first name' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.getByRole('button', { name: "Let's go" }).click();
  await expect(page.getByText('Type your first name.')).toBeVisible();

  await page.getByLabel('First name').fill('Asha');
  await page.getByRole('button', { name: "Let's go" }).click();
  await expect(page.getByText('Your team')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Équipe 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('heading', { name: 'Hi Asha!' })).toBeVisible();

  // Même téléphone, page rechargée : la session est dans le cookie.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hi Asha!' })).toBeVisible();
  await expect(page.getByLabel('First name')).toHaveCount(0);

  // Et le QR rescanné (nouvelle navigation vers la même adresse) aussi.
  await page.goto(`/${evenement.code}`);
  await expect(page.getByRole('heading', { name: 'Hi Asha!' })).toBeVisible();
});

test('un code inconnu renvoie à la saisie, avec un message', async ({ page }) => {
  await page.goto('/ZZZZZZ');
  // En production, Next ajoute son propre annonceur de route (role=alert) : on vise le texte.
  await expect(page.getByText("Ce code n'ouvre aucune partie")).toBeVisible();
});
