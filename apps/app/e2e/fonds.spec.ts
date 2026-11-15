import { fileURLToPath } from 'node:url';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

/**
 * Photos de fond des jeux (2026-11-15) : l'animateur dépose une photo sur un jeu à la
 * préparation ; l'écran commun la montre sous un voile beige pendant le jeu seulement, suit un
 * remplacement en pleine soirée sans recharger, et revient au beige quand elle est retirée.
 */

const PAYSAGE = fileURLToPath(new URL('./fichiers/fond-paysage.jpg', import.meta.url));
const PORTRAIT = fileURLToPath(new URL('./fichiers/fond-portrait.jpg', import.meta.url));
const crees: string[] = [];

test.afterAll(async () => {
  const service = clientService();
  for (const id of crees) {
    const { data } = await service.storage.from('fonds').list(id);
    if (data?.length)
      await service.storage.from('fonds').remove(data.map((f) => `${id}/${f.name}`));
  }
  await supprimerEvenements(crees);
});

async function connecter(browser: Browser, email: string): Promise<Page> {
  const page = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 }, isMobile: false })
  ).newPage();
  await page.goto('/regie');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/regie');
  return page;
}

/** `CAPTURES=<dossier>` : l'écran commun avec sa photo (revue du voile). */
const CAPTURES = process.env['CAPTURES'];

