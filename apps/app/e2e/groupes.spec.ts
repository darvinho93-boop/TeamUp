import { expect, test } from '@playwright/test';
import { creerEvenementJetable, supprimerEvenements } from '../tests/base';

let evenement: { id: string; code: string };
let sansGroupes: { id: string; code: string };

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
  sansGroupes = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
});

test.afterAll(() => supprimerEvenements([evenement.id, sansGroupes.id]));

test('groupes nommés à la préparation, choisis au téléphone, comptés à la Salle', async ({
  browser,
}) => {
  // --- L'animatrice nomme deux groupes.
  const regie = await (await browser.newContext()).newPage();
  await regie.goto('/regie');
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL('**/regie');

  await regie.goto(`/regie/${evenement.code}/preparation`);
  await regie.getByLabel('Nom du groupe 1').fill('Côté mariée');
  await regie.getByLabel('Nom du groupe 2').fill('Côté marié');
  // Le champ garde ce qu'on a tapé : c'est la réponse de l'action qui dit que c'est enregistré.
  await Promise.all([
    regie.waitForResponse((r) => r.request().method() === 'POST' && r.ok()),
    regie.getByRole('button', { name: 'Enregistrer les groupes' }).click(),
  ]);

  // --- Un invité choisit son côté.
  const telephone = await (await browser.newContext()).newPage();
  await telephone.goto(`/${evenement.code}`);
  await telephone.getByLabel('Prénom').fill('Lina');
  await telephone.getByRole('button', { name: "C'est parti" }).click();
  await expect(telephone.getByRole('heading', { name: 'Ton groupe' })).toBeVisible();
  await expect(telephone.getByRole('button', { name: 'Je préfère ne pas répondre' })).toBeVisible();
  await telephone.getByRole('button', { name: 'Côté mariée' }).click();
  await expect(telephone.getByText('Ton équipe')).toBeVisible();

  // --- Un autre préfère ne pas répondre : il rejoint quand même.
  const discret = await (await browser.newContext()).newPage();
  await discret.goto(`/${evenement.code}`);
  await discret.getByLabel('Prénom').fill('Noé');
  await discret.getByRole('button', { name: "C'est parti" }).click();
  await discret.getByRole('button', { name: 'Je préfère ne pas répondre' }).click();
  await expect(discret.getByText('Ton équipe')).toBeVisible();

  // --- La Salle montre la répartition à l'arrivée : un seul invité compté, côté mariée.
  await regie.goto(`/regie/${evenement.code}/salle`);
  const compteurs = regie.getByTestId('groupes');
  await expect(compteurs).toHaveCount(2);
  await expect(compteurs.filter({ hasText: 'Côté mariée 1' })).toHaveCount(1);
  await expect(compteurs.filter({ hasText: 'Côté mariée 0 · Côté marié 0' })).toHaveCount(1);
});

test('une soirée sans groupes saute l’étape', async ({ page }) => {
  await page.goto(`/${sansGroupes.code}`);
  await page.getByLabel('Prénom').fill('Sam');
  await page.getByRole('button', { name: "C'est parti" }).click();
  await expect(page.getByText('Ton équipe')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ton groupe' })).toHaveCount(0);
});
