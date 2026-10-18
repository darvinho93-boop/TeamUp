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
 * Quiz en mode jetons (2026-10-18) : le capitaine de chaque équipe répartit ses jetons sur les
 * réponses depuis son téléphone ; l'écran montre les mises dans les cases, en direct ; une
 * équipe figée au chrono se débloque à la régie ; les jetons restants valent × 100.
 */

// Contenus de la démo : bonnes réponses 1 (« 8 pattes »), 2 (« Mercure »), 0 (« 90 »).
const QUESTIONS = [
  'aaaa0301-0000-4000-8000-000000000301',
  'aaaa0302-0000-4000-8000-000000000302',
  'aaaa0303-0000-4000-8000-000000000303',
];

const evenements: string[] = [];
const contenus: string[] = [];
test.afterAll(async () => {
  await supprimerEvenements(evenements);
  if (contenus.length) await clientService().from('contenus').delete().in('id', contenus);
});

/** Une manche de quiz de trois questions, préparée en base. */
async function preparerQuiz(evenementId: string): Promise<{ manche: string; passages: string[] }> {
  const service = clientService();
  const { data: m } = await service
    .from('manches')
    .insert({ evenement_id: evenementId, jeu: 'qcm2', ordre: 1, options: { questions: 3 } })
    .select('id')
    .single();
  const manche = m!['id'] as string;
  const { data: passages, error } = await service
    .from('passages')
    .insert(
      QUESTIONS.map((contenu, i) => ({
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

test('le capitaine mise pour son équipe ; figée au chrono, la régie la débloque', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
  evenements.push(evenement.id);
  const { code } = evenement;
  await preparerQuiz(evenement.id);
  const service = clientService();
  const { data: equipes } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id)
    .order('numero');
  const equipe = (n: number) => equipes!.find((e) => e['numero'] === n)!['id'] as string;

  // --- Les invités : Alice (capitaine) et Bruno au téléphone, Dan par l'API, dans l'équipe 1 ;
  // Chloé (capitaine) et Emma par l'API dans l'équipe 2. Trois jetons pour chacune.
  const placer = async (prenom: string, numero: number) => {
    const { error } = await service
      .from('joueurs')
      .update({ equipe_id: equipe(numero) })
      .eq('evenement_id', evenement.id)
      .eq('prenom', prenom);
    if (error) throw new Error(error.message);
  };
  const telephone = async (prenom: string, numero: number) => {
    const page = await (await browser.newContext()).newPage();
    const arrivee = await page.request.post(`/api/partie/${code}/rejoindre`, {
      data: { prenom, langue: 'fr' },
    });
    expect(arrivee.status()).toBe(200);
    await placer(prenom, numero);
    await page.goto(`/${code}`);
    await expect(page.getByText(`Salut ${prenom} !`)).toBeVisible();
    return page;
  };
  const api = async (prenom: string, numero: number) => {
    const contexte = await request.newContext({
      baseURL: baseURL!,
      extraHTTPHeaders: { connection: 'close' },
    });
    expect(
      (
        await contexte.post(`/api/partie/${code}/rejoindre`, { data: { prenom, langue: 'fr' } })
      ).status(),
    ).toBe(200);
    await placer(prenom, numero);
    return contexte;
  };
  const alice = await telephone('Alice', 1);
  const bruno = await telephone('Bruno', 1);
  await api('Dan', 1);
  const chloe = await api('Chloé', 2);
  await api('Emma', 2);
  const miser = (repartition: number[], valider = false) =>
    chloe.post(`/api/partie/${code}/mise`, { data: { repartition, valider } });

  const regie = await connecterRegie(browser);
  const ecran = await ouvrirEcran(browser, regie, code);
  const scene = (nom: string, etape = '') =>
    ecran.locator(`[data-scene="${nom}"]${etape ? `[data-etape="${etape}"]` : ''}`);
  await regie.goto(`/regie/${code}/pilotage`);

  // --- Sans capitaine, le mode jetons ne part pas.
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await expect(scene('intro')).toBeVisible({ timeout: 30_000 });
  const jetons = regie.getByRole('button', { name: /^Mode jetons/ });
  await expect(jetons).toBeDisabled();
  await expect(regie.getByTestId('capitaines-jetons')).toContainText('Aucun capitaine');

  // L'explication du mode jetons se lance depuis l'intro, avant le lancement.
  await regie.getByRole('button', { name: 'Expliquer (jetons)' }).click();
  const explication = ecran.locator('[data-scene="explication"]');
  await expect(explication).toHaveAttribute('data-carte', '1', { timeout: 2000 });
  await expect(ecran.getByTestId('phrase-explication')).toContainText("l'équipe se concerte");
  await expect(explication).toHaveAttribute('data-carte', '2', { timeout: 8000 });
  await expect(ecran.getByTestId('phrase-explication')).toContainText('Ton capitaine a des jetons');
  await regie.getByRole('button', { name: "Arrêter l'explication" }).click();
  await expect(scene('intro')).toBeVisible();

  // La régie nomme les capitaines (ici en base ; la Salle a son propre e2e).
  await service
    .from('joueurs')
    .update({ capitaine: true })
    .eq('evenement_id', evenement.id)
    .in('prenom', ['Alice', 'Chloé']);
  await regie.reload();
  await expect(regie.getByTestId('capitaines-jetons')).toContainText(
    'Chaque équipe part avec 3 jetons',
  );
  await expect(regie.getByTestId('capitaines-jetons')).toContainText('Alice');
  await expect(jetons).toBeEnabled();
  await jetons.click();
  await expect(scene('qcm2', 'pret')).toBeVisible();

  // --- Question 1 (bonne : B). Alice pose 2 sur B, 1 sur C ; l'écran le montre avant même
  // la validation, Bruno le voit en lecture seule.
  await regie.getByRole('button', { name: 'Afficher la question' }).click();
  await expect(scene('qcm2', 'question')).toBeVisible();
  const plus = (page: Page, lettre: string) =>
    page.getByRole('button', { name: `Ajouter un jeton sur la réponse ${lettre}` });
  await expect(plus(alice, 'B')).toBeVisible({ timeout: 5000 });
  await expect(alice.getByTestId('statut-quiz')).toHaveText('Reste 3 jetons à poser');
  await plus(alice, 'B').click();
  await plus(alice, 'B').click();
  await plus(alice, 'C').click();
  await expect(alice.getByTestId('mise-B')).toHaveText('2');
  await expect(alice.getByTestId('statut-quiz')).toHaveText(/Tous les jetons sont posés/);
  await expect(plus(alice, 'A')).toBeDisabled();

  await expect(ecran.getByTestId('mises-B')).toContainText('Équipe 1', { timeout: 5000 });
  await expect(ecran.getByTestId('mises-B').locator('.tu-stage-mise__nombre')).toHaveText('2');
  await expect(bruno.getByTestId('mise-B')).toHaveText('2', { timeout: 8000 });
  await expect(plus(bruno, 'B')).toHaveCount(0);

  await alice.getByRole('button', { name: 'Valider la mise' }).click();
  await expect(alice.getByTestId('statut-quiz')).toHaveText(/Mise validée/);
  await expect(regie.getByTestId('regie-mise-1')).toHaveAttribute('data-statut', 'validee');
  await expect(regie.getByRole('button', { name: 'Révéler la réponse' })).toBeDisabled();

  // Chloé pose sans valider, puis le chrono tombe : l'équipe 2 est figée.
  expect((await miser([0, 0, 3, 0])).status()).toBe(200);
  await expect(ecran.getByTestId('mises-C')).toContainText('Équipe 2', { timeout: 5000 });
  await service
    .from('pilotage')
    .update({ chrono_depart: new Date(Date.now() - 32_000).toISOString() })
    .eq('evenement_id', evenement.id);
  expect((await miser([0, 0, 3, 0], true)).status()).toBe(409);
  await regie.reload();
  await expect(regie.getByTestId('regie-mise-2')).toHaveAttribute('data-statut', 'figee');

  // La régie la débloque : Chloé change d'avis et valide.
  await regie.getByTestId('regie-mise-2').getByRole('button', { name: 'Débloquer' }).click();
  await expect(regie.getByTestId('regie-mise-2')).toHaveAttribute('data-statut', 'en_cours');
  expect((await miser([1, 2, 0, 0], true)).status()).toBe(200);
  await expect(regie.getByTestId('regie-mise-2')).toHaveAttribute('data-statut', 'validee', {
    timeout: 5000,
  });

  await regie.getByRole('button', { name: 'Révéler la réponse' }).click();
  await expect(ecran.getByTestId('bonne-reponse')).toBeVisible();
  await expect(ecran.getByTestId('bonne-reponse')).toContainText('Équipe 1');
  await expect(ecran.getByTestId('bonne-reponse')).toContainText('Équipe 2');
  await expect(alice.getByTestId('statut-quiz')).toHaveText('Il vous reste 2 jetons', {
    timeout: 5000,
  });

  // --- Question 2 (bonne : C). Alice mise tout sur C ; Chloé ne fait rien, la régie révèle
  // quand même : l'équipe 2 perd ses jetons non posés.
  await regie.getByRole('button', { name: 'Question suivante' }).click();
  await regie.getByRole('button', { name: 'Afficher la question' }).click();
  await expect(scene('qcm2', 'question')).toBeVisible();
  await expect(plus(alice, 'C')).toBeVisible({ timeout: 5000 });
  await plus(alice, 'C').click();
  await plus(alice, 'C').click();
  await alice.getByRole('button', { name: 'Valider la mise' }).click();
  await expect(regie.getByTestId('regie-mise-1')).toHaveAttribute('data-statut', 'validee', {
    timeout: 5000,
  });
  await expect(regie.getByRole('button', { name: 'Révéler la réponse' })).toBeDisabled();
  const quandMeme = 'Révéler quand même (jetons non posés perdus)';
  await regie.getByRole('button', { name: quandMeme, exact: true }).click();
  await regie.getByRole('button', { name: `Confirmer : ${quandMeme}` }).click();
  await expect(ecran.getByTestId('bonne-reponse')).toBeVisible();

  // --- Question 3 (bonne : A). L'équipe 2 n'a plus de jetons : « Révéler » n'attend qu'Alice.
  await regie.getByRole('button', { name: 'Question suivante' }).click();
  await regie.getByRole('button', { name: 'Afficher la question' }).click();
  await expect(scene('qcm2', 'question')).toBeVisible();
  await expect(regie.getByTestId('regie-mise-2')).toHaveAttribute('data-statut', 'sans_jetons');
  expect((await miser([0, 0, 0, 0], true)).status()).toBe(200);
  await expect(plus(alice, 'A')).toBeVisible({ timeout: 5000 });
  await plus(alice, 'A').click();
  await plus(alice, 'A').click();
  await alice.getByRole('button', { name: 'Valider la mise' }).click();
  await expect(regie.getByRole('button', { name: 'Révéler la réponse' })).toBeEnabled({
    timeout: 5000,
  });
  await regie.getByRole('button', { name: 'Révéler la réponse' }).click();
  await expect(ecran.getByTestId('bonne-reponse')).toBeVisible();
  await regie.getByRole('button', { name: 'Fin des questions' }).click();

  // --- Les jetons restants valent des survivants : × 100.
  await expect(scene('qcm2', 'survivants')).toBeVisible();
  await expect(regie.getByTestId('survivants-1')).toHaveText('2 jetons');
  await expect(regie.getByTestId('survivants-2')).toHaveText('aucun jeton');
  await expect(ecran.getByTestId('survivants')).toContainText('2 jetons');
  await regie.getByRole('button', { name: 'Valider les jetons restants', exact: true }).click();
  await regie.getByRole('button', { name: 'Confirmer : Valider les jetons restants' }).click();
  await expect(scene('qcm2', 'resultat')).toBeVisible();
  const { data: scores } = await service
    .from('scores')
    .select('equipe_id, points, motif')
    .eq('evenement_id', evenement.id);
  expect(scores).toEqual([{ equipe_id: equipe(1), points: 200, motif: 'Quiz – 2 jetons' }]);
});

/**
 * Une question aux réponses longues, en trois langues : le pire cas des cases de l'écran (vu le
 * 2026-10-18 avec le quiz d'un mariage). Bonne réponse : B.
 */
const QUESTION_LONGUE = {
  fr: {
    question:
      'Et pour finir, selon vous, pourquoi cette équipe fonctionne-t-elle si bien ensemble ?',
    propositions: [
      "Parce qu'ils sont tous exactement pareils",
      "Parce qu'ils sont complémentaires malgré leurs différences",
      "Parce qu'ils aiment toujours tous les mêmes choses",
      "Parce que l'un sait garder son calme quand l'autre veut que tout soit parfait",
    ],
  },
  en: {
    question: 'And finally, why do you think this team works so well together?',
    propositions: [
      'Because they are all exactly alike',
      'Because they complement each other despite their differences',
      'Because they all always like the same things',
      'Because one knows how to stay calm when the other wants everything to be perfect',
    ],
  },
  ta: {
    question: 'இறுதியாக, இந்த அணி ஏன் இவ்வளவு நன்றாக ஒத்துப்போகிறது?',
    propositions: [
      'ஏனென்றால் அவர்கள் அனைவரும் முற்றிலும் ஒரே மாதிரியானவர்கள்',
      'ஏனென்றால் வேறுபாடுகள் இருந்தாலும் அவர்கள் ஒருவரையொருவர் நிறைவு செய்கிறார்கள்',
      'ஏனென்றால் அவர்கள் அனைவருக்கும் எப்போதும் ஒரே விஷயங்கள் பிடிக்கும்',
      'ஏனென்றால் ஒருவர் எல்லாம் சரியாக இருக்க வேண்டும் என்று நினைக்கும்போது மற்றவர் அமைதியாக இருக்கத் தெரிந்தவர்',
    ],
  },
} as const;

test('à 8 équipes, les mises tiennent dans les cases de l’écran', async ({ browser }) => {
  test.setTimeout(120_000);
  const evenement = await creerEvenementJetable({ equipes: 8, langues: ['fr', 'en', 'ta'] });
  evenements.push(evenement.id);
  const service = clientService();
  const { data: equipes } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id)
    .order('numero');
  // Un nom d'équipe de 24 caractères, le plus long qu'un capitaine puisse donner.
  await service
    .from('equipes')
    .update({ nom: 'Les Super Champions 2026' })
    .eq('id', equipes![2]!['id'] as string);
  const jeton = (i: number) => `jetons-8-${evenement.id}-${i}`;
  const { error } = await service.from('joueurs').insert(
    Array.from({ length: 150 }, (_, i) => ({
      evenement_id: evenement.id,
      equipe_id: equipes![i % 8]!['id'] as string,
      prenom: `Invité ${i + 1}`,
      langue: 'fr',
      capitaine: i < 8,
      jeton_hash: hacher(jeton(i)),
    })),
  );
  if (error) throw new Error(error.message);
  const { manche, passages } = await preparerQuiz(evenement.id);
  // La première question devient la question longue (contenu inactif, retiré à la fin).
  const { data: longue } = await service
    .from('contenus')
    .insert({ jeu: 'qcm2', etiquette: 'tout_public', actif: false })
    .select('id')
    .single();
  const contenu = longue!['id'] as string;
  contenus.push(contenu);
  await service.from('contenus_traductions').insert(
    Object.entries(QUESTION_LONGUE).map(([langue, valeur]) => ({
      contenu_id: contenu,
      langue,
      valeur,
    })),
  );
  await service
    .from('contenus_secrets')
    .insert(
      ['fr', 'en', 'ta'].map((langue) => ({ contenu_id: contenu, langue, valeur: { bonne: 1 } })),
    );
  await service.from('passages').update({ contenu_id: contenu }).eq('id', passages[0]!);

  // --- Lancement en mode jetons (19, l'effectif des plus grandes), puis la première question.
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
    { scene: 'jeu', manche_id: manche, passage_id: passages[0], etape: 'pret' },
    { p_manche: { id: manche, statut: 'en_cours', options: { mode: 'jetons', jetons: 19 } } },
  );
  await etape(
    {
      scene: 'jeu',
      manche_id: manche,
      passage_id: passages[0],
      etape: 'question',
      chrono: 'demarrer',
      chrono_duree_s: 30,
    },
    { p_passage: { id: passages[0], statut: 'en_cours' } },
  );
  // Chaque capitaine répartit ses 19 jetons : A et B reçoivent les huit équipes.
  for (let i = 1; i <= 8; i++) {
    const a = i * 2;
    const c = i % 3;
    const { erreur } = await appeler(service, 'miser_quiz', {
      p_jeton_hash: hacher(jeton(i - 1)),
      p_repartition: [a, 19 - a - c, c, 0],
      p_valider: i % 2 === 0,
    });
    expect(erreur).toBeNull();
  }

  const regie = await connecterRegie(browser);
  const ecran = await ouvrirEcran(browser, regie, evenement.code);
  await expect(ecran.locator('[data-scene="qcm2"][data-etape="question"]')).toBeVisible();
  await expect(ecran.getByTestId('mises-A').locator('.tu-stage-mise')).toHaveCount(8);
  await expect(ecran.getByTestId('mises-B').locator('.tu-stage-mise')).toHaveCount(8);
  await expect(ecran.getByTestId('quiz-tete')).toContainText('4 mises validées sur 8');
  // La réponse a fini de monter en haut de sa case.
  await ecran.waitForTimeout(2500);

  const dansLesCases = async () => {
    // Le texte s'est réduit jusqu'à tenir : aucune case ne déborde, aucune ne sort de l'écran.
    const debords = await ecran
      .locator('.tu-stage-quiz__zone')
      .evaluateAll((zones) =>
        zones.map((z) => z.scrollHeight - z.clientHeight).filter((ecart) => ecart > 1),
      );
    expect(debords, 'cases qui débordent').toEqual([]);
    for (const lettre of ['A', 'B', 'C', 'D']) {
      const liste = ecran.getByTestId(`mises-${lettre}`);
      const zone = (await liste.locator('xpath=..').boundingBox())!;
      expect(zone.x).toBeGreaterThanOrEqual(0);
      expect(zone.y + zone.height).toBeLessThanOrEqual(1080);
      for (const pastille of await liste.locator('.tu-stage-mise').all()) {
        const b = (await pastille.boundingBox())!;
        expect(b.x).toBeGreaterThanOrEqual(zone.x);
        expect(b.x + b.width).toBeLessThanOrEqual(zone.x + zone.width + 0.5);
        expect(b.y + b.height, `pastille de ${lettre} sous sa case`).toBeLessThanOrEqual(
          zone.y + zone.height + 0.5,
        );
        await expect(pastille.locator('.tu-stage-mise__nombre')).toBeInViewport({ ratio: 1 });
      }
    }
  };
  await dansLesCases();
  await ecran.screenshot({ path: test.info().outputPath('ecran-jetons-question.png') });

  // --- La réponse révélée : la bonne case ressort, ses pastilles restent lisibles.
  await etape(
    {
      scene: 'jeu',
      manche_id: manche,
      passage_id: passages[0],
      etape: 'reponse',
      chrono: 'arreter',
    },
    { p_passage: { id: passages[0], statut: 'termine', resultat: {} } },
  );
  await ecran.reload();
  await expect(ecran.getByTestId('bonne-reponse')).toBeVisible({ timeout: 15_000 });
  await expect(ecran.getByTestId('bonne-reponse')).toContainText('Les Super Champions 2026');
  await expect(ecran.getByTestId('bonne-reponse')).toContainText('complémentaires');
  await ecran.waitForTimeout(2500);
  await dansLesCases();
  await ecran.screenshot({ path: test.info().outputPath('ecran-jetons-reponse.png') });
});
