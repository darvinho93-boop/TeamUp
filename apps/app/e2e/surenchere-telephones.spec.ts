import { expect, request, test, type Browser, type Page } from '@playwright/test';
import {
  appeler,
  clientAnimateur,
  clientService,
  creerEvenementJetable,
  hacher,
  supprimerEvenements,
} from '../tests/base';

/**
 * Surenchère en mode téléphones (2026-11-08) : pendant le chrono, le capitaine de chaque équipe
 * tape ses mots ; l'écran ne compte qu'en direct, puis montre tous les mots d'un coup à la fin ;
 * la régie raye les hors-sujet (masqués s'ils le sont pendant le chrono, barrés après) et le
 * podium du thème donne +100, +60, +30.
 */

// Contenus de la démo : « La cuisine » → « citer des épices », puis « Les voyages ».
const THEMES = ['aaaa0201-0000-4000-8000-000000000201', 'aaaa0202-0000-4000-8000-000000000202'];

const evenements: string[] = [];
test.afterAll(() => supprimerEvenements(evenements));

/** Une Surenchère de deux thèmes, préparée en base, avec un chrono court au téléphone. */
async function preparerSurenchere(evenementId: string, chronoTelephonesS: number) {
  const service = clientService();
  const { data: m } = await service
    .from('manches')
    .insert({
      evenement_id: evenementId,
      jeu: 'enchere2',
      ordre: 1,
      options: { themes: 2, chrono_s: 30, chrono_telephones_s: chronoTelephonesS },
    })
    .select('id')
    .single();
  const manche = m!['id'] as string;
  const { data: passages, error } = await service
    .from('passages')
    .insert(
      THEMES.map((contenu, i) => ({
        manche_id: manche,
        evenement_id: evenementId,
        ordre: i + 1,
        contenu_id: contenu,
      })),
    )
    .select('id, ordre')
    .order('ordre');
  if (error) throw new Error(error.message);
  return { manche, passages: passages.map((p) => p['id'] as string) };
}

