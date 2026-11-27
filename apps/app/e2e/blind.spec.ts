import { fileURLToPath } from 'node:url';
import { devices, expect, request, test, type Browser, type Page } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

/**
 * Blind test (2026-11-15), de la préparation au dernier titre : l'admin dépose la musique,
 * l'animateur prépare les titres, deux capitaines buzzent depuis leur téléphone. Mauvaise réponse
 * (équipe bloquée, la régie relance), bonne réponse (+100, puis le karaoké jusqu'au fondu de la
 * régie, 2026-11-23), buzz de secours par la régie, révélation sans gagnant.
 */

// 60 s : la chanson doit encore jouer pendant tout le karaoké, jusqu'au fondu mesuré.
const MP3 = fileURLToPath(new URL('./fichiers/la-440-60s.mp3', import.meta.url));
const crees: string[] = [];
const titre = `Blind ${Date.now()}`;

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

/** `CAPTURES=<dossier>` : une capture de l'écran et des téléphones à chaque étape (revue visuelle). */
const CAPTURES = process.env['CAPTURES'];
const capturer = async (page: Page, nom: string) => {
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/blind-${nom}.png` });
};

const journal = (ecran: Page) =>
  ecran.evaluate(
    () =>
      (
        window as unknown as { __tuLecteur?: { journal: { son: string }[] } }
      ).__tuLecteur?.journal.map((j) => j.son) ?? [],
  );

type AvecMesure = { __tuLecteur?: { mesure(): { niveau: number } } };
const niveau = (ecran: Page) =>
  ecran.evaluate(() => (window as unknown as AvecMesure).__tuLecteur?.mesure().niveau ?? 0);
/** Le niveau de sortie relevé toutes les 100 ms, pendant six secondes. */
const releverNiveaux = (ecran: Page) =>
  ecran.evaluate(
    () =>
      new Promise<number[]>((fin) => {
        const releves: number[] = [];
        const minuteur = setInterval(() => {
          releves.push((window as unknown as AvecMesure).__tuLecteur?.mesure().niveau ?? 0);
          if (releves.length >= 60) {
            clearInterval(minuteur);
            fin(releves);
          }
        }, 100);
      }),
  );

test('blind test : buzz, mauvaise réponse, relance, bonne réponse, secours de la régie', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const service = clientService();

  // --- La musique, au back-office, avec son artiste.
  const admin = await connecter(browser, 'admin@teamup.test');
  await admin.goto('/admin/musiques');
  await admin.getByLabel('Titre').fill(titre);
  await admin.getByLabel('Artiste (facultatif)').fill('Les Testeurs');
  await admin.getByLabel('Fichier MP3').setInputFiles(MP3);
  await admin.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(admin.getByTestId('musique').filter({ hasText: titre })).toContainText(
    'Les Testeurs',
    { timeout: 15_000 },
  );
  const { data: musique } = await service.from('musiques').select('id').eq('titre', titre).single();
  const id = (musique as { id: string }).id;

  // --- Ses paroles (2026-11-23) : deux lignes calées à la touche Espace, puis un .lrc complet.
  await admin.goto(`/admin/musiques/${id}/paroles`);
  const champ = admin.getByTestId('paroles-texte');
  const preparer = admin.getByRole('button', { name: 'Préparer les lignes' });
  // Un champ rempli avant l'hydratation serait perdu : on recommence jusqu'à ce qu'il compte.
  await expect(async () => {
    await champ.fill('Première ligne\nDeuxième ligne');
    await preparer.click();
    await expect(admin.getByTestId('paroles-ligne')).toHaveCount(2, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await admin.getByRole('button', { name: 'Caler depuis le début' }).click();
  const temps = () => admin.locator('audio').evaluate((a: HTMLAudioElement) => a.currentTime);
  await expect.poll(temps, { timeout: 10_000 }).toBeGreaterThan(0.2);
  await admin.keyboard.press('Space');
  await expect(admin.getByTestId('paroles-etat')).toHaveText('1 sur 2 lignes calées');
  const apresLaPremiere = await temps();
  await expect.poll(temps, { timeout: 5000 }).toBeGreaterThan(apresLaPremiere + 0.2);
  await admin.keyboard.press('Space');
  await expect(admin.getByTestId('paroles-etat')).toHaveText('2 sur 2 lignes calées');
  await expect(admin.getByTestId('paroles-apercu')).toContainText('ligne');

  await champ.fill(
    Array.from(
      { length: 60 },
      (_, i) => `[00:${String(i).padStart(2, '0')}.00] Ligne chantée ${i}`,
    ).join('\n'),
  );
  await preparer.click();
  await expect(admin.getByTestId('paroles-etat')).toHaveText('60 sur 60 lignes calées');
  await admin.getByRole('button', { name: 'Enregistrer les paroles' }).click();
  await expect(admin.getByTestId('paroles-message')).toHaveText('Paroles enregistrées.');
  await admin.goto('/admin/musiques');
  await expect(admin.getByTestId('musique').filter({ hasText: titre })).toContainText(
    '60 lignes calées',
  );

  // --- Une soirée à deux équipes, deux capitaines au téléphone.
  const ev = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
  crees.push(ev.id);
  const telephones: Page[] = [];
  for (const prenom of ['Ana', 'Bao']) {
    const api = await request.newContext({ baseURL: baseURL! });
    const r = await api.post(`/api/partie/${ev.code}/rejoindre`, {
      data: { prenom, langue: 'fr' },
    });
    expect(r.status()).toBe(200);
    const contexte = await browser.newContext({
      ...devices['Pixel 7'],
      storageState: await api.storageState(),
    });
    telephones.push(await contexte.newPage());
  }
  await service.from('joueurs').update({ capitaine: true }).eq('evenement_id', ev.id);
  const [{ data: joueurs }, { data: lesEquipes }] = await Promise.all([
    service.from('joueurs').select('prenom, equipe_id').eq('evenement_id', ev.id),
    service.from('equipes').select('id, numero').eq('evenement_id', ev.id),
  ]);
  const numeroDe = (prenom: string) => {
    const joueur = (joueurs as { prenom: string; equipe_id: string }[]).find(
      (j) => j.prenom === prenom,
    )!;
    return (lesEquipes as { id: string; numero: number }[]).find((e) => e.id === joueur.equipe_id)!
      .numero;
  };
  // Ana et Bao sont dans deux équipes différentes (la moins remplie à l'arrivée).
  expect(new Set([numeroDe('Ana'), numeroDe('Bao')]).size).toBe(2);
  const [ana, bao] = telephones as [Page, Page];
  for (const t of telephones) await t.goto(`/${ev.code}`);

  // --- La préparation : trois titres, deux avec la musique, un laissé vide (alerte).
  const regie = await connecter(browser, 'anna@teamup.test');
  await regie.goto(`/regie/${ev.code}/preparation`);
  await regie.getByLabel('Titres').fill('3');
  await regie.getByRole('button', { name: 'Ajouter Blind test' }).click();
  const titres = regie.getByTestId('titres-1');
  await expect(titres.locator('li')).toHaveCount(3, { timeout: 10_000 });
  for (const index of [0, 1]) {
    const ligne = titres.locator('li').nth(index);
    await ligne.locator('select').selectOption(id);
    await ligne.locator('input[name="debut"]').fill(String(index));
    await ligne.getByRole('button', { name: 'Enregistrer' }).click();
    await expect
      .poll(async () => {
        const { data } = await service
          .from('manches')
          .select('options')
          .eq('evenement_id', ev.id)
          .single();
        return (data as { options: { titres: { musique: string | null }[] } }).options.titres[
          index
        ]!.musique;
      })
      .toBe(id);
  }
  await expect(regie.getByTestId('sans-contenu')).toContainText('1 question, thème ou titre');

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
  const scene = (etape: string) => ecran.locator(`[data-scene="blind"][data-etape="${etape}"]`);

  // --- Le premier titre : la musique part, le téléphone d'Ana buzze.
  await regie.goto(`/regie/${ev.code}/pilotage`);
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await regie.getByRole('button', { name: 'Commencer : Blind test' }).click();
  await expect(regie.getByTestId('blind-reponse')).toHaveText(`${titre} — Les Testeurs`);
  await expect(scene('pret')).toBeVisible({ timeout: 10_000 });
  await capturer(ecran, 'ecran-pret');
  await regie.getByRole('button', { name: 'Lancer la musique' }).click();
  await expect(scene('ecoute')).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => journal(ecran), { timeout: 10_000 }).toContain(`extrait:${id}`);
  await capturer(ecran, 'ecran-ecoute');
  // La réponse n'est pas à l'écran tant que le titre n'est pas révélé.
  await expect(ecran.getByText(titre)).toHaveCount(0);

  const buzzerAna = ana.getByTestId('buzzer');
  await expect(buzzerAna).toBeEnabled({ timeout: 10_000 });
  await capturer(ana, 'telephone-capitaine');
  const depart = Date.now();
  await buzzerAna.click();
  await expect(scene('buzz')).toBeVisible({ timeout: 5000 });
  const latence = Date.now() - depart;
  test.info().annotations.push({ type: 'latence buzz → écran', description: `${latence} ms` });
  await expect(ecran.getByTestId('blind-equipe')).toContainText(`Équipe ${numeroDe('Ana')}`);
  await expect(ecran.getByTestId('blind-a-vous')).toHaveText('À vous de répondre !');
  await expect.poll(() => journal(ecran)).toContain('extrait:-');
  await expect(ana.getByTestId('statut-blind')).toHaveText(/À vous/, { timeout: 10_000 });
  await expect(bao.getByTestId('statut-blind')).toHaveText(/Une autre équipe a buzzé/, {
    timeout: 10_000,
  });
  await capturer(ecran, 'ecran-buzz');
  await capturer(ana, 'telephone-a-vous');
  await capturer(regie, 'regie-buzz');

  // --- Mauvaise réponse : Ana ne buzze plus, la musique attend la régie.
  await regie.getByRole('button', { name: 'Réponse incorrecte' }).click();
  await expect(scene('pause')).toBeVisible({ timeout: 10_000 });
  // Les autres équipes savent qu'elles vont rejouer, avant que la musique reparte.
  await expect(ecran.getByTestId('blind-suite')).toHaveText(
    'Les autres capitaines, préparez vos buzzers !',
  );
  await capturer(ecran, 'ecran-pause');
  await regie.getByRole('button', { name: 'Relancer la musique pour les autres équipes' }).click();
  await expect(scene('ecoute')).toBeVisible({ timeout: 10_000 });
  await expect(ana.getByTestId('statut-blind')).toHaveText(/Plus de buzz/, { timeout: 10_000 });
  await expect(ana.getByTestId('buzzer')).toHaveCount(0);
  await capturer(ana, 'telephone-bloque');
  await capturer(ecran, 'ecran-ecoute-bloquee');

  // --- Bao buzze, bonne réponse : +100, et la chanson repart en karaoké.
  await expect(bao.getByTestId('buzzer')).toBeEnabled({ timeout: 10_000 });
  await bao.getByTestId('buzzer').click();
  await expect(scene('buzz')).toBeVisible({ timeout: 5000 });
  await regie
    .getByRole('button', { name: `Titre trouvé · +100 pour Équipe ${numeroDe('Bao')}` })
    .click();
  await expect(scene('karaoke')).toBeVisible({ timeout: 10_000 });
  await expect(ecran.getByTestId('blind-reponse')).toHaveText(titre);
  await expect(ecran.getByTestId('blind-verdict')).toContainText(`Équipe ${numeroDe('Bao')}`);
  // La chanson repart : troisième départ de l'extrait (écoute, relance, karaoké).
  await expect
    .poll(async () => (await journal(ecran)).filter((s) => s === `extrait:${id}`).length, {
      timeout: 10_000,
    })
    .toBe(3);

  // Les paroles défilent, et la ligne chantée se remplit.
  const lignes = ecran.getByTestId('karaoke-lignes');
  const rang = async () => Number(await lignes.getAttribute('data-index'));
  const premierRang = await rang();
  await expect.poll(rang, { timeout: 8000 }).toBeGreaterThan(premierRang);
  await expect(ecran.getByTestId('karaoke-ligne')).toContainText('Ligne chantée');
  const avance = () =>
    ecran
      .locator('.tu-karaoke')
      .evaluate((el: HTMLElement) => Number(el.style.getPropertyValue('--tu-karaoke-avance')));
  await expect.poll(avance, { timeout: 3000 }).toBeGreaterThan(0);
  await capturer(ecran, 'ecran-karaoke');

  // Le téléphone voit le verdict, jamais les paroles.
  await expect(bao.getByTestId('statut-blind')).toHaveText(/Bravo/, { timeout: 10_000 });
  await expect(bao.getByText(/Ligne chantée/)).toHaveCount(0);
  await expect(ana.getByText(/Ligne chantée/)).toHaveCount(0);

  // Rechargé, l'écran retombe au même endroit de la chanson, pas au point du buzz.
  const avantRechargement = await rang();
  await ecran.reload();
  await expect(scene('karaoke')).toBeVisible({ timeout: 15_000 });
  await expect.poll(rang, { timeout: 10_000 }).toBeGreaterThanOrEqual(avantRechargement);
  await ecran.getByRole('button', { name: 'Activer le son' }).click();
  await expect.poll(() => journal(ecran), { timeout: 15_000 }).toContain(`extrait:${id}`);
  await expect.poll(() => niveau(ecran), { timeout: 10_000 }).toBeGreaterThan(0.02);

  // « Couper en fondu » : le niveau descend par paliers jusqu'au silence, sans son par-dessus.
  const releve = releverNiveaux(ecran);
  await regie.getByRole('button', { name: 'Couper en fondu' }).click();
  await expect(scene('revele')).toBeVisible({ timeout: 10_000 });
  const niveaux = await releve;
  const plein = Math.max(...niveaux.slice(0, 3));
  expect(plein).toBeGreaterThan(0.02);
  expect(niveaux.filter((n) => n > plein * 0.15 && n < plein * 0.85).length).toBeGreaterThan(3);
  expect(niveaux.at(-1)!).toBeLessThan(0.002);
  await expect(ecran.getByTestId('blind-reponse')).toHaveText(titre);
  await expect(ecran.getByTestId('blind-verdict')).toContainText(`Équipe ${numeroDe('Bao')}`);
  await capturer(ecran, 'ecran-revele');
  await expect
    .poll(async () => {
      const { data } = await service
        .from('classement')
        .select('numero, points')
        .eq('evenement_id', ev.id)
        .order('numero');
      return (data as { numero: number; points: number }[]).map((l) => l.points);
    })
    .toEqual(numeroDe('Bao') === 1 ? [100, 0] : [0, 100]);

  // --- Deuxième titre : buzz de secours par la régie, mauvaise réponse, révélation sans gagnant.
  await regie.getByRole('button', { name: 'Titre suivant' }).click();
  await expect(scene('pret')).toBeVisible({ timeout: 10_000 });
  await regie.getByRole('button', { name: 'Lancer la musique' }).click();
  await expect(scene('ecoute')).toBeVisible({ timeout: 10_000 });
  await regie.getByRole('button', { name: `Buzz Équipe ${numeroDe('Ana')}` }).click();
  await expect(scene('buzz')).toBeVisible({ timeout: 10_000 });
  await regie.getByRole('button', { name: 'Réponse incorrecte' }).click();
  await expect(scene('pause')).toBeVisible({ timeout: 10_000 });
  await regie.getByRole('button', { name: 'Révéler le titre' }).click();
  await expect(scene('revele')).toBeVisible({ timeout: 10_000 });
  await expect(ecran.getByTestId('blind-verdict')).toHaveText(/Personne/);
});
