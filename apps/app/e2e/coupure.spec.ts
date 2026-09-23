import { expect, test } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

let evenement: { id: string; code: string };

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
});

test.afterAll(() => supprimerEvenements([evenement.id]));

test('une coupure réseau puis son retour reprennent la session, sans ressaisie', async ({
  page,
  context,
}) => {
  // Une seule langue : on arrive directement au prénom.
  await page.goto(`/${evenement.code}`);
  await page.getByLabel('Prénom').fill('Léo');
  await page.getByRole('button', { name: "C'est parti" }).click();
  await page.getByRole('button', { name: 'Compris' }).click();
  await expect(page.getByRole('heading', { name: 'Salut Léo !' })).toBeVisible();
  await expect(page.getByTestId('points')).toHaveText('0 point');

  await context.setOffline(true);
  await expect(page.getByRole('status')).toContainText('Connexion perdue');

  // Pendant la coupure, la régie marque des points pour l'équipe du joueur.
  const service = clientService();
  const { data: joueur } = await service
    .from('joueurs')
    .select('equipe_id')
    .eq('evenement_id', evenement.id)
    .single();
  await service.from('scores').insert({
    evenement_id: evenement.id,
    equipe_id: joueur!['equipe_id'],
    points: 100,
    motif: 'Test de coupure',
  });

  await context.setOffline(false);
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByTestId('points')).toHaveText('100 points');
  await expect(page.getByRole('heading', { name: 'Salut Léo !' })).toBeVisible();

  // Toujours le même joueur : la reprise n'a créé personne.
  const { count } = await service
    .from('joueurs')
    .select('*', { count: 'exact', head: true })
    .eq('evenement_id', evenement.id);
  expect(count).toBe(1);
});
