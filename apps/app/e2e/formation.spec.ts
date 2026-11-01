import { expect, test, type Browser, type Page } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

/**
 * Lot 14 : les invités s'inscrivent sans équipe (nom d'équipe proposé par les volontaires, page
 * d'explication) ; la régie forme les équipes à la Salle, ce qui tire les passages de Points
 * communs dans la réserve ; le tirage de l'ordre et « Commencer » fonctionnent ; « Refaire les
 * équipes » en change le nombre. C'est aussi le parcours qui a manqué le 2026-10-31.
 */

let evenement: { id: string; code: string };
let manche: string;

test.beforeAll(async () => {
  // Une soirée sans équipe (comme toute soirée créée depuis le lot 14), un Points communs en
  // réserve de quatre consignes.
  evenement = await creerEvenementJetable({ equipes: 0, langues: ['fr'] });
  const service = clientService();
  await service.from('evenements').update({ equipes_prevues: 3 }).eq('id', evenement.id);
  const { data: contenus } = await service
    .from('contenus')
    .select('id, contenus_traductions!inner(langue)')
    .eq('jeu', 'list2')
    .eq('actif', true)
    .eq('contenus_traductions.langue', 'fr')
    .limit(4);
  const reserve = (contenus as { id: string }[]).map((c) => c.id);
  expect(reserve).toHaveLength(4);
  const { data } = await service
    .from('manches')
    .insert({
      evenement_id: evenement.id,
      jeu: 'list2',
      ordre: 1,
      options: { passages_par_equipe: 1, reserve },
    })
    .select('id')
    .single();
  manche = (data as { id: string }).id;
});

test.afterAll(() => supprimerEvenements([evenement.id]));

async function inscrire(browser: Browser, prenom: string, nom?: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`/${evenement.code}`);
  await page.getByLabel('Prénom').fill(prenom);
  await page.getByRole('button', { name: "C'est parti" }).click();
  await expect(page.getByRole('heading', { name: 'Capitaine ?' })).toBeVisible();
  if (nom) {
    await page.getByRole('button', { name: 'Je me propose' }).click();
    await page.getByLabel("Nom d'équipe (facultatif)").fill(nom);
    await page.getByRole('button', { name: "C'est parti" }).click();
  } else {
    await page.getByRole('button', { name: 'Non merci' }).click();
  }
  // Pas d'équipe encore : la page d'explication, puis l'attente.
  await expect(page.getByTestId('explication')).toBeVisible();
  await expect(page.getByTestId('explication')).toContainText('Points communs');
  await page.getByTestId('c-est-parti').click();
  await expect(page.getByTestId('sans-equipe')).toBeVisible();
  return page;
}

test('inscription sans équipe, formation par la régie, puis Points communs', async ({
  browser,
}) => {
  test.setTimeout(180_000);

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

  // --- Six inscrits, dont deux volontaires qui proposent un nom.
  const lea = await inscrire(browser, 'Léa', 'Les Lions');
  await expect(lea.getByTestId('nom-propose')).toContainText('Les Lions');
  await inscrire(browser, 'Tom', 'Les Aigles');
  const autres = [];
  for (const prenom of ['Ana', 'Ben', 'Cyril', 'Dina'])
    autres.push(await inscrire(browser, prenom));

  // Léa change d'avis sur le nom.
  await lea.getByRole('button', { name: 'Changer le nom proposé' }).click();
  await lea.getByLabel("Nom d'équipe").fill('Les Tigres');
  await lea.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(lea.getByTestId('nom-propose')).toContainText('Les Tigres');

  // --- La scène « Équipes » avant la formation : les inscrits.
  await regie.goto(`/regie/${evenement.code}/pilotage`);
  await regie
    .getByRole('group', { name: 'Scènes' })
    .getByRole('button', { name: 'Équipes' })
    .click();
  await expect(ecran.getByTestId('equipes-a-venir')).toContainText('6 joueurs', { timeout: 5000 });

  // --- La régie forme 3 équipes à la Salle.
  await regie.goto(`/regie/${evenement.code}/salle`);
  await expect(regie.getByTestId('noms-proposes')).toContainText('Les Tigres');
  await expect(regie.getByTestId('nombre-equipes')).toHaveValue('3');
  await regie.getByTestId('former-equipes').click();
  await regie.getByRole('button', { name: 'Confirmer : 3 équipes' }).click();
  await expect(regie.getByTestId('refaire-equipes')).toBeVisible({ timeout: 15_000 });

  // Les noms des volontaires, sur l'écran et sur leur téléphone.
  const noms = ecran.locator('.tu-stage-team__nom');
  await expect(noms).toHaveCount(3, { timeout: 5000 });
  await expect(noms.filter({ hasText: 'Les Tigres' })).toHaveCount(1);
  await expect(noms.filter({ hasText: 'Les Aigles' })).toHaveCount(1);
  await expect(lea.getByText('Les Tigres')).toBeVisible({ timeout: 10_000 });
  await expect(lea.getByTestId('capitaine')).toBeVisible();
  for (const page of autres) await expect(page.getByTestId('sans-equipe')).toHaveCount(0);

  // Points communs : un passage par équipe, tiré dans la réserve.
  const compter = async () =>
    (await clientService().from('passages').select('equipe_id, contenu_id').eq('manche_id', manche))
      .data as { equipe_id: string; contenu_id: string }[];
  expect(await compter()).toHaveLength(3);

  // --- Refaire en 2 équipes : 2 passages.
  await regie.getByTestId('nombre-equipes').fill('2');
  await regie.getByTestId('refaire-equipes').click();
  await regie.getByRole('button', { name: 'Confirmer : tout refaire' }).click();
  await expect(noms).toHaveCount(2, { timeout: 10_000 });
  await expect.poll(async () => (await compter()).length).toBe(2);

  // --- Le pilotage : présenter, tirer l'ordre, commencer. Plus de page blanche.
  await regie.goto(`/regie/${evenement.code}/pilotage`);
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await regie.getByRole('button', { name: "Tirer l'ordre de passage" }).click();
  // L'écran anime le tirage, puis range les deux équipes (lot 13).
  await expect(ecran.locator('[data-scene="tirage-ordre"]')).toHaveAttribute('data-rangees', '2', {
    timeout: 10_000,
  });
  await regie.getByRole('button', { name: 'Commencer : Points communs' }).click();
  await expect(ecran.locator('[data-scene="list2"][data-etape="pret"]')).toBeVisible({
    timeout: 5000,
  });

  // Une fois un jeu commencé, on ne refait plus les équipes.
  await regie.goto(`/regie/${evenement.code}/salle`);
  await expect(regie.getByTestId('formation')).toHaveCount(0);
});