async function connecterRegie(browser: Browser): Promise<Page> {
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

test('les capitaines tapent leurs mots, l’écran les dévoile, le podium du thème compte', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
  evenements.push(evenement.id);
  const { code } = evenement;
  await preparerSurenchere(evenement.id, 20);
  const service = clientService();
  const { data: equipes } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id)
    .order('numero');
  const equipe = (n: number) => equipes!.find((e) => e['numero'] === n)!['id'] as string;
  const placer = async (prenom: string, numero: number) => {
    const { error } = await service
      .from('joueurs')
      .update({ equipe_id: equipe(numero) })
      .eq('evenement_id', evenement.id)
      .eq('prenom', prenom);
    if (error) throw new Error(error.message);
  };

  // --- Alice (équipe 1) et Bruno, son coéquipier, au téléphone ; Chloé (équipe 2) par l'API.
  const telephone = async (prenom: string, numero: number) => {
    const page = await (await browser.newContext()).newPage();
    const arrivee = await page.request.post(`/api/partie/${code}/rejoindre`, {
      data: { prenom, langue: 'fr' },
    });
    expect(arrivee.status()).toBe(200);
    await placer(prenom, numero);
    await page.goto(`/${code}`);
    await expect(page.getByText(`Bienvenue, ${prenom} !`)).toBeVisible();
    return page;
  };
  const alice = await telephone('Alice', 1);
  const bruno = await telephone('Bruno', 1);
  const chloe = await request.newContext({
    baseURL: baseURL!,
    extraHTTPHeaders: { connection: 'close' },
  });
  expect(
    (
      await chloe.post(`/api/partie/${code}/rejoindre`, { data: { prenom: 'Chloé', langue: 'fr' } })
    ).status(),
  ).toBe(200);
  await placer('Chloé', 2);
  const motDeChloe = (mot: string) =>
    chloe.post(`/api/partie/${code}/mot`, { data: { type: 'ajouter', mot } });

  const regie = await connecterRegie(browser);
  const ecran = await ouvrirEcran(browser, regie, code);
  const scene = (etape: string) =>
    ecran.locator(`[data-scene="enchere2"][data-mode="telephones"][data-etape="${etape}"]`);
  await regie.goto(`/regie/${code}/pilotage`);

  // --- Sans capitaine, le mode téléphones ne part pas ; l'explication, si.
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await expect(ecran.locator('[data-scene="intro"]')).toBeVisible({ timeout: 30_000 });
  const telephones = regie.getByRole('button', { name: /^Mode téléphones/ });
  await expect(telephones).toBeDisabled();
  await expect(regie.getByTestId('capitaines-telephones')).toContainText('Aucun capitaine');
  await regie.getByRole('button', { name: 'Expliquer (téléphones)' }).click();
  await expect(ecran.locator('[data-scene="explication"]')).toHaveAttribute('data-carte', '1', {
    timeout: 2000,
  });
  await expect(ecran.getByTestId('phrase-explication')).toContainText('Le sujet tombe');
  await regie.getByRole('button', { name: "Arrêter l'explication" }).click();

  // La régie nomme les capitaines (ici en base ; la Salle a son propre e2e).
  await service
    .from('joueurs')
    .update({ capitaine: true })
    .eq('evenement_id', evenement.id)
    .in('prenom', ['Alice', 'Chloé']);
  await regie.reload();
  await expect(regie.getByTestId('capitaines-telephones')).toContainText('Alice');
  await expect(telephones).toBeEnabled();
  await telephones.click();
  await expect(ecran.locator('[data-scene="enchere2"][data-etape="themes"]')).toBeVisible();

  // --- Le sujet : à l'écran, et sur les téléphones (dans leur langue) ; pas encore de saisie.
  await regie.getByRole('button', { name: 'Dévoiler' }).first().click();
  await expect(scene('sujet')).toBeVisible();
  await expect(ecran.getByTestId('capitaines')).toHaveText('Capitaines, à vos téléphones !');
  await expect(alice.getByTestId('sujet')).toHaveText('citer des épices', { timeout: 6000 });
  expect((await motDeChloe('Cumin')).status()).toBe(409);

  // --- Le chrono : Alice tape (Entrée, puis le bouton), Chloé par l'API.
  await regie.getByRole('button', { name: 'Lancer le chrono (20 s)' }).click();
  await expect(scene('chrono')).toBeVisible();
  const champ = alice.getByLabel('Un mot sur le sujet');
  await expect(champ).toBeVisible({ timeout: 6000 });
  await champ.fill('Cannelle');
  await champ.press('Enter');
  await champ.fill('Poivre');
  await alice.getByTestId('ajouter-mot').click();
  await expect(alice.getByTestId('mots-equipe')).toContainText('Poivre');
  // Un doublon (sans casse ni accents) est refusé sur le téléphone même.
  await champ.fill('cannellé');
  await champ.press('Enter');
  await expect(alice.getByText('Ce mot est déjà dans votre liste.')).toBeVisible();
  for (const mot of ['Cumin', 'Muscade', 'Safran'])
    expect((await motDeChloe(mot)).status()).toBe(200);
  expect((await motDeChloe('CUMIN')).status()).toBe(409);

  // L'écran compte, sans jamais montrer un mot ; Bruno voit la liste de son équipe.
  await expect(ecran.getByTestId('compteur-1')).toContainText('2 mots', { timeout: 5000 });
  await expect(ecran.getByTestId('compteur-2')).toContainText('3 mots', { timeout: 5000 });
  await expect(ecran.getByText('Cannelle')).toHaveCount(0);
  await expect(bruno.getByTestId('mots-equipe')).toContainText('Cannelle', { timeout: 6000 });
  await expect(bruno.getByLabel('Un mot sur le sujet')).toHaveCount(0);

  // La régie raye « Poivre » pendant le chrono : il ne paraîtra jamais à l'écran.
  await regie.getByRole('button', { name: 'Rayer « Poivre »' }).click();
  await expect(ecran.getByTestId('compteur-1')).toContainText('1 mot', { timeout: 5000 });

  // --- Fin du chrono : tous les mots d'un coup, sans « Poivre ».
  await expect(ecran.getByTestId('listes')).toBeVisible({ timeout: 25_000 });
  await expect(ecran.getByTestId('mots-1')).toContainText('Cannelle');
  await expect(ecran.getByTestId('mots-1')).not.toContainText('Poivre');
  await expect(ecran.getByTestId('mots-2')).toContainText('Safran');
  await expect(alice.getByTestId('statut-surenchere')).toHaveText(/Temps écoulé/, {
    timeout: 6000,
  });
  expect((await motDeChloe('Gingembre')).status()).toBe(409);

  // Rayé après la fin : barré à l'écran, le compteur baisse.
  await regie.getByRole('button', { name: 'Rayer « Muscade »' }).click();
  await expect(ecran.getByTestId('mots-2').locator('.tu-stage-mot--refuse')).toHaveText('Muscade', {
    timeout: 5000,
  });
  await expect(ecran.getByTestId('nombre-2')).toHaveText('2 mots');
  await ecran.screenshot({ path: test.info().outputPath('ecran-mots.png') });

  // --- Le classement : Chloé 2 mots, 1re (+100) ; Alice 1 mot, 2e (+60).
  await regie.getByRole('button', { name: 'Valider le classement' }).click();
  await regie.getByRole('button', { name: 'Confirmer : Valider le classement' }).click();
  await expect(scene('podium')).toBeVisible();
  await expect(ecran.getByTestId('place-2')).toContainText('1re place');
  await expect(ecran.getByTestId('place-2')).toContainText('+100');
  await expect(ecran.getByTestId('place-1')).toContainText('2e place');
  await expect(alice.getByTestId('statut-surenchere')).toHaveText('2e place : +60 points !', {
    timeout: 6000,
  });
  const { data: scores } = await service
    .from('scores')
    .select('equipe_id, points')
    .eq('evenement_id', evenement.id);
  expect(scores!.find((s) => s['equipe_id'] === equipe(2))?.['points']).toBe(100);
  expect(scores!.find((s) => s['equipe_id'] === equipe(1))?.['points']).toBe(60);

  // --- Retour aux thèmes : le thème joué dit qui était en tête.
  await regie.getByRole('button', { name: 'Retour aux thèmes' }).click();
  await expect(ecran.locator('[data-scene="enchere2"][data-etape="themes"]')).toContainText(
    'En tête : Équipe 2 · 2 mots',
  );
});