test('une photo de fond par jeu, à l’écran pendant le jeu seulement', async ({ browser }) => {
  test.setTimeout(180_000);
  const service = clientService();

  // --- Une soirée, un quiz d'une question.
  const ev = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
  crees.push(ev.id);
  const { data: questions } = await service
    .from('contenus')
    .select('id')
    .eq('jeu', 'qcm2')
    .eq('actif', true)
    .order('cree_le')
    .limit(1);
  const { data: quiz } = await service
    .from('manches')
    .insert({ evenement_id: ev.id, jeu: 'qcm2', ordre: 1, options: { questions: 1 } })
    .select('id')
    .single();
  const manche = (quiz as { id: string }).id;
  await service.from('passages').insert({
    manche_id: manche,
    evenement_id: ev.id,
    ordre: 1,
    contenu_id: (questions as { id: string }[])[0]!.id,
  });
  const fondEnBase = async () =>
    (
      (await service.from('manches').select('fond').eq('id', manche).single()).data as {
        fond: string | null;
      }
    ).fond;
  const fichiers = async () => (await service.storage.from('fonds').list(ev.id)).data ?? [];

  // --- La préparation : une photo en hauteur et petite, déposée avec ses avertissements.
  const regie = await connecter(browser, 'anna@teamup.test');
  await regie.goto(`/regie/${ev.code}/preparation`);
  const bloc = regie.getByTestId('fond-1');
  await expect(bloc.getByTestId('fond-statut')).toHaveText('Pas de photo : fond beige.');
  // Aperçu d'abord, avec les avertissements : rien ne part avant « Enregistrer ». Le choix est
  // refait tant que la page n'est pas hydratée : un fichier choisi avant est perdu, et React ne
  // voit un nouveau choix que si la valeur du champ change (d'où le champ vidé d'abord).
  await expect(async () => {
    await bloc.getByTestId('fond-fichier').setInputFiles([]);
    await bloc.getByTestId('fond-fichier').setInputFiles(PORTRAIT);
    await expect(bloc.getByTestId('fond-statut')).toHaveText(
      "Aperçu de la nouvelle photo : elle n'est pas encore enregistrée.",
      { timeout: 3000 },
    );
  }).toPass({ timeout: 20_000 });
  await expect(bloc.getByTestId('fond-recadre')).toBeVisible();
  await expect(bloc.getByTestId('fond-petit')).toBeVisible();
  await expect(bloc.getByTestId('fond-apercu')).toHaveAttribute('src', /^blob:/);
  expect(await fondEnBase()).toBeNull();
  await bloc.getByRole('button', { name: 'Enregistrer la photo' }).click();
  await expect(bloc.getByTestId('fond-statut')).toHaveText(
    'Photo en place : elle paraît pendant le jeu.',
    { timeout: 20_000 },
  );
  await expect(bloc.getByTestId('fond-recadre')).toHaveCount(0);
  await expect(bloc.getByTestId('fond-apercu')).toHaveAttribute('src', /token=/);
  const premier = await fondEnBase();
  expect(premier).toMatch(new RegExp(`^${ev.id}/[0-9a-f-]{36}\\.jpg$`));

  // --- L'écran commun.
  const ecran = await (
    await browser.newContext({
      storageState: await regie.context().storageState(),
      viewport: { width: 1920, height: 1080 },
      isMobile: false,
    })
  ).newPage();
  await ecran.goto(`/ecran/${ev.code}`);
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });
  const fond = ecran.getByTestId('fond');
  await expect(fond).toHaveCount(0);

  // --- La présentation reste beige ; le jeu montre la photo, téléchargée d'avance.
  const pilotage = await regie.context().newPage();
  await pilotage.goto(`/regie/${ev.code}/pilotage`);
  await pilotage.getByRole('button', { name: 'Présenter' }).first().click();
  await expect(ecran.locator('[data-scene="intro"]')).toBeVisible({ timeout: 10_000 });
  await expect(fond).toHaveCount(0);
  await pilotage.getByRole('button', { name: 'Commencer le quiz en mode croix' }).click();
  await pilotage.getByRole('button', { name: 'Afficher la question' }).click();
  await expect(fond).toHaveAttribute('data-visible', 'true', { timeout: 10_000 });
  const image = fond.locator('img');
  await expect(image).toHaveAttribute('src', /^blob:/);
  const avant = await image.getAttribute('src');
  // La photo est chargée et couvre toute la scène.
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBeGreaterThan(0);
  // Aperçu de la régie : la même photo.
  await expect(pilotage.getByTestId('fond')).toHaveAttribute('data-visible', 'true');

  // --- Remplacée en pleine soirée : l'écran suit sans recharger, l'ancien fichier part.
  await bloc.getByTestId('fond-fichier').setInputFiles(PAYSAGE);
  await expect(bloc.getByTestId('fond-recadre')).toHaveCount(0);
  await expect(bloc.getByTestId('fond-petit')).toHaveCount(0);
  await bloc.getByRole('button', { name: 'Enregistrer la photo' }).click();
  await expect.poll(fondEnBase, { timeout: 20_000 }).not.toBe(premier);
  await expect.poll(() => image.getAttribute('src'), { timeout: 10_000 }).not.toBe(avant);
  await expect.poll(async () => (await fichiers()).length).toBe(1);
  for (const lettre of ['A', 'B', 'C', 'D']) {
    await pilotage.getByRole('button', { name: `Afficher la réponse ${lettre}` }).click();
  }
  if (CAPTURES) {
    await ecran.waitForTimeout(1000);
    await ecran.screenshot({ path: `${CAPTURES}/fond-quiz.png` });
  }

  // --- Les scores : la photo s'efface.
  await pilotage
    .getByRole('group', { name: 'Scènes' })
    .getByRole('button', { name: 'Scores' })
    .click();
  await expect(ecran.locator('[data-scene="scores"]')).toBeVisible({ timeout: 10_000 });
  await expect(fond).toHaveAttribute('data-visible', 'false');

  // --- Retirée : plus rien en base ni dans le bucket.
  await bloc.getByRole('button', { name: 'Retirer la photo' }).click();
  await bloc.getByRole('button', { name: 'Retirer la photo de fond ?' }).click();
  await expect(bloc.getByTestId('fond-statut')).toHaveText('Pas de photo : fond beige.', {
    timeout: 20_000,
  });
  expect(await fondEnBase()).toBeNull();
  await expect.poll(async () => (await fichiers()).length).toBe(0);
});
