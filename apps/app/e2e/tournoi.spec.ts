import { devices, expect, request, test, type Browser, type Page } from '@playwright/test';
import {
  aleaDepuis,
  prochaineSequence,
  tirerTableau,
  type Duelliste,
  type MatchTournoi,
} from '@teamup/game';
import {
  appeler,
  clientAnimateur,
  clientService,
  creerEvenementJetable,
  hacher,
  supprimerEvenements,
} from '../tests/base';

/**
 * Tournoi de Tête, épaule, gobelet (2026-11-21). Quatre équipes de quatre et quatre gobelets, du
 * tirage au podium : les postes à l'écran et au téléphone, les perdants notés à la régie, une
 * correction, un rechargement en plein tournoi, les points. Puis la grille de 32 postes d'une
 * salle de 100 joueurs, en 1 920 × 1 080 : aucun prénom coupé ni hors cadre.
 */

const crees: string[] = [];
const PRENOMS = [
  'Camille',
  'Dina',
  'Élias',
  'Fatou',
  'Gaspard',
  'Hugo',
  'Inès',
  'Jade',
  'Kumar',
  'Léa',
  'Malik',
  'Nora',
  'Oscar',
  'Priya',
];

test.afterAll(async () => {
  await supprimerEvenements(crees);
});

/** `CAPTURES=<dossier>` : une capture à chaque moment clé (revue visuelle). */
const CAPTURES = process.env['CAPTURES'];
const capturer = async (page: Page, nom: string) => {
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/tournoi-${nom}.png` });
};

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

test('tournoi : du tirage au podium, avec les perdants notés à la régie', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(300_000);
  const service = clientService();
  const ev = await creerEvenementJetable({ equipes: 4, langues: ['fr'] });
  crees.push(ev.id);

  // --- Deux vrais téléphones, puis la salle complétée à quatre équipes de quatre.
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
  const [{ data: lesEquipes }, { data: arrives }] = await Promise.all([
    service.from('equipes').select('id, numero').eq('evenement_id', ev.id),
    service.from('joueurs').select('equipe_id').eq('evenement_id', ev.id),
  ]);
  const places = (lesEquipes as { id: string }[]).flatMap((e) => {
    const deja = (arrives as { equipe_id: string }[]).filter((j) => j.equipe_id === e.id).length;
    return Array.from({ length: 4 - deja }, () => e.id);
  });
  const { error } = await service.from('joueurs').insert(
    places.map((equipe_id, i) => ({
      evenement_id: ev.id,
      equipe_id,
      prenom: PRENOMS[i]!,
      langue: 'fr',
      jeton_hash: hacher(`tournoi-e2e-${ev.id}-${i}`),
    })),
  );
  expect(error).toBeNull();
  const [ana] = telephones as [Page, Page];
  for (const t of telephones) await t.goto(`/${ev.code}`);

  // --- La préparation : le tournoi est le format par défaut du gobelet.
  const regie = await connecter(browser, 'anna@teamup.test');
  await regie.goto(`/regie/${ev.code}/preparation`);
  const bouton = regie.getByRole('button', { name: 'Ajouter Tête, épaule, gobelet' });
  await regie.locator('form', { has: bouton }).getByLabel('Gobelets').fill('4');
  await bouton.click();
  await expect(regie.getByText('Tournoi · 4 gobelets')).toBeVisible({ timeout: 30_000 });

  const ecran = await ouvrirEcran(browser, regie, ev.code);
  const scene = (etape: string) => ecran.locator(`[data-scene="tournoi"][data-etape="${etape}"]`);

  // --- Le tirage.
  await regie.goto(`/regie/${ev.code}/pilotage`);
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await regie.getByRole('button', { name: 'Commencer : Tête, épaule, gobelet' }).click();
  await expect(scene('tirage')).toBeVisible({ timeout: 10_000 });
  await expect(regie.getByTestId('tournoi-estimation')).toContainText('6 séquences');
  await regie.getByRole('button', { name: 'Tirer le tableau' }).click();
  await expect(regie.getByTestId('tournoi-joueurs')).toContainText('16 joueurs, 0 exempté', {
    timeout: 10_000,
  });
  await expect(ecran.getByTestId('tournoi-compte')).toContainText('16 joueurs', {
    timeout: 10_000,
  });
  await expect(ana.getByTestId('tournoi-joueur')).toHaveAttribute('data-cas', 'attente', {
    timeout: 10_000,
  });

  // --- La première séquence : quatre postes, à l'écran et au téléphone de qui joue.
  await regie.getByRole('button', { name: 'Jouer les 4 premiers matchs' }).click();
  await expect(scene('appel')).toBeVisible({ timeout: 10_000 });
  // Seize joueurs : le tour des 16 tient dans l'arbre, chaque match appelé porte son poste.
  await expect(ecran.getByTestId('tournoi-arbre')).toBeVisible();
  await expect(ecran.getByTestId('tournoi-tour')).toHaveText('Tour des 16');
  await expect(ecran.locator('[data-testid^="poste-"]')).toHaveCount(4);
  await expect(ana.getByTestId('tournoi-nom-tour')).toHaveText('Tour des 16', {
    timeout: 10_000,
  });
  await capturer(ecran, 'ecran-appel');
  const lireMatchs = async () => {
    const { data } = await service
      .from('matchs_tournoi')
      .select('tour, rang, sequence, poste, prenom_a, prenom_b, gagnant')
      .eq('evenement_id', ev.id);
    return data as {
      tour: number;
      rang: number;
      sequence: number | null;
      poste: number | null;
      prenom_a: string | null;
      prenom_b: string | null;
      gagnant: number | null;
    }[];
  };
  const matchDAna = (await lireMatchs()).find(
    (m) => m.tour === 1 && (m.prenom_a === 'Ana' || m.prenom_b === 'Ana'),
  )!;
  const adversaire = matchDAna.prenom_a === 'Ana' ? matchDAna.prenom_b! : matchDAna.prenom_a!;
  if (matchDAna.sequence === 1) {
    await expect(ana.getByTestId('tournoi-poste')).toHaveText(`Poste ${matchDAna.poste}`, {
      timeout: 10_000,
    });
    await expect(ana.getByTestId('tournoi-adversaire')).toContainText(adversaire);
  } else {
    await expect(ana.getByTestId('tournoi-adversaire')).toContainText(adversaire, {
      timeout: 10_000,
    });
    await expect(ana.getByTestId('tournoi-joueur')).toHaveAttribute('data-cas', 'attente');
  }

  // La séquence à annoncer reste sur la régie.
  await expect(regie.getByTestId('sequence')).toBeVisible();
  await capturer(ana, 'telephone-appel');
  await expect(ecran.getByTestId('sequence')).toHaveCount(0);

  await regie.getByRole('button', { name: 'Lancer la séquence' }).click();
  await expect(scene('jeu')).toBeVisible({ timeout: 10_000 });
  await regie.getByRole('button', { name: 'Fin de la séquence' }).click();
  await expect(scene('resultats')).toBeVisible({ timeout: 10_000 });

  // --- Une correction : le mauvais prénom touché, puis annulé, puis le bon.
  const lignes = regie.getByTestId('tournoi-matchs').locator('li');
  await lignes
    .nth(0)
    .getByRole('button', { name: /a perdu/ })
    .nth(0)
    .click();
  await expect(regie.getByTestId('tournoi-compteur')).toContainText('1 résultat sur 4');
  await expect(ecran.locator('[data-testid="poste-1"][data-juge="true"]')).toBeVisible({
    timeout: 10_000,
  });
  await lignes
    .nth(0)
    .getByRole('button', { name: /Annuler le résultat/ })
    .click();
  await expect(regie.getByTestId('tournoi-compteur')).toContainText('0 résultat sur 4');
  await expect(ecran.locator('[data-testid="poste-1"][data-juge="false"]')).toBeVisible({
    timeout: 10_000,
  });

  await lignes
    .nth(1)
    .getByRole('button', { name: /a perdu/ })
    .nth(0)
    .click();
  await expect(ecran.locator('[data-testid="poste-2"][data-juge="true"]')).toBeVisible({
    timeout: 10_000,
  });
  await capturer(regie, 'regie-resultats');
  await capturer(ecran, 'ecran-resultats');

  // Tant qu'un résultat manque, pas de séquence suivante.
  await expect(regie.getByRole('button', { name: /^Jouer l/ })).toHaveCount(0);

  // --- Un perdant retrouvé par son prénom : le champ se vide pour le suivant.
  const prenomCherche = (await lireMatchs()).find((m) => m.poste === 3)!.prenom_b!;
  await regie.getByTestId('tournoi-recherche').fill(prenomCherche);
  await expect(lignes).toHaveCount(1);
  await lignes.getByRole('button', { name: `${prenomCherche} a perdu` }).click();
  await expect(regie.getByTestId('tournoi-recherche')).toHaveValue('');
  await expect(lignes).toHaveCount(4);

  const noterLesRestants = async () => {
    const total = await lignes.count();
    for (let i = 0; i < total; i++) {
      if ((await lignes.nth(i).getAttribute('data-juge')) === 'true') continue;
      await lignes
        .nth(i)
        .getByRole('button', { name: /a perdu/ })
        .nth(1)
        .click();
      await expect(lignes.nth(i)).toHaveAttribute('data-juge', 'true');
    }
  };
  await noterLesRestants();

  // --- Un écran rechargé en plein tournoi retombe au même endroit.
  await expect(ecran.locator('[data-testid="poste-4"][data-juge="true"]')).toBeVisible({
    timeout: 10_000,
  });
  await ecran.reload();
  await expect(scene('resultats')).toBeVisible({ timeout: 15_000 });
  await expect(ecran.locator('[data-testid^="poste-"][data-juge="true"]')).toHaveCount(4);

  // --- La suite, trois matchs à la fois au choix de la régie, puis demi-finales et finale une à
  // une : 4, 3, 1 pour le tour des 16, 3, 1 pour les quarts.
  await regie.getByTestId('tournoi-gobelets').fill('3');
  await expect(regie.getByRole('button', { name: 'Jouer les 3 prochains matchs' })).toBeVisible();
  await expect(regie.getByTestId('tournoi-restants')).toContainText('4 matchs restent');
  await capturer(regie, 'regie-choix');
  const tailles = [4];
  // Ce parcours ne mesure aucune latence, et l'accès à Docker s'arrête parfois 10 s sur le poste.
  const patience = { timeout: 20_000 };
  for (;;) {
    const suivante = regie.getByRole('button', { name: /^Jouer l/ });
    const vainqueur = regie.getByRole('button', { name: 'Voir le vainqueur' });
    await expect(suivante.or(vainqueur)).toBeEnabled(patience);
    if (await vainqueur.isVisible()) break;
    await suivante.click();
    await expect(regie.getByRole('button', { name: 'Lancer la séquence' })).toBeVisible(patience);
    await expect(scene('appel')).toBeVisible(patience);
    const numero = Math.max(...(await lireMatchs()).map((m) => m.sequence ?? 0));
    tailles.push((await lireMatchs()).filter((m) => m.sequence === numero).length);
    await regie.getByRole('button', { name: 'Lancer la séquence' }).click();
    await expect(scene('jeu')).toBeVisible(patience);
    await regie.getByRole('button', { name: 'Fin de la séquence' }).click();
    await expect(scene('resultats')).toBeVisible(patience);
    await expect(regie.getByTestId('tournoi-compteur')).toBeVisible();
    if (tailles.length === 6) await capturer(ecran, 'ecran-demi');
    await noterLesRestants();
    // Les quarts jugés : les qualifiés ont rejoint les demi-finales, dans l'arbre.
    if (tailles.length === 5) {
      await expect(ecran.locator('[data-testid^="poste-"][data-juge="false"]')).toHaveCount(0, {
        timeout: 10_000,
      });
      await expect(ecran.getByTestId('tournoi-arbre')).toBeVisible();
      await capturer(ecran, 'ecran-tableau');
    }
  }
  expect(tailles).toEqual([4, 3, 1, 3, 1, 1, 1, 1]);
  await expect(ecran.getByTestId('verdict')).toContainText('gagne le tournoi', { timeout: 10_000 });
  await capturer(ecran, 'ecran-verdict');

  // --- Le podium et les points : 100 + 60 + 30 + 30.
  await regie.getByRole('button', { name: 'Voir le vainqueur' }).click();
  await expect(scene('vainqueur')).toBeVisible({ timeout: 10_000 });
  await expect(ecran.getByTestId('tournoi-podium-1')).toBeVisible();
  // Le 3e, puis le 2e, puis le 1er : la capture attend que les trois soient là.
  if (CAPTURES) await ecran.waitForTimeout(4000);
  await capturer(ecran, 'ecran-podium');
  await expect(ecran.getByTestId('tournoi-podium-2')).toBeVisible();
  await expect(ecran.getByTestId('tournoi-podium-3').locator('.tu-team--badge')).toHaveCount(2);
  await expect
    .poll(async () => {
      const { data } = await service.from('scores').select('points').eq('evenement_id', ev.id);
      return (data as { points: number }[]).reduce((n, s) => n + s.points, 0);
    })
    .toBe(220);
  await expect(ana.getByTestId('tournoi-joueur')).toHaveAttribute('data-cas', /elimine|champion/, {
    timeout: 10_000,
  });

  await regie.getByRole('button', { name: 'Terminer la manche' }).click();
  await expect(ecran.locator('[data-scene="programme"]')).toBeVisible({ timeout: 10_000 });
});

test('100 joueurs : le tour des 128 et ses exemptés tiennent, chaque prénom entier', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const service = clientService();
  const ev = await creerEvenementJetable({ equipes: 8, langues: ['fr'] });
  crees.push(ev.id);
  const { data: lesEquipes } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', ev.id);
  const equipes = lesEquipes as { id: string; numero: number }[];

  const { data: lus, error } = await service
    .from('joueurs')
    .insert(
      Array.from({ length: 100 }, (_, i) => ({
        evenement_id: ev.id,
        equipe_id: equipes[i % 8]!.id,
        // Des prénoms longs, tous différents.
        prenom: `${i % 2 ? 'Balasubramaniam' : 'Marie-Alexandrine'} ${i}`,
        langue: 'fr',
        jeton_hash: hacher(`tournoi-100-${ev.id}-${i}`),
      })),
    )
    .select('id, prenom, equipe_id');
  expect(error).toBeNull();
  const numero = new Map(equipes.map((e) => [e.id, e.numero]));
  const joueurs: Duelliste[] = (lus as { id: string; prenom: string; equipe_id: string }[]).map(
    (j) => ({ joueur_id: j.id, prenom: j.prenom, equipe: numero.get(j.equipe_id)! }),
  );

  const { data: m } = await service
    .from('manches')
    .insert({
      evenement_id: ev.id,
      jeu: 'cup',
      ordre: 1,
      statut: 'en_cours',
      options: { format: 'tournoi' },
    })
    .select('id')
    .single();
  const manche = (m as { id: string }).id;
  const { data: pa } = await service
    .from('passages')
    .insert({ manche_id: manche, evenement_id: ev.id, ordre: 1, statut: 'en_cours' })
    .select('id')
    .single();
  const passage = (pa as { id: string }).id;
  await service
    .from('pilotage')
    .update({ scene: 'jeu', manche_id: manche, passage_id: passage, etape: 'tirage' })
    .eq('evenement_id', ev.id);

  const anna = await clientAnimateur('anna@teamup.test');
  const tableau = tirerTableau(joueurs, aleaDepuis('cent'))!;
  const pose = await appeler(anna, 'poser_tableau', {
    p_manche: manche,
    p_premier_tour: tableau
      .filter((x) => x.tour === 1)
      .map((x) => ({ rang: x.rang, a: x.a?.joueur_id, b: x.b?.joueur_id ?? null })),
    p_gobelets: 32,
  });
  expect(pose.erreur).toBeNull();

  const { data: lignes } = await service
    .from('matchs_tournoi')
    .select('id, tour, rang, prenom_a, equipe_a, joueur_a, prenom_b, equipe_b, joueur_b, gagnant')
    .eq('manche_id', manche);
  type Ligne = {
    id: string;
    tour: number;
    rang: number;
    joueur_a: string | null;
    prenom_a: string | null;
    equipe_a: number | null;
    joueur_b: string | null;
    prenom_b: string | null;
    equipe_b: number | null;
    gagnant: 0 | 1 | null;
  };
  const matchs: (MatchTournoi & { id: string })[] = (lignes as Ligne[]).map((l) => ({
    id: l.id,
    tour: l.tour,
    rang: l.rang,
    a: l.prenom_a ? { joueur_id: l.joueur_a!, prenom: l.prenom_a, equipe: l.equipe_a! } : null,
    b: l.prenom_b ? { joueur_id: l.joueur_b!, prenom: l.prenom_b, equipe: l.equipe_b! } : null,
    gagnant: l.gagnant,
    sequence: null,
    poste: null,
  }));
  const sequence = prochaineSequence(matchs, 32)!;
  expect(sequence.matchs).toHaveLength(32);
  const { data: version } = await service
    .from('pilotage')
    .select('maj_le')
    .eq('evenement_id', ev.id)
    .single();
  const ouverte = await appeler(anna, 'ouvrir_sequence', {
    p_manche: manche,
    p_version: (version as { maj_le: string }).maj_le,
    p_numero: sequence.numero,
    p_matchs: sequence.matchs.map((x) => x.id),
    p_gobelets: 32,
    p_pilotage: {
      scene: 'jeu',
      manche_id: manche,
      passage_id: passage,
      etape: 'appel',
      indices: 0,
      chrono: 'arreter',
    },
  });
  expect(ouverte.erreur).toBeNull();

  const regie = await connecter(browser, 'anna@teamup.test');
  const ecran = await ouvrirEcran(browser, regie, ev.code);
  // Tout l'arbre à l'écran : les 100 prénoms, les 32 matchs lancés portant leur poste.
  await expect(ecran.locator('.tu-arbre__place[data-tour="1"]')).toHaveCount(100, {
    timeout: 10_000,
  });
  await expect(ecran.locator('[data-testid^="poste-"]')).toHaveCount(32);
  await expect(ecran.getByTestId('tournoi-exemptes')).toContainText('28 exemptés');
  await ecran.evaluate(() => document.fonts.ready);

  await expect(ecran.getByTestId('tournoi-tour')).toHaveText('Tour des 128');
  await capturer(ecran, 'ecran-32-postes');

  const mesure = await ecran.evaluate(() => {
    const dehors = (r: DOMRect) =>
      r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1;
    const places = [...document.querySelectorAll<HTMLElement>('.tu-arbre__place[data-tour="1"]')];
    const prenoms = [...document.querySelectorAll<HTMLElement>('.tu-arbre__prenom')];
    const cadres = places.map((p) => p.getBoundingClientRect());
    return {
      places: places.length,
      hors: [
        ...places,
        ...document.querySelectorAll<HTMLElement>('.tu-arbre__poste, .tu-arbre__centre'),
      ].filter((p) => dehors(p.getBoundingClientRect())).length,
      chevauchent: cadres.filter((r, i) =>
        cadres.some(
          (o, j) =>
            j > i && r.left < o.right && o.left < r.right && r.top < o.bottom && o.top < r.bottom,
        ),
      ).length,
      prenoms: prenoms.length,
      // Au sous-pixel : scrollWidth arrondit, et un prénom coupé d'une fraction passait.
      coupes: prenoms.filter((p) => {
        const plage = document.createRange();
        plage.selectNodeContents(p);
        const s = getComputedStyle(p);
        const place =
          p.getBoundingClientRect().width -
          parseFloat(s.paddingLeft) -
          parseFloat(s.paddingRight) -
          parseFloat(s.borderLeftWidth) -
          parseFloat(s.borderRightWidth);
        return plage.getBoundingClientRect().width > place + 0.05;
      }).length,
      taille: Math.min(...prenoms.map((p) => parseFloat(getComputedStyle(p).fontSize))),
    };
  });
  test.info().annotations.push({
    type: 'plus petit prénom à l’écran',
    description: `${mesure.taille.toFixed(1)} px`,
  });
  expect(mesure).toMatchObject({ places: 100, hors: 0, chevauchent: 0, prenoms: 100, coupes: 0 });
});

test('l’arbre tient dans le cadre à chaque tour, de 16 à 150 joueurs', async ({ browser }) => {
  const page = await (
    await browser.newContext({ viewport: { width: 1920, height: 1080 }, isMobile: false })
  ).newPage();
  for (const [joueurs, tour, etape] of [
    [16, 1, 'tirage'],
    [16, 2, 'juge'],
    [80, 1, 'appel'],
    [100, 1, 'tirage'],
    [100, 2, 'appel'],
    [100, 3, 'appel'],
    [100, 5, 'juge'],
    [128, 1, 'appel'],
    [150, 1, 'tirage'],
    [150, 4, 'appel'],
  ] as const) {
    await page.goto(`/kit-ui/tournoi?joueurs=${joueurs}&tour=${tour}&etape=${etape}`);
    await expect(page.getByTestId('tournoi-arbre')).toBeVisible();
    await expect(page.locator('.tu-arbre__place[data-tour="1"]')).toHaveCount(joueurs);
    const hors = await page.evaluate(
      () =>
        [...document.querySelectorAll('.tu-arbre__place, .tu-arbre__poste')].filter((p) => {
          const r = p.getBoundingClientRect();
          return (
            r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1
          );
        }).length,
    );
    expect(hors, `${joueurs} joueurs, tour ${tour}`).toBe(0);
  }
});
