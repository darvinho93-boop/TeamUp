import { devices, expect, request, test, type Browser, type Page } from '@playwright/test';
import {
  appeler,
  clientAnimateur,
  clientService,
  creerEvenementJetable,
  supprimerEvenements,
} from '../tests/base';

/**
 * Portrait mystère (2026-11-18), de la préparation à la carte noire. Au téléphone : trois
 * capitaines votent ; l'un trouve au premier indice (+100), un autre tombe sur la carte noire
 * (éliminé, la carte reste cachée), le troisième trouve au deuxième indice (+60). À voix : la régie
 * saisit le vote de chaque équipe.
 */

const crees: string[] = [];
test.afterAll(() => supprimerEvenements(crees));

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

/** « B2 » → 6 : colonne puis rangée, comme `repereCarte`. */
const positionDe = (repere: string) =>
  (Number(repere.slice(1)) - 1) * 5 + (repere.charCodeAt(0) - 65);

/** Une soirée, 26 proches (de quoi remplir une grille) et un Portrait mystère de 3 cibles. */
async function preparer(browser: Browser, equipes: number) {
  const ev = await creerEvenementJetable({ equipes, langues: ['fr'] });
  crees.push(ev.id);
  const anna = await clientAnimateur('anna@teamup.test');
  for (let n = 1; n <= 26; n++) {
    const id = String(n).padStart(2, '0');
    const { erreur } = await appeler(anna, 'enregistrer_proche', {
      p_evenement: ev.id,
      p_id: null,
      p_langues: {
        fr: {
          public: { nom: `Proche ${id}` },
          secret: { indices: [`Indice A${id}`, `Indice B${id}`, `Indice C${id}`] },
        },
      },
    });
    expect(erreur).toBeNull();
  }
  const regie = await connecter(browser, 'anna@teamup.test');
  await regie.goto(`/regie/${ev.code}/preparation`);
  await regie.getByLabel('Cibles (3 à 8)').fill('3');
  await regie.getByRole('button', { name: 'Ajouter Portrait mystère' }).click();
  await expect(regie.getByTestId('grille-1')).toContainText('Grille prête', { timeout: 15_000 });
  await expect(regie.getByTestId('grille-1').locator('li')).toHaveCount(25);

  const ecran = await (
    await browser.newContext({
      storageState: await regie.context().storageState(),
      viewport: { width: 1920, height: 1080 },
      isMobile: false,
    })
  ).newPage();
  await ecran.goto(`/ecran/${ev.code}`);
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });
  return { ev, regie, ecran };
}

/** La cible et la carte noire, lues à la régie (l'animateur seul les voit). */
async function positions(regie: Page) {
  const lire = async (testId: string) => {
    const texte = (await regie.getByTestId(testId).textContent()) ?? '';
    const [, repere, nom] = /([A-E][1-5]) · (Proche \d\d)/.exec(texte) ?? [];
    return { position: positionDe(repere!), nom: nom! };
  };
  return { cible: await lire('portrait-cible'), noire: await lire('portrait-noire') };
}

