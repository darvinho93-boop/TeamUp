import { expect, test, type Browser } from '@playwright/test';
import {
  appeler,
  clientAnimateur,
  creerEvenementJetable,
  supprimerEvenements,
} from '../tests/base';

let evenement: { id: string; code: string };

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 1, langues: ['fr'] });
  // La salle est sur la scène « Équipes », où l'écran montre le nom de chaque équipe.
  const anna = await clientAnimateur('anna@teamup.test');
  const { data: etat } = await appeler<{ pilotage: { version: string } }>(anna, 'etat_ecran', {
    p_code: evenement.code,
  });
  const { erreur } = await appeler(anna, 'enregistrer_etape', {
    p_evenement: evenement.id,
    p_version: etat!.pilotage.version,
    p_pilotage: { scene: 'equipes' },
  });
  if (erreur) throw new Error(erreur);
});

test.afterAll(() => supprimerEvenements([evenement.id]));

async function arriver(browser: Browser, prenom: string, volontaire: boolean) {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`/${evenement.code}`);
  await page.getByLabel('Prénom').fill(prenom);
  await page.getByRole('button', { name: "C'est parti" }).click();
  await expect(page.getByRole('heading', { name: 'Capitaine ?' })).toBeVisible();
  await page.getByRole('button', { name: volontaire ? 'Je me propose' : 'Non merci' }).click();
  await page.getByRole('button', { name: 'Compris' }).click();
  await expect(page.getByText(`Salut ${prenom} !`)).toBeVisible();
  return page;
}

test('un volontaire tiré capitaine renomme son équipe ; la régie peut bloquer le nom', async ({
  browser,
}) => {
  const vera = await arriver(browser, 'Vera', true);
  const nils = await arriver(browser, 'Nils', false);
  await expect(vera.getByRole('button', { name: "Renommer l'équipe" })).toHaveCount(0);

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
  await expect(ecran.locator('.tu-stage-team__nom')).toHaveText('Équipe 1');

  // --- Le tirage : la volontaire devient capitaine, son téléphone le dit.
  await regie.goto(`/regie/${evenement.code}/salle`);
  await regie.getByRole('button', { name: /^Vera/ }).click();
  await expect(regie.getByTestId('fiche-joueur')).toContainText('volontaire');
  await regie.getByRole('button', { name: 'Tirer les capitaines' }).click();
  await expect(regie.getByText('1 capitaine tiré')).toBeVisible();

  await expect(vera.getByTestId('capitaine')).toBeVisible({ timeout: 10_000 });
  await expect(nils.getByTestId('capitaine')).toHaveCount(0);
  await expect(nils.getByRole('button', { name: "Renommer l'équipe" })).toHaveCount(0);

  // --- Elle renomme l'équipe : l'écran suit sans aucune touche de régie.
  await vera.getByRole('button', { name: "Renommer l'équipe" }).click();
  await vera.getByLabel("Nom de l'équipe").fill('Les Invincibles');
  await vera.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(vera.getByText('Les Invincibles')).toBeVisible();
  await expect(ecran.locator('.tu-stage-team__nom')).toHaveText('Les Invincibles', {
    timeout: 3000,
  });

  // --- La régie bloque le nom : le bouton disparaît du téléphone de la capitaine.
  await regie.getByRole('button', { name: 'Bloquer le nom' }).click();
  await expect(regie.getByRole('button', { name: 'Débloquer le nom' })).toBeVisible();
  await expect(vera.getByRole('button', { name: "Renommer l'équipe" })).toHaveCount(0, {
    timeout: 10_000,
  });

  // --- Et la renomme elle-même, nom bloqué ou pas.
  await regie.getByRole('button', { name: 'Renommer' }).click();
  await regie.getByLabel(/^Nom de l'équipe/).fill('Les Étoiles');
  // « Enregistrer le logo » est sur la même page : le nom exact.
  await regie.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(ecran.locator('.tu-stage-team__nom')).toHaveText('Les Étoiles', {
    timeout: 3000,
  });
});
