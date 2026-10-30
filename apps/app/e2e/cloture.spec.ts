import { expect, test } from '@playwright/test';
import { creerEvenementJetable, supprimerEvenements } from '../tests/base';

/**
 * Clôture de la soirée depuis la régie (2026-10-30) : le téléphone d'un invité passe sur « La
 * partie est terminée » sans recharger, plus personne ne peut rejoindre ; rouvrir rend l'arrivée.
 */
let evenement: { id: string; code: string };

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 1, langues: ['fr'] });
});

test.afterAll(() => supprimerEvenements([evenement.id]));

test('la régie clôture la soirée, puis la rouvre', async ({ browser, request }) => {
  const invite = await (await browser.newContext()).newPage();
  const r = await invite.request.post(`/api/partie/${evenement.code}/rejoindre`, {
    data: { prenom: 'Vera', langue: 'fr', volontaire: false },
  });
  expect(r.status()).toBe(200);
  await invite.goto(`/${evenement.code}`);
  await expect(invite.getByText('Salut Vera !')).toBeVisible();

  const regie = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 }, isMobile: false })
  ).newPage();
  await regie.goto('/regie');
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL('**/regie');
  await regie.goto(`/regie/${evenement.code}/scores`);

  // Un premier appui arme, le second clôture.
  await regie.getByRole('button', { name: 'Clôturer la soirée' }).click();
  await regie.getByRole('button', { name: 'Toucher encore pour clôturer' }).click();
  await expect(regie.getByTestId('cloture').getByRole('status')).toContainText('Soirée clôturée à');
  // À l'heure de France, même quand le serveur tourne en UTC (Vercel) : la page est relue après
  // l'action, rendue par le serveur.
  const heure = (decalageMs: number) =>
    new Intl.DateTimeFormat('fr', { timeStyle: 'short', timeZone: 'Europe/Paris' }).format(
      Date.now() + decalageMs,
    );
  await regie.reload();
  const affichee = await regie.getByTestId('cloture').getByRole('status').textContent();
  expect(
    [heure(0), heure(-60_000)].some((h) => affichee?.includes(h)),
    affichee ?? '',
  ).toBe(true);

  // Le téléphone le voit sans recharger (signal, ou relecture de sûreté de 4 s).
  await expect(invite.getByText('La partie est terminée.')).toBeVisible({ timeout: 10_000 });
  // Plus d'arrivée.
  const refus = await request.post(`/api/partie/${evenement.code}/rejoindre`, {
    data: { prenom: 'Nils', langue: 'fr', volontaire: false },
  });
  expect(refus.status()).not.toBe(200);
  // « Non clôturée » ne s'applique qu'aux soirées passées : celle-ci dit « terminé ».
  await regie.goto('/regie');
  await expect(regie.getByText('terminé').first()).toBeVisible();

  // Rouvrir : l'arrivée revient.
  await regie.goto(`/regie/${evenement.code}/scores`);
  await regie.getByRole('button', { name: 'Rouvrir la soirée' }).click();
  await regie.getByRole('button', { name: 'Toucher encore pour rouvrir' }).click();
  await expect(regie.getByRole('button', { name: 'Clôturer la soirée' })).toBeVisible();
  const retour = await request.post(`/api/partie/${evenement.code}/rejoindre`, {
    data: { prenom: 'Nils', langue: 'fr', volontaire: false },
  });
  expect(retour.status()).toBe(200);
});
