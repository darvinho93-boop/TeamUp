import { expect, test } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

/**
 * Critère du lot 13 : depuis la régie, « Tirer l'ordre de passage » réordonne les passages d'une
 * manche à venir ; l'écran anime le tirage puis affiche l'ordre ; « Commencer » lance la
 * première équipe tirée ; une manche commencée ne se tire plus.
 */

let evenement: { id: string; code: string };
let mancheId: string;

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 3, langues: ['fr'] });
  const service = clientService();
  const { data: equipes } = await service
    .from('equipes')
    .select('id')
    .eq('evenement_id', evenement.id)
    .order('numero')
    .returns<{ id: string }[]>();
  const { data: manche, error } = await service
    .from('manches')
    .insert({ evenement_id: evenement.id, jeu: 'list2', ordre: 1, options: {} })
    .select('id')
    .single<{ id: string }>();
  if (error) throw new Error(error.message);
  mancheId = manche.id;
  await service.from('passages').insert(
    equipes!.map((e, i) => ({
      manche_id: mancheId,
      evenement_id: evenement.id,
      equipe_id: e.id,
      ordre: i + 1,
    })),
  );
});

test.afterAll(() => supprimerEvenements([evenement.id]));

/** Les noms d'équipe dans l'ordre de passage enregistré en base. */
async function ordreEnBase(): Promise<string[]> {
  const { data } = await clientService()
    .from('passages')
    .select('ordre, equipes(nom)')
    .eq('manche_id', mancheId)
    .order('ordre')
    .returns<{ equipes: { nom: string } }[]>();
  return data!.map((p) => p.equipes.nom);
}

test('l’ordre se tire en direct, s’anime à l’écran et décide de la première équipe', async ({
  page: regie,
  context,
  browser,
}) => {
  test.setTimeout(120_000);
  const { code } = evenement;

  await regie.goto(`/regie/${code}/pilotage`);
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL(`**/regie/${code}/pilotage`);

  const fenetre = await browser.newContext({
    storageState: await context.storageState(),
    viewport: { width: 1920, height: 1080 },
  });
  const ecran = await fenetre.newPage();
  await ecran.goto(`/ecran/${code}`);
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });

  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await expect(ecran.locator('[data-scene="intro"]')).toBeVisible({ timeout: 10_000 });
  await expect(ecran.getByTestId('ordre-intro')).toHaveCount(0);

  // --- Le tirage : mélange d'abord, rien n'est rangé.
  await regie.getByRole('button', { name: "Tirer l'ordre de passage" }).click();
  const tirage = ecran.locator('[data-scene="tirage-ordre"]');
  await expect(tirage).toHaveAttribute('data-rangees', '0', { timeout: 2_000 });

  // --- Puis les trois équipes rangées, dans l'ordre enregistré en base.
  await expect(tirage).toHaveAttribute('data-rangees', '3', { timeout: 8_000 });
  const tire = await ordreEnBase();
  await expect(ecran.getByTestId('ordre-tire').locator('.tu-team')).toHaveText(tire);

  // --- Retour à l'intro fixe : l'ordre y reste rappelé.
  await regie.getByRole('button', { name: 'Expliquer', exact: true }).click();
  await regie.getByRole('button', { name: "Arrêter l'explication" }).click();
  await expect(ecran.getByTestId('ordre-intro')).toContainText(`1. ${tire[0]}`, {
    timeout: 5_000,
  });

  // --- Commencer : la première équipe tirée joue.
  await regie.getByRole('button', { name: 'Commencer : Points communs' }).click();
  await expect(ecran.locator('[data-scene="list2"]')).toContainText(tire[0]!, { timeout: 5_000 });

  // --- Une manche commencée ne se tire plus.
  await expect(regie.getByRole('button', { name: /Tirer/ })).toHaveCount(0);
});
