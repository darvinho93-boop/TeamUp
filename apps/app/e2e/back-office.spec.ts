import { expect, test, type Page } from '@playwright/test';
import { clientService, supprimerEvenements } from '../tests/base';

/**
 * Critère de fin du lot 9 : un admin crée un contenu en trois langues et un animateur le
 * retrouve à la préparation.
 *
 * L'admin crée aussi le compte de cet animateur, avec un mot de passe provisoire. Contre-épreuves :
 * une soirée d'entreprise ne propose ce contenu B2C qu'avec « Tout afficher » ; un contenu en
 * français seul n'est pas proposé à une soirée en trois langues ; un animateur n'entre pas au
 * back-office.
 */

const MARQUE = Date.now().toString(36);
const EMAIL = `animateur-${MARQUE}@teamup.test`;
const MOT_DE_PASSE = `provisoire-${MARQUE}`;
const REPONSE = `les invités venus à vélo ${MARQUE}`;
const REPONSE_FR_SEULE = `les invités en chapeau ${MARQUE}`;
const evenements: string[] = [];

test.afterAll(async () => {
  const service = clientService();
  await supprimerEvenements(evenements);
  const { data } = await service
    .from('contenus_secrets')
    .select('contenu_id')
    .like('valeur->>reponse', `%${MARQUE}`)
    .returns<{ contenu_id: string }[]>();
  const ids = [...new Set((data ?? []).map((c) => c.contenu_id))];
  if (ids.length) await service.from('contenus').delete().in('id', ids);
  const { data: comptes } = await service.auth.admin.listUsers();
  const compte = comptes.users.find((u) => u.email === EMAIL);
  if (compte) await service.auth.admin.deleteUser(compte.id);
});

async function connecter(page: Page, email: string, motDePasse: string, page_: string) {
  await page.goto(page_);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(motDePasse);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(`**${page_}`);
}

/** Un point commun, bloc par bloc ; `langues` dit lesquels remplir. */
async function creerPointCommun(page: Page, reponse: string, langues: string[]) {
  await page.goto('/admin/contenus?jeu=list2');
  await page.getByRole('link', { name: 'Nouveau contenu · Points communs' }).click();
  await page.waitForURL('**/admin/contenus/nouveau?jeu=list2');
  await page.getByLabel('Étiquette').selectOption('b2c');
  const textes: Record<string, [string, string, string, string]> = {
    Français: ['Levez-vous si…', reponse, 'Deux roues', 'Sans moteur'],
    English: ['Stand up if…', `guests who came by bike ${MARQUE}`, 'Two wheels', 'No engine'],
    தமிழ்: [
      'எழுந்திருங்கள்…',
      `மிதிவண்டியில் வந்தவர்கள் ${MARQUE}`,
      'இரு சக்கரம்',
      'இயந்திரம் இல்லை',
    ],
  };
  for (const langue of langues) {
    const bloc = page.getByRole('group', { name: langue });
    const [consigne, rep, indice1, indice2] = textes[langue]!;
    await bloc.getByLabel('Consigne').fill(consigne);
    await bloc.getByLabel('Réponse').fill(langue === 'Français' ? reponse : rep);
    await bloc.getByLabel('Indice 1').fill(indice1);
    await bloc.getByLabel('Indice 2').fill(indice2);
  }
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForURL('**/admin/contenus?jeu=list2');
  await expect(page.getByTestId('contenu').filter({ hasText: reponse })).toBeVisible();
}

/** Une soirée créée depuis la régie, avec un programme Points communs ; rend son code. */
async function creerSoiree(page: Page, type: 'Particulier' | 'Entreprise', langues: string[]) {
  await page.goto('/regie');
  await page.getByLabel('Client').fill(`Lot 9 ${type} ${MARQUE}`);
  await page.getByLabel('Type').selectOption({ label: type });
  await page.getByLabel('Date').fill(new Date().toISOString().slice(0, 10));
  await page.getByLabel("Nombre d'équipes").fill('2');
  for (const langue of langues) await page.getByRole('checkbox', { name: langue }).check();
  await page.getByRole('button', { name: 'Créer et préparer' }).click();
  await page.waitForURL('**/preparation');
  const code = page.url().split('/').at(-2)!;
  const { data } = await clientService().from('evenements').select('id').eq('code', code).single();
  evenements.push((data as { id: string }).id);

  await page.getByRole('button', { name: 'Ajouter Points communs' }).click();
  await expect(page.getByText('1. Points communs')).toBeVisible({ timeout: 15_000 });
  return code;
}

const menu = (page: Page) => page.getByRole('combobox', { name: 'Contenu' }).first();

test('un admin crée un contenu en trois langues, un animateur le retrouve à la préparation', async ({
  page: admin,
  browser,
}) => {
  test.setTimeout(180_000);

  // --- Le back-office : un contenu en trois langues, un autre en français seul, un compte.
  await connecter(admin, 'admin@teamup.test', 'motdepasse', '/admin/contenus');
  await creerPointCommun(admin, REPONSE, ['Français', 'English', 'தமிழ்']);
  await creerPointCommun(admin, REPONSE_FR_SEULE, ['Français']);
  await expect(
    admin.getByTestId('contenu').filter({ hasText: REPONSE_FR_SEULE }).getByRole('listitem'),
  ).toHaveText(['FR complet', 'EN manquant', 'TA manquant']);

  await admin.goto('/admin/animateurs');
  await admin.getByLabel('Nom').fill(`Camille ${MARQUE}`);
  await admin.getByLabel('E-mail').fill(EMAIL);
  await admin.getByLabel('Mot de passe provisoire').fill(MOT_DE_PASSE);
  await admin.getByRole('button', { name: 'Créer le compte' }).click();
  await expect(admin.getByRole('status')).toHaveText(`Compte créé pour Camille ${MARQUE}.`);
  await expect(admin.getByTestId('animateur').filter({ hasText: EMAIL })).toContainText('actif');

  // --- L'animateur, sur son propre appareil, avec le mot de passe provisoire.
  const appareil = await browser.newContext();
  const animateur = await appareil.newPage();
  await connecter(animateur, EMAIL, MOT_DE_PASSE, '/regie');

  await creerSoiree(animateur, 'Particulier', ['English', 'தமிழ்']);
  const options = menu(animateur).locator('option');
  await expect(options.filter({ hasText: REPONSE })).toHaveCount(1);
  await expect(options.filter({ hasText: REPONSE_FR_SEULE })).toHaveCount(0);
  // Le choix part par une action serveur : on attend qu'elle ait répondu avant de relire.
  const enregistre = animateur.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/preparation'),
  );
  await menu(animateur).selectOption({ label: REPONSE });
  await enregistre;
  await animateur.reload();
  await expect(menu(animateur).locator('option:checked')).toHaveText(REPONSE);

  // Une soirée d'entreprise : le contenu B2C n'y vient qu'en levant le filtre.
  await creerSoiree(animateur, 'Entreprise', []);
  await expect(menu(animateur).locator('option').filter({ hasText: REPONSE })).toHaveCount(0);
  await animateur.getByRole('link', { name: 'Tout afficher' }).click();
  await expect(menu(animateur).locator('option').filter({ hasText: REPONSE })).toHaveCount(1);
  await expect(menu(animateur).locator('option').filter({ hasText: REPONSE_FR_SEULE })).toHaveCount(
    1,
  );

  // Le back-office reste fermé à un animateur.
  const reponse = await animateur.goto('/admin/contenus');
  expect(reponse?.status()).toBe(404);

  await appareil.close();
});
