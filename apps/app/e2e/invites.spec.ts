import { expect, test } from '@playwright/test';
import { creerEvenementJetable, supprimerEvenements } from '../tests/base';

let evenement: { id: string; code: string };

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
});

test.afterAll(() => supprimerEvenements([evenement.id]));

test('invités sans téléphone : ajoutés par la régie et par un joueur autorisé', async ({
  browser,
}) => {
  // --- Paul arrive avec son téléphone : rien pour ajouter tant que la régie ne l'autorise pas.
  const telephone = await (await browser.newContext()).newPage();
  await telephone.goto(`/${evenement.code}`);
  await telephone.getByLabel('Prénom').fill('Paul');
  await telephone.getByRole('button', { name: "C'est parti" }).click();
  await telephone.getByRole('button', { name: 'Compris' }).click();
  await expect(telephone.getByText('Salut Paul !')).toBeVisible();
  await expect(telephone.getByRole('button', { name: 'Ajouter un invité' })).toHaveCount(0);

  // --- L'animatrice ajoute Odile, puis autorise Paul.
  const regie = await (await browser.newContext()).newPage();
  await regie.goto('/regie');
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL('**/regie');
  await regie.goto(`/regie/${evenement.code}/salle`);

  const ajout = regie.getByTestId('ajout-invite');
  await ajout.getByLabel('Prénom').fill('Odile');
  await ajout.getByRole('button', { name: 'Ajouter' }).click();
  await expect(ajout.getByText(/Odile rejoint Équipe \d/)).toBeVisible();
  await expect(regie.getByRole('button', { name: /Odile.*sans téléphone/ })).toBeVisible();

  await regie.getByRole('button', { name: /^Paul/ }).click();
  const fiche = regie.getByTestId('fiche-joueur');
  await fiche.getByRole('button', { name: 'Autoriser à ajouter des invités' }).click();
  await expect(
    fiche.getByRole('button', { name: "Retirer l'autorisation d'ajouter" }),
  ).toBeVisible();

  // --- Le bouton paraît sur le téléphone de Paul à la relecture suivante ; il ajoute Léa.
  await expect(telephone.getByRole('button', { name: 'Ajouter un invité' })).toBeVisible({
    timeout: 10_000,
  });
  await telephone.getByRole('button', { name: 'Ajouter un invité' }).click();
  await telephone.getByLabel('Son prénom').fill('Léa');
  await telephone.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(telephone.getByRole('heading', { name: /Léa rejoint Équipe \d/ })).toBeVisible();
  await telephone.getByRole('button', { name: 'Retour' }).click();
  await expect(telephone.getByText('Salut Paul !')).toBeVisible();

  // --- La Salle compte trois joueurs, dont deux sans téléphone.
  await regie.reload();
  await expect(regie.getByText(/3 joueurs/)).toBeVisible();
  await expect(regie.getByRole('button', { name: /Léa.*sans téléphone/ })).toBeVisible();
  await expect(regie.getByRole('button', { name: /Paul.*peut ajouter des invités/ })).toBeVisible();
});
