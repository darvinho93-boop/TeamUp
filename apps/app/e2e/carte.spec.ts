import { expect, test } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

let evenement: { id: string; code: string };

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ langues: ['fr', 'en'] });
  // Le jour en France : celui que lit la carte.
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  await clientService().from('evenements').update({ date_evenement: jour }).eq('id', evenement.id);
});

test.afterAll(() => supprimerEvenements([evenement.id]));

test('la carte Team Up! : cochée à la préparation, la soirée paraît et on s’y inscrit', async ({
  browser,
}) => {
  // --- Rien de coché : l'aide et le lien vers la saisie du code.
  const telephone = await (await browser.newContext()).newPage();
  await telephone.goto('/soirees');
  await expect(telephone.getByRole('heading', { name: 'Ce soir, on Team Up!' })).toBeVisible();
  await expect(telephone.getByTestId('soiree').filter({ hasText: 'Soirée e2e' })).toHaveCount(0);

  // --- Les onglets : les jeux, comment jouer, à propos, puis retour à la soirée.
  const onglets = telephone.getByRole('navigation');
  await onglets.getByRole('link', { name: 'Les jeux' }).click();
  await expect(telephone.getByRole('heading', { level: 1, name: 'Les jeux' })).toBeVisible();
  await expect(telephone.getByRole('heading', { name: 'Points communs' })).toBeVisible();
  // La vidéo d'un jeu : l'explication animée, sa phrase en sous-titre, puis on referme.
  await telephone.getByRole('button', { name: /Voir la vidéo.*Points communs/ }).click();
  const video = telephone.getByRole('dialog');
  await expect(video.getByRole('heading', { name: 'Points communs' })).toBeVisible();
  await expect(telephone.getByTestId('phrase-video')).not.toBeEmpty();
  await video.getByRole('button', { name: 'Fermer' }).click();
  await expect(video).toBeHidden();
  await onglets.getByRole('link', { name: 'Comment jouer' }).click();
  await expect(
    telephone.getByRole('heading', { level: 1, name: 'Comment on y joue' }),
  ).toBeVisible();
  await onglets.getByRole('link', { name: 'À propos' }).click();
  await expect(telephone.getByRole('heading', { level: 1, name: /Qui sommes/ })).toBeVisible();
  await onglets.getByRole('link', { name: 'Ce soir' }).click();
  await expect(telephone.getByRole('heading', { name: 'Ce soir, on Team Up!' })).toBeVisible();

  // --- L'animatrice donne un titre et coche la carte.
  const regie = await (await browser.newContext()).newPage();
  await regie.goto('/regie');
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL('**/regie');
  await regie.goto(`/regie/${evenement.code}/preparation`);
  await regie.getByLabel('Titre affiché sur la carte').fill('Soirée e2e de Léa & Sam');
  await regie.getByLabel('Visible sur la carte Team Up! le jour de la soirée').check();
  await Promise.all([
    regie.waitForResponse((r) => r.request().method() === 'POST' && r.ok()),
    regie.getByRole('button', { name: 'Enregistrer la carte' }).click(),
  ]);
  await expect(regie.getByTestId('carte-statut')).toHaveText(
    'La soirée paraîtra sur la carte le jour J.',
  );

  // --- Le téléphone la voit, passe en anglais et s'inscrit sans repasser par la langue.
  await telephone.reload();
  const carte = telephone.getByTestId('soiree').filter({ hasText: 'Soirée e2e de Léa & Sam' });
  await expect(carte).toHaveCount(1);
  await telephone.getByLabel('Langue').selectOption('en');
  await expect(telephone.getByRole('heading', { name: 'Tonight, we Team Up!' })).toBeVisible();
  await carte.getByRole('link', { name: 'Sign me up' }).click();
  await expect(telephone).toHaveURL(`/${evenement.code}?carte=1`);
  await expect(telephone.getByRole('heading', { name: 'Your first name' })).toBeVisible();
  await expect(telephone.getByRole('button', { name: 'English' })).toHaveCount(0);

  // --- L'adresse du flyer tapée avec un accent et une majuscule mène quand même à la carte.
  await telephone.goto('/Soirées');
  await expect(telephone).toHaveURL('/soirees');
  await expect(telephone.getByRole('heading', { name: 'Tonight, we Team Up!' })).toBeVisible();
});
