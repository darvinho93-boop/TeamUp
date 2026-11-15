import { expect, test, type Browser, type Page } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

/**
 * Soirée du 2026-11-14 : un quiz s'est fini sans que ses points soient écrits (« Scores » touché
 * avant la validation, classement à zéro), et rien ne permettait de le rejouer.
 *
 * - Un jeu mal parti se relance d'une touche confirmée, en plein jeu comme une fois terminé : la
 *   salle revient à sa présentation, ses points sont annulés au journal.
 * - Un quiz qui n'a pas encore donné ses points ne se quitte pas : la régie dit quoi toucher.
 */

const crees: string[] = [];
test.afterAll(() => supprimerEvenements(crees));

async function connecter(browser: Browser): Promise<Page> {
  const regie = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 }, isMobile: false })
  ).newPage();
  await regie.goto('/regie');
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL('**/regie');
  return regie;
}

async function ouvrirEcran(browser: Browser, regie: Page, code: string): Promise<Page> {
  const ecran = await (
    await browser.newContext({
      storageState: await regie.context().storageState(),
      viewport: { width: 1920, height: 1080 },
      isMobile: false,
    })
  ).newPage();
  await ecran.goto(`/ecran/${code}`);
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });
  return ecran;
}

test('un quiz se relance depuis le début, et donne ses points avant qu’on le quitte', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const service = clientService();
  const ev = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
  crees.push(ev.id);
  const { data: questions } = await service
    .from('contenus')
    .select('id')
    .eq('jeu', 'qcm2')
    .eq('actif', true)
    .order('cree_le')
    .limit(2);
  const { data: quiz } = await service
    .from('manches')
    .insert({ evenement_id: ev.id, jeu: 'qcm2', ordre: 1, options: { questions: 2 } })
    .select('id')
    .single();
  const manche = (quiz as { id: string }).id;
  const { error } = await service.from('passages').insert(
    (questions as { id: string }[]).map((q, i) => ({
      manche_id: manche,
      evenement_id: ev.id,
      ordre: i + 1,
      contenu_id: q.id,
    })),
  );
  expect(error).toBeNull();

  const regie = await connecter(browser);
  const ecran = await ouvrirEcran(browser, regie, ev.code);
  await regie.goto(`/regie/${ev.code}/pilotage`);
  const scene = (nom: string, etape = '') =>
    ecran.locator(`[data-scene="${nom}"]${etape ? `[data-etape="${etape}"]` : ''}`);
  const scenes = regie.getByRole('group', { name: 'Scènes' });
  const alerte = regie.locator('.tu-regie__alert');
  const statut = async () => {
    const { data } = await service.from('manches').select('statut, options').eq('id', manche);
    return (data as { statut: string; options: Record<string, unknown> }[])[0]!;
  };
  const classement = async () => {
    const { data } = await service
      .from('classement')
      .select('numero, points')
      .eq('evenement_id', ev.id)
      .order('numero');
    return (data as { points: number }[]).map((l) => l.points);
  };

  const commencer = async () => {
    await regie.getByRole('button', { name: 'Commencer le quiz en mode croix' }).click();
    await expect(scene('qcm2', 'pret')).toBeVisible({ timeout: 10_000 });
  };
  /** Une question jusqu'à sa réponse révélée. */
  const jouerLaQuestion = async () => {
    await regie.getByRole('button', { name: 'Afficher la question' }).click();
    for (const lettre of ['A', 'B', 'C', 'D']) {
      await regie.getByRole('button', { name: `Afficher la réponse ${lettre}` }).click();
    }
    await regie.getByRole('button', { name: 'Lancer le chrono' }).click();
    const reveler = regie.getByRole('button', { name: 'Révéler la réponse' });
    await expect(reveler).toBeEnabled({ timeout: 10_000 });
    await reveler.click();
    await expect(ecran.getByTestId('bonne-reponse')).toBeVisible({ timeout: 10_000 });
  };
  /** Les deux appuis d'une touche confirmée, qui change de libellé entre les deux. */
  const relancer = async (testid: string) => {
    const touche = regie.getByTestId(testid);
    await touche.click();
    await expect(touche).toHaveText('Confirmer : effacer ses points et recommencer');
    await touche.click();
    await expect(scene('intro')).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => (await statut()).statut).toBe('a_venir');
  };

  // --- Le quiz, lancé puis relancé après sa première question.
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await expect(scene('intro')).toBeVisible({ timeout: 10_000 });
  await expect(regie.getByTestId('recommencer-jeu')).toHaveCount(0);
  await commencer();
  await jouerLaQuestion();
  await relancer('recommencer-jeu');
  // Le mode se rechoisit ; les réglages de la préparation restent.
  expect((await statut()).options).toEqual({ questions: 2 });
  const { data: passages } = await service
    .from('passages')
    .select('statut')
    .eq('manche_id', manche);
  expect((passages as { statut: string }[]).every((p) => p.statut === 'a_venir')).toBe(true);

  // --- Rejoué en entier. Entre deux questions, les scores se montrent librement.
  await commencer();
  await jouerLaQuestion();
  await scenes.getByRole('button', { name: 'Scores' }).click();
  await expect(scene('scores')).toBeVisible({ timeout: 10_000 });
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await expect(scene('intro')).toBeVisible({ timeout: 10_000 });
  await regie.getByRole('button', { name: 'Reprendre : Quiz · mode croix' }).click();
  await expect(scene('qcm2', 'pret')).toBeVisible({ timeout: 10_000 });
  await jouerLaQuestion();

  // Après la dernière réponse, plus de scores avant la fin du quiz : la régie dit quoi toucher.
  await scenes.getByRole('button', { name: 'Scores' }).click();
  await expect(alerte).toContainText('Fin des questions');
  await expect(scene('qcm2', 'reponse')).toBeVisible();
  await regie.getByRole('button', { name: 'Fin des questions' }).click();
  await expect(scene('qcm2', 'survivants')).toBeVisible({ timeout: 10_000 });

  // À la croix, les survivants se saisissent : pas de scores tant qu'ils ne sont pas validés.
  await scenes.getByRole('button', { name: 'Scores' }).click();
  await expect(alerte).toContainText('Valider');
  await expect(scene('qcm2', 'survivants')).toBeVisible();
  expect(await classement()).toEqual([0, 0]);
  await regie.getByLabel('Survivants de Équipe 1').fill('2');
  await regie.getByLabel('Survivants de Équipe 2').fill('1');
  await regie.getByRole('button', { name: 'Valider les survivants', exact: true }).click();
  await regie.getByRole('button', { name: 'Confirmer : Valider les survivants' }).click();
  await expect(scene('qcm2', 'resultat')).toBeVisible({ timeout: 10_000 });
  await expect(alerte).toHaveCount(0);
  await expect.poll(classement).toEqual([200, 100]);

  // Validé : les scores se montrent, puis la manche se termine.
  await scenes.getByRole('button', { name: 'Scores' }).click();
  await expect(scene('scores')).toBeVisible({ timeout: 10_000 });
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await regie.getByRole('button', { name: 'Terminer la manche' }).click();
  await expect(scene('programme')).toBeVisible({ timeout: 10_000 });

  // --- Terminé, il se rejoue depuis le programme : ses points sont annulés, pas effacés.
  await relancer('recommencer-1');
  await expect.poll(classement).toEqual([0, 0]);
  const { data: journal } = await service
    .from('scores')
    .select('points, motif')
    .eq('evenement_id', ev.id)
    .order('points');
  // Le libellé porte une espace insécable avant les deux-points.
  const relance = expect.stringMatching(/^Quiz relancé.: points remis à zéro$/);
  expect(journal).toEqual([
    { points: -200, motif: relance },
    { points: -100, motif: relance },
    { points: 100, motif: 'Quiz – 1 survivant' },
    { points: 200, motif: 'Quiz – 2 survivants' },
  ]);
  await expect(
    regie.getByRole('button', { name: 'Commencer le quiz en mode croix' }),
  ).toBeVisible();
});
