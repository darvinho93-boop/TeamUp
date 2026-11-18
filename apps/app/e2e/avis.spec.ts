import { expect, test, type Browser } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

/**
 * Avis des joueurs en fin de soirée (2026-11-18) : la régie ouvre le questionnaire, l'écran
 * invite à répondre dans la scène Clôture, deux téléphones répondent (l'un anonyme avec ce qui a
 * moins plu, l'autre citable, « Rien à redire »), la page Avis et son export les montrent ; fermé,
 * le bouton disparaît ; rouvert après la clôture de la soirée, il revient.
 */
let evenement: { id: string; code: string };

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 1, langues: ['fr'] });
});

test.afterAll(() => supprimerEvenements([evenement.id]));

async function arriver(browser: Browser, prenom: string) {
  const page = await (await browser.newContext()).newPage();
  const r = await page.request.post(`/api/partie/${evenement.code}/rejoindre`, {
    data: { prenom, langue: 'fr', volontaire: false },
  });
  expect(r.status()).toBe(200);
  await page.goto(`/${evenement.code}`);
  await expect(page.getByText(`Bienvenue, ${prenom}`)).toBeVisible();
  return page;
}

test('les joueurs donnent leur avis ; la régie les ouvre, les lit et les ferme', async ({
  browser,
}) => {
  const vera = await arriver(browser, 'Vera');
  const nils = await arriver(browser, 'Nils');
  const donnerMonAvis = (page: typeof vera) =>
    page.getByRole('button', { name: 'Donner mon avis' });
  // Fermé par défaut : aucun bouton.
  await expect(donnerMonAvis(vera)).toHaveCount(0);

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

  // --- La régie passe sur la Clôture, puis ouvre le questionnaire.
  await regie.goto(`/regie/${evenement.code}/pilotage`);
  await regie.getByRole('button', { name: 'Clôture', exact: true }).click();
  await expect(ecran.getByTestId('merci')).toBeVisible({ timeout: 5000 });
  await expect(ecran.getByTestId('invitation-avis')).toHaveCount(0);
  const panneau = regie.getByTestId('panneau-avis');
  await panneau.getByTestId('avis-ouverts').click();
  await expect(panneau.getByTestId('avis-ouverts')).toHaveText('Questionnaire ouvert');
  await expect(ecran.getByTestId('invitation-avis')).toContainText(
    'Donnez votre avis sur votre téléphone',
    { timeout: 5000 },
  );

  // --- Vera : trois choses aimées, puis ce qui lui a moins plu ; anonyme.
  await donnerMonAvis(vera).click({ timeout: 10_000 });
  await vera.getByLabel(/Coup de cœur n°\s1/).fill('Le quiz aux jetons');
  await vera.getByLabel(/Coup de cœur n°\s2/).fill("  L'ambiance ");
  await vera.getByLabel(/Coup de cœur n°\s3/).fill('Le podium');
  await vera.getByRole('button', { name: 'Suivant' }).click();
  await vera.getByLabel('Votre remarque').fill('Le son un peu fort');
  await vera.getByRole('button', { name: 'Envoyer' }).click();
  await expect(vera.getByTestId('avis-merci')).toBeVisible();

  // --- Nils : une chose aimée, citable, « Rien à redire » ; sans rien écrire, refusé d'abord.
  await donnerMonAvis(nils).click({ timeout: 10_000 });
  await nils.getByRole('button', { name: 'Suivant' }).click();
  await expect(nils.getByText('Écrivez au moins une chose que vous avez aimée.')).toBeVisible();
  await nils.getByLabel(/Coup de cœur n°\s1/).fill('Tout !');
  await nils.getByTestId('avis-citable').check();
  await nils.getByRole('button', { name: 'Suivant' }).click();
  await nils.getByRole('button', { name: 'Rien à redire' }).click();
  await expect(nils.getByTestId('avis-merci')).toBeVisible();

  // --- La régie compte les avis en direct, puis les lit.
  await expect(panneau.getByTestId('avis-recus')).toHaveText('2 avis reçus', { timeout: 5000 });
  await regie.goto(`/regie/${evenement.code}/avis`);
  await expect(regie.getByTestId('avis-synthese')).toContainText('2 avis sur 2 joueurs');
  const cartes = regie.getByTestId('avis');
  await expect(cartes).toHaveCount(2);
  await expect(cartes.filter({ hasText: 'Le quiz aux jetons' })).toContainText(
    'Le son un peu fort',
  );
  await expect(regie.getByTestId('avis-prenom')).toHaveCount(1);
  await expect(regie.getByTestId('avis-prenom')).toContainText('Nils');
  await expect(cartes.filter({ hasText: 'Le quiz aux jetons' })).not.toContainText('Vera');

  const csv = await regie.request.get(`/regie/${evenement.code}/export/avis.csv`);
  expect(csv.status()).toBe(200);
  const texte = await csv.text();
  expect(texte).toContain("Le quiz aux jetons;L'ambiance;Le podium;Le son un peu fort;");
  expect(texte).toContain('Tout !;;;Rien à redire;Nils');

  // --- Le bouton du téléphone dit que l'avis est donné.
  await vera.getByRole('button', { name: 'Retour' }).click();
  await expect(vera.getByRole('button', { name: 'Mon avis' })).toBeVisible();

  // --- Fermé : le bouton disparaît des téléphones, l'invitation de l'écran.
  await regie.goto(`/regie/${evenement.code}/pilotage`);
  await regie.getByTestId('panneau-avis').getByTestId('avis-ouverts').click();
  await expect(regie.getByTestId('avis-ouverts')).toHaveText('Questionnaire fermé');
  await expect(vera.getByRole('button', { name: 'Mon avis' })).toHaveCount(0, {
    timeout: 10_000,
  });
  await expect(ecran.getByTestId('invitation-avis')).toHaveCount(0, { timeout: 5000 });

  // --- Soirée clôturée, questionnaire rouvert : le bouton revient sous « partie terminée ».
  await clientService()
    .from('evenements')
    .update({ statut: 'termine', termine_le: new Date().toISOString() })
    .eq('id', evenement.id);
  await regie.getByTestId('panneau-avis').getByTestId('avis-ouverts').click();
  await expect(vera.getByText('La partie est terminée')).toBeVisible({ timeout: 10_000 });
  await expect(vera.getByRole('button', { name: 'Mon avis' })).toBeVisible({ timeout: 10_000 });
});
