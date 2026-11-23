import { expect, test, type Browser } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

/**
 * Cartes « Faisons connaissance » (2026-11-18) : deux joueurs de la même équipe remplissent leur
 * carte, l'un avec l'accord d'affichage, l'autre sans ; après un jeu, la régie tire une carte
 * (seule celle autorisée peut sortir), la voit seule, puis l'affiche ; l'écran célèbre l'équipe
 * et présente la carte ; un rechargement ne retire pas au sort.
 */
let evenement: { id: string; code: string };

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
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

test('une carte autorisée se tire, se voit à la régie, puis à l’écran', async ({ browser }) => {
  const ana = await arriver(browser, 'Ana');
  const bao = await arriver(browser, 'Bao');
  const service = clientService();

  // Les deux dans l'équipe 1, un jeu terminé où elle a marqué.
  const { data: eqs } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id)
    .order('numero');
  const [equipe1] = eqs as { id: string; numero: number }[];
  await service.from('joueurs').update({ equipe_id: equipe1!.id }).eq('evenement_id', evenement.id);
  const { data: manche } = await service
    .from('manches')
    .insert({ evenement_id: evenement.id, jeu: 'qcm2', ordre: 1, statut: 'terminee' })
    .select('id')
    .single();
  await service.from('scores').insert({
    evenement_id: evenement.id,
    equipe_id: equipe1!.id,
    manche_id: (manche as { id: string }).id,
    points: 300,
    motif: 'test',
  });

  // --- Ana remplit sa carte et accepte l'affichage ; l'aperçu suit la saisie.
  await ana.getByRole('button', { name: 'Créer ma carte' }).click();
  await ana.getByLabel('Quel âge avez-vous').fill('34');
  await ana.getByLabel('Que faites-vous dans la vie').fill('Infirmière');
  await ana.getByLabel('Une anecdote à votre sujet').fill('Je joue de la batterie.');
  await expect(ana.getByTestId('carte-apercu')).toContainText('34 ans · Infirmière');
  await ana.getByTestId('carte-accord').check();
  await ana.getByRole('button', { name: 'Enregistrer ma carte' }).click();
  await expect(ana.getByTestId('carte-merci')).toContainText('Votre carte est enregistrée.');

  // --- Bao remplit la sienne sans accepter l'affichage.
  await bao.getByRole('button', { name: 'Créer ma carte' }).click();
  await bao.getByLabel('Que faites-vous dans la vie').fill('Pilote de ligne');
  await bao.getByRole('button', { name: 'Enregistrer ma carte' }).click();
  await expect(bao.getByTestId('carte-merci')).toContainText('ne sera pas affichée');

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

  // --- La régie tire : seule Ana peut sortir ; l'aperçu reste à la régie.
  await regie.goto(`/regie/${evenement.code}/pilotage`);
  const panneau = regie.getByTestId('panneau-connaissance');
  await expect(panneau.getByTestId('cartes-pretes')).toContainText('1 carte prête sur 2 joueurs');
  await expect(panneau.getByTestId('connaissance-equipe')).toContainText('300 points');
  await panneau.getByTestId('tirer-carte').click();
  const apercu = panneau.getByTestId('apercu-carte');
  await expect(apercu).toContainText('Ana', { timeout: 10_000 });
  await expect(apercu).toContainText('Je joue de la batterie.');
  await expect(ecran.locator('[data-scene="connaissance"]')).toHaveCount(0);

  // --- Affichée : l'équipe célébrée, puis la carte d'Ana ; jamais celle de Bao.
  await panneau.getByTestId('afficher-carte').click();
  await expect(ecran.getByTestId('connaissance-bravo')).toContainText('Bravo à toute l', {
    timeout: 5000,
  });
  const carte = ecran.getByTestId('connaissance-carte');
  await expect(carte).toContainText('Faisons connaissance avec Ana', { timeout: 5000 });
  await expect(carte).toContainText('34 ans · Infirmière');
  await expect(carte).toContainText('Je joue de la batterie.');
  await expect(ecran.locator('[data-scene="connaissance"]')).not.toContainText('Pilote de ligne');
  await expect(ecran.getByTestId('connaissance-membres')).toContainText('Bao');

  // --- Un rechargement retombe sur la même carte, sans nouveau tirage.
  await ecran.reload();
  await expect(ecran.getByTestId('connaissance-carte')).toContainText('Ana', { timeout: 15_000 });
  const { count } = await service
    .from('tirages_cartes')
    .select('*', { count: 'exact', head: true })
    .eq('evenement_id', evenement.id);
  expect(count).toBe(1);

  // --- Ana voit que sa carte est passée à l'écran.
  await expect(async () => {
    await ana.reload();
    await ana.getByRole('button', { name: 'Ma carte' }).click();
    await expect(ana.getByTestId('carte-merci')).toContainText('déjà été présentée');
  }).toPass({ timeout: 15_000 });
});