test("une équipe supprimée n'a plus de passage, et un passage orphelin se passe", async ({
  browser,
}) => {
  // La panne du 2026-10-31, rejouée : on retire une équipe d'une soirée formée, puis on force un
  // passage sans équipe en base (comme ABXNJK), la régie le passe.
  const soiree = await creerEvenementJetable({ equipes: 3, langues: ['fr'] });
  const service = clientService();
  try {
    const { data: equipes } = await service
      .from('equipes')
      .select('id, numero')
      .eq('evenement_id', soiree.id)
      .order('numero');
    const { data: contenus } = await service
      .from('contenus')
      .select('id')
      .eq('jeu', 'list2')
      .limit(3);
    const { data: m } = await service
      .from('manches')
      .insert({ evenement_id: soiree.id, jeu: 'list2', ordre: 1, options: {} })
      .select('id')
      .single();
    const mancheId = (m as { id: string }).id;
    const eqs = equipes as { id: string }[];
    await service.from('passages').insert(
      eqs.map((e, i) => ({
        manche_id: mancheId,
        evenement_id: soiree.id,
        equipe_id: e.id,
        ordre: i + 1,
        contenu_id: (contenus as { id: string }[])[i]!.id,
      })),
    );
    await service.from('equipes').delete().eq('id', eqs[2]!.id);
    const { count } = await service
      .from('passages')
      .select('*', { count: 'exact', head: true })
      .eq('manche_id', mancheId);
    expect(count).toBe(2);

    // Passage 1 forcé sans équipe et ouvert, comme le 2026-10-31.
    await service
      .from('passages')
      .update({ equipe_id: null })
      .eq('manche_id', mancheId)
      .eq('ordre', 1);
    const regie = await (
      await browser.newContext({ viewport: { width: 1440, height: 900 }, isMobile: false })
    ).newPage();
    await regie.goto('/regie');
    await regie.getByLabel('E-mail').fill('anna@teamup.test');
    await regie.getByLabel('Mot de passe').fill('motdepasse');
    await regie.getByRole('button', { name: 'Se connecter' }).click();
    await regie.waitForURL('**/regie');
    await regie.goto(`/regie/${soiree.code}/pilotage`);
    await regie.getByRole('button', { name: 'Présenter' }).first().click();
    await regie.getByRole('button', { name: 'Commencer : Points communs' }).click();
    await expect(regie.getByTestId('passage-sans-equipe')).toBeVisible({ timeout: 10_000 });
    await regie.getByRole('button', { name: 'Passer ce passage' }).click();
    await regie.getByRole('button', { name: 'Commencer : Points communs' }).click();
    await expect(regie.getByTestId('regie-reponse')).toBeVisible({ timeout: 10_000 });
  } finally {
    await supprimerEvenements([soiree.id]);
  }
});
