import { fileURLToPath } from 'node:url';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

/**
 * Musique sous les chronos (2026-11-15) : l'admin dépose un MP3 au back-office, l'animateur le
 * coche sur un quiz à la préparation, et l'écran commun le joue du lancement du chrono jusqu'aux
 * dix dernières secondes, puis se tait pour le tic-tac.
 */

const MP3 = fileURLToPath(new URL('./fichiers/la-440.mp3', import.meta.url));
const crees: string[] = [];
const titre = `La 440 ${Date.now()}`;

test.afterAll(async () => {
  await supprimerEvenements(crees);
  const service = clientService();
  const { data } = await service.from('musiques').select('id, chemin').eq('titre', titre);
  const lignes = (data ?? []) as { id: string; chemin: string }[];
  if (lignes.length) {
    await service.storage.from('musiques').remove(lignes.map((m) => m.chemin));
    await service
      .from('musiques')
      .delete()
      .in(
        'id',
        lignes.map((m) => m.id),
      );
  }
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

/** Ce que le lecteur de l'écran a joué, dans l'ordre. */
const journal = (ecran: Page) =>
  ecran.evaluate(
    () =>
      (
        window as unknown as { __tuLecteur?: { journal: { son: string }[] } }
      ).__tuLecteur?.journal.map((j) => j.son) ?? [],
  );

test('une musique de la bibliothèque joue sous le chrono du quiz, puis laisse le tic-tac', async ({
  browser,
}) => {
  test.setTimeout(180_000);

  // --- Le back-office : dépôt, puis la musique dans la liste, à écouter.
  const admin = await connecter(browser, 'admin@teamup.test');
  await admin.goto('/admin/musiques');
  await admin.getByLabel('Titre').fill(titre);
  await admin.getByLabel('Fichier MP3').setInputFiles(MP3);
  await admin.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const ligne = admin.getByTestId('musique').filter({ hasText: titre });
  await expect(ligne).toBeVisible({ timeout: 15_000 });
  await expect(ligne.locator('audio')).toHaveCount(1);
  // Un fichier qui n'est pas un MP3 est refusé avant tout envoi.
  await admin.getByLabel('Titre').fill('Pas un MP3');
  await admin.getByLabel('Fichier MP3').setInputFiles({
    name: 'faux.mp3',
    mimeType: 'audio/mpeg',
    buffer: Buffer.from('ceci n’est pas un mp3'),
  });
  await admin.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(admin.getByTestId('musique-erreur')).toHaveText('Ce fichier n’est pas un MP3.');
  const service = clientService();
  const { data: musique } = await service.from('musiques').select('id').eq('titre', titre).single();
  const id = (musique as { id: string }).id;

  // --- Une soirée, un quiz d'une question au chrono de 13 s : 3 s de musique, puis le tic-tac.
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
    .insert({ evenement_id: ev.id, jeu: 'qcm2', ordre: 1, options: { questions: 1, chrono_s: 13 } })
    .select('id')
    .single();
  const manche = (quiz as { id: string }).id;
  await service.from('passages').insert({
    manche_id: manche,
    evenement_id: ev.id,
    ordre: 1,
    contenu_id: (questions as { id: string }[])[0]!.id,
  });

  // --- La préparation : la musique se coche sur le quiz.
  const regie = await connecter(browser, 'anna@teamup.test');
  await regie.goto(`/regie/${ev.code}/preparation`);
  const bloc = regie.getByTestId('musiques-1');
  await bloc.getByLabel(titre).check();
  await bloc.getByRole('button', { name: 'Enregistrer les musiques' }).click();
  await expect
    .poll(
      async () => {
        const { data } = await service.from('manches').select('options').eq('id', manche).single();
        return (data as { options: Record<string, unknown> }).options['musiques'];
      },
      { timeout: 20_000 },
    )
    .toEqual([id]);
  await expect(regie.getByTestId('musiques-1').getByLabel(titre)).toBeChecked();

  // --- L'écran commun, son activé.
  const ecran = await (
    await browser.newContext({
      storageState: await regie.context().storageState(),
      viewport: { width: 1920, height: 1080 },
      isMobile: false,
    })
  ).newPage();
  await ecran.goto(`/ecran/${ev.code}`);
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });
  await ecran.getByRole('button', { name: 'Activer le son' }).click();
  await expect(ecran.getByRole('button', { name: 'Activer le son' })).toHaveCount(0);

  // --- Le quiz : rien tant que la question s'affiche, la musique au lancement du chrono.
  await regie.goto(`/regie/${ev.code}/pilotage`);
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await regie.getByRole('button', { name: 'Commencer le quiz en mode croix' }).click();
  await regie.getByRole('button', { name: 'Afficher la question' }).click();
  for (const lettre of ['A', 'B', 'C', 'D']) {
    await regie.getByRole('button', { name: `Afficher la réponse ${lettre}` }).click();
  }
  await expect(ecran.locator('[data-scene="qcm2"][data-etape="question"]')).toBeVisible();
  expect(await journal(ecran)).not.toContain(`musique:${id}`);
  await regie.getByRole('button', { name: 'Lancer le chrono' }).click();
  await expect.poll(() => journal(ecran), { timeout: 10_000 }).toContain(`musique:${id}`);
  // Elle s'entend : le lecteur envoie du son en sortie.
  await expect
    .poll(() =>
      ecran.evaluate(
        () =>
          (
            window as unknown as { __tuLecteur: { mesure: () => { niveau: number } } }
          ).__tuLecteur.mesure().niveau,
      ),
    )
    .toBeGreaterThan(0.001);

  // Elle s'efface juste avant le premier battement (« 10 »), qui tombe sur le silence.
  await expect.poll(() => journal(ecran), { timeout: 10_000 }).toContain('tic');
  const sons = await journal(ecran);
  expect(sons).toContain('musique:-');
  expect(sons.indexOf('musique:-')).toBeLessThan(sons.indexOf('tic'));
});