test('Portrait mystère au téléphone : votes, verdicts, carte noire cachée puis montrée', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(300_000);
  const service = clientService();
  const { ev, regie, ecran } = await preparer(browser, 3);

  // Trois capitaines, un par équipe (la moins remplie à l'arrivée).
  const telephones: Page[] = [];
  for (const prenom of ['Ana', 'Bao', 'Cleo']) {
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
  const numero = (prenom: string) => {
    const joueur = (joueurs as { prenom: string; equipe_id: string }[]).find(
      (j) => j.prenom === prenom,
    )!;
    return (lesEquipes as { id: string; numero: number }[]).find((e) => e.id === joueur.equipe_id)!
      .numero;
  };
  const [ana, bao, cleo] = telephones as [Page, Page, Page];
  for (const t of telephones) await t.goto(`/${ev.code}`);

  const scene = (etape: string) => ecran.locator(`[data-scene="portrait"][data-etape="${etape}"]`);
  const caseDe = (position: number) =>
    ecran.getByTestId('portrait-grille').locator('li').nth(position);

  // --- Lancement au téléphone.
  await regie.goto(`/regie/${ev.code}/pilotage`);
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await regie.getByRole('button', { name: 'Mode téléphones (le capitaine vote)' }).click();
  await expect(scene('pret')).toBeVisible({ timeout: 10_000 });
  const { cible, noire } = await positions(regie);
  const leurre = [0, 1, 2, 3].find((p) => p !== cible.position && p !== noire.position)!;

  // --- Premier indice : les trois capitaines votent.
  await regie.getByRole('button', { name: 'Indice 1' }).click();
  await expect(scene('vote')).toBeVisible({ timeout: 10_000 });
  await expect(ecran.getByTestId('portrait-indices')).toContainText('Indice A');
  for (const [telephone, carte] of [
    [ana, cible.position],
    [bao, noire.position],
    [cleo, leurre],
  ] as const) {
    await telephone.getByTestId(`carte-${carte}`).click({ timeout: 15_000 });
    await expect(telephone.getByTestId(`carte-${carte}`)).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(ecran.getByTestId('portrait-equipes')).toContainText('a voté', { timeout: 5000 });
  await expect(ecran.getByTestId('portrait-equipes').locator('[data-statut="a-vote"]')).toHaveCount(
    3,
    { timeout: 5000 },
  );
  // Rien ne trahit la cible ni la carte noire sur la grille.
  await expect(caseDe(cible.position)).not.toHaveClass(/carte--cible/);
  await expect(caseDe(noire.position)).not.toHaveClass(/carte--noire/);

  // --- Fin du tour : Ana +100, Bao éliminée, et la carte noire n'est pas nommée.
  await regie.getByRole('button', { name: 'Fin du tour' }).click();
  await expect(scene('tour')).toBeVisible({ timeout: 10_000 });
  const verdict = ecran.getByTestId('portrait-verdict');
  await expect(verdict).toContainText('Carte noire');
  await expect(ecran.getByTestId('portrait-eliminee')).toContainText(`Équipe ${numero('Bao')}`);
  await expect(ecran.getByTestId('portrait-trouvee')).toContainText(
    new RegExp(`Équipe ${numero('Ana')}\\s: \\+100`),
  );
  await expect(verdict).not.toContainText(noire.nom);
  await expect(bao.getByTestId('statut-portrait')).toContainText('Carte noire', {
    timeout: 10_000,
  });

  // --- Deuxième indice : Cleo trouve (+60). Plus personne en lice : on révèle.
  await regie.getByRole('button', { name: 'Indice 2' }).click();
  await expect(scene('vote')).toBeVisible({ timeout: 10_000 });
  await cleo.getByTestId(`carte-${cible.position}`).click({ timeout: 15_000 });
  await expect(cleo.getByTestId(`carte-${cible.position}`)).toHaveAttribute('aria-pressed', 'true');
  // Bao est éliminée : son téléphone ne vote plus.
  await expect(bao.getByTestId(`carte-${leurre}`)).toHaveCount(0);
  await regie.getByRole('button', { name: 'Fin du tour' }).click();
  await expect(ecran.getByTestId('portrait-trouvee')).toContainText(
    new RegExp(`Équipe ${numero('Cleo')}\\s: \\+60`),
    { timeout: 10_000 },
  );
  await expect(regie.getByRole('button', { name: 'Indice 3' })).toHaveCount(0);
  await regie.getByRole('button', { name: 'Révéler la cible' }).click();
  await expect(scene('revele')).toBeVisible({ timeout: 10_000 });
  await expect(ecran.getByTestId('portrait-reponse')).toContainText(cible.nom);
  await expect(caseDe(cible.position)).toHaveClass(/carte--cible/);

  await expect
    .poll(async () => {
      const { data } = await service
        .from('classement')
        .select('numero, points')
        .eq('evenement_id', ev.id);
      return Object.fromEntries(
        (data as { numero: number; points: number }[]).map((l) => [l.numero, l.points]),
      );
    })
    .toEqual({ [numero('Ana')]: 100, [numero('Bao')]: 0, [numero('Cleo')]: 60 });

  // --- Les deux cibles suivantes : un tour, personne, révélation.
  for (const derniere of [false, true]) {
    await regie.getByRole('button', { name: 'Cible suivante' }).click();
    await expect(scene('pret')).toBeVisible({ timeout: 10_000 });
    // La cible déjà trouvée reste retournée.
    await expect(caseDe(cible.position)).toHaveClass(/carte--trouvee/);
    await regie.getByRole('button', { name: 'Indice 1' }).click();
    await expect(scene('vote')).toBeVisible({ timeout: 10_000 });
    await regie.getByRole('button', { name: 'Fin du tour' }).click();
    await expect(ecran.getByTestId('portrait-verdict')).toContainText('Personne', {
      timeout: 10_000,
    });
    await regie.getByRole('button', { name: 'Révéler la cible' }).click();
    await expect(scene('revele')).toBeVisible({ timeout: 10_000 });
    if (derniere) break;
  }

  // --- La carte noire, enfin montrée.
  await regie.getByRole('button', { name: 'Montrer la carte noire' }).click();
  await expect(scene('noire')).toBeVisible({ timeout: 10_000 });
  await expect(ecran.getByTestId('portrait-noire')).toContainText(noire.nom);
  await expect(caseDe(noire.position)).toHaveClass(/carte--noire/);
  await regie.getByRole('button', { name: 'Terminer la manche' }).click();
  await expect(ecran.locator('[data-scene="portrait"]')).toHaveCount(0, { timeout: 10_000 });
});

test('Portrait mystère à voix : la régie saisit le vote de chaque équipe', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const service = clientService();
  const { ev, regie, ecran } = await preparer(browser, 2);
  for (const prenom of ['Dina', 'Eli']) {
    const api = await request.newContext({ baseURL: baseURL! });
    expect(
      (
        await api.post(`/api/partie/${ev.code}/rejoindre`, { data: { prenom, langue: 'fr' } })
      ).status(),
    ).toBe(200);
  }

  await regie.goto(`/regie/${ev.code}/pilotage`);
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await regie.getByRole('button', { name: 'Commencer Portrait mystère à voix' }).click();
  const { cible, noire } = await positions(regie);
  const leurre = [0, 1, 2].find((p) => p !== cible.position && p !== noire.position)!;
  await regie.getByRole('button', { name: 'Indice 1' }).click();
  await expect(ecran.locator('[data-scene="portrait"][data-etape="vote"]')).toBeVisible({
    timeout: 10_000,
  });

  await regie.getByTestId('vote-1').selectOption(String(cible.position));
  await expect(regie.getByTestId('vote-1')).toHaveValue(String(cible.position), {
    timeout: 10_000,
  });
  await regie.getByTestId('vote-2').selectOption(String(leurre));
  await expect(regie.getByTestId('vote-2')).toHaveValue(String(leurre), { timeout: 10_000 });
  await regie.getByRole('button', { name: 'Fin du tour' }).click();
  await expect(ecran.getByTestId('portrait-trouvee')).toContainText(/Équipe 1\s: \+100/, {
    timeout: 10_000,
  });
  await expect
    .poll(async () => {
      const { data } = await service
        .from('classement')
        .select('numero, points')
        .eq('evenement_id', ev.id)
        .order('numero');
      return (data as { numero: number; points: number }[]).map((l) => l.points);
    })
    .toEqual([100, 0]);
});