test('huit équipes de vingt-cinq mots tiennent dans l’écran', async ({ browser }) => {
  test.setTimeout(120_000);
  const evenement = await creerEvenementJetable({ equipes: 8, langues: ['fr', 'en', 'ta'] });
  evenements.push(evenement.id);
  const { manche, passages } = await preparerSurenchere(evenement.id, 60);
  const service = clientService();
  const { data: equipes } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id)
    .order('numero');
  const jeton = (i: number) => `mots-ecran-${evenement.id}-${i}`;
  const { error: e1 } = await service.from('joueurs').insert(
    equipes!.map((e, i) => ({
      evenement_id: evenement.id,
      equipe_id: e['id'],
      prenom: `Capitaine ${i + 1}`,
      langue: 'fr',
      capitaine: true,
      jeton_hash: hacher(jeton(i)),
    })),
  );
  if (e1) throw new Error(e1.message);

  // Le chrono lancé, puis écoulé : la base donne alors les mots à l'écran.
  const anna = await clientAnimateur('anna@teamup.test');
  const etape = async (pilotage: object, extra: object = {}) => {
    const { data } = await appeler<{ pilotage: { version: string } }>(anna, 'etat_ecran', {
      p_code: evenement.code,
    });
    const { erreur } = await appeler(anna, 'enregistrer_etape', {
      p_evenement: evenement.id,
      p_version: data!.pilotage.version,
      p_pilotage: pilotage,
      ...extra,
    });
    expect(erreur).toBeNull();
  };
  await etape(
    { scene: 'jeu', manche_id: manche, passage_id: null, etape: 'themes' },
    { p_manche: { id: manche, statut: 'en_cours', options: { mode: 'telephones' } } },
  );
  await etape(
    {
      scene: 'jeu',
      manche_id: manche,
      passage_id: passages[0],
      etape: 'chrono',
      chrono: 'demarrer',
      chrono_duree_s: 60,
    },
    { p_passage: { id: passages[0], statut: 'en_cours' } },
  );
  // Vingt-cinq mots par équipe, de longueurs variées, en trois langues.
  const MOTS = [
    'Cannelle',
    'Curcuma',
    'Piment d’Espelette',
    'Cardamome verte',
    'Gingembre',
    'Clou de girofle',
    'Muscade',
    'Safran',
    'Paprika fumé',
    'Cumin',
    'Coriandre',
    'Fenugrec',
    'Poivre de Sichuan',
    'Anis étoilé',
    'Sumac',
    'Garam masala',
    'Cinnamon',
    'Black pepper',
    'Turmeric',
    'மஞ்சள்',
    'மிளகு',
    'ஏலக்காய்',
    'Vanille de Madagascar',
    'Zaatar',
    'Ras el hanout',
  ];
  const { error: e2 } = await service.from('mots_surenchere').insert(
    equipes!.flatMap((e) =>
      MOTS.map((mot, i) => ({
        passage_id: passages[0],
        evenement_id: evenement.id,
        equipe_id: e['id'],
        mot,
        cle: `${i}`,
      })),
    ),
  );
  if (e2) throw new Error(e2.message);
  await service
    .from('pilotage')
    .update({ chrono_depart: new Date(Date.now() - 70_000).toISOString() })
    .eq('evenement_id', evenement.id);

  const regie = await connecterRegie(browser);
  const ecran = await ouvrirEcran(browser, regie, evenement.code);
  await expect(ecran.getByTestId('listes')).toBeVisible();
  await expect(ecran.locator('.tu-stage-mots__carte')).toHaveCount(8);
  await expect(ecran.locator('.tu-stage-mot')).toHaveCount(8 * MOTS.length);
  await ecran.waitForTimeout(1000);

  // Le texte s'est réduit jusqu'à tenir : aucune carte ne déborde, aucune ne sort de l'écran.
  const debords = await ecran.locator('.tu-stage-mots__carte').evaluateAll((cartes) =>
    cartes
      .map((c) => {
        const bas = c.getBoundingClientRect().bottom;
        const boites = [...c.querySelectorAll('*')].map((e) => e.getBoundingClientRect());
        return Math.max(0, ...boites.map((r) => r.bottom - bas));
      })
      .filter((ecart) => ecart > 1),
  );
  expect(debords, 'cartes qui débordent').toEqual([]);
  for (const carte of await ecran.locator('.tu-stage-mots__carte').all()) {
    await expect(carte).toBeInViewport({ ratio: 1 });
  }
  await ecran.screenshot({ path: test.info().outputPath('ecran-mots-8-equipes.png') });
});
