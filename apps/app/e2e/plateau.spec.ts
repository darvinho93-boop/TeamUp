import { expect, request, test, type Page } from '@playwright/test';
import {
  acces,
  appeler,
  clientAnimateur,
  clientService,
  creerEvenementJetable,
  supprimerEvenements,
} from '../tests/base';

/**
 * Plateau (2026-11-19, audit « jeu télé ») : le verdict commun en plein écran et ses points qui
 * défilent, le suspense du quiz (l'écran et le téléphone attendent le roulement, puis le
 * téléphone montre son bandeau de couleur), le classement qui monte depuis les totaux d'avant le
 * dernier jeu, le duel gagné à la couleur de l'équipe ; l'habillage (ronds pendant les attentes
 * seulement) et la boîte à sons de la régie. Les étapes s'écrivent comme la régie les écrit
 * (`enregistrer_etape`), puis le signal sans données.
 */

/** Les sons joués par l'écran, une fois le son activé. */
const journal = (ecran: Page) =>
  ecran.evaluate(
    () =>
      (
        window as unknown as { __tuLecteur?: { journal: { son: string }[] } }
      ).__tuLecteur?.journal.map((j) => j.son) ?? [],
  );

let evenement: { id: string; code: string };
const contenus: string[] = [];

test.afterAll(async () => {
  if (evenement) await supprimerEvenements([evenement.id]);
  if (contenus.length) await clientService().from('contenus').delete().in('id', contenus);
});

async function contenu(jeu: string, pub: object, secret: object) {
  const service = clientService();
  const { data } = await service
    .from('contenus')
    .insert({ jeu, etiquette: 'tout_public', actif: false })
    .select('id')
    .single();
  const id = (data as { id: string }).id;
  contenus.push(id);
  await service.from('contenus_traductions').insert({ contenu_id: id, langue: 'fr', valeur: pub });
  await service.from('contenus_secrets').insert({ contenu_id: id, langue: 'fr', valeur: secret });
  return id;
}

async function manche(jeu: string, ordre: number, options: object, passages: object[]) {
  const service = clientService();
  const { data: m } = await service
    .from('manches')
    .insert({ evenement_id: evenement.id, jeu, ordre, options })
    .select('id')
    .single();
  const id = (m as { id: string }).id;
  const { data: p } = await service
    .from('passages')
    .insert(
      passages.map((x, i) => ({ manche_id: id, evenement_id: evenement.id, ordre: i + 1, ...x })),
    )
    .select('id, ordre')
    .order('ordre');
  return { id, passages: (p as { id: string }[]).map((x) => x.id) };
}

/** Le signal sans données de la régie : l'écran et les téléphones relisent aussitôt. */
async function signaler() {
  await fetch(`${acces!.url}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      apikey: acces!.service,
      authorization: `Bearer ${acces!.service}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ topic: `salle:${evenement.id}`, event: 'relire', payload: {} }],
    }),
  });
}

test('verdicts, suspense du quiz, classement qui monte', async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const service = clientService();
  evenement = await creerEvenementJetable({ equipes: 3, langues: ['fr'] });
  const { data: lignes } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id)
    .order('numero');
  const equipe = (n: number) =>
    (lignes as { id: string; numero: number }[]).find((e) => e.numero === n)!.id;

  const pointCommun = await contenu(
    'list2',
    { consigne: 'Levez-vous si ça vous concerne.' },
    { reponse: 'les personnes qui ont un chat', indices: ['Miaou', 'Croquettes'] },
  );
  const question = await contenu(
    'qcm2',
    { question: 'Combien de pattes a une araignée ?', propositions: ['6', '8', '10', '12'] },
    { bonne: 1 },
  );
  const pc = await manche('list2', 1, { passages_par_equipe: 1 }, [
    { contenu_id: pointCommun, equipe_id: equipe(1) },
  ]);
  const quiz = await manche('qcm2', 2, { questions: 3 }, [{ contenu_id: question }]);
  const duel = await manche('grab', 3, {}, [{}]);

  // Un joueur au téléphone, dans l'équipe 2, arrivé avant la première question.
  const tel = await request.newContext({ baseURL: baseURL! });
  expect(
    (
      await tel.post(`/api/partie/${evenement.code}/rejoindre`, {
        data: { prenom: 'Zoé', langue: 'fr', volontaire: false },
      })
    ).status(),
  ).toBe(200);
  const zoe = await (
    await browser.newContext({ storageState: await tel.storageState() })
  ).newPage();
  await zoe.goto(`/${evenement.code}`);
  await expect(zoe.getByText('Bienvenue, Zoé')).toBeVisible();

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
    expect(erreur, JSON.stringify(pilotage)).toBeNull();
    await signaler();
  };

  // --- L'écran commun, ouvert sur le programme : tout ce qui suit arrive sous ses yeux.
  const bureau = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    isMobile: false,
  });
  const regie = await bureau.newPage();
  await regie.goto('/regie');
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL('**/regie');
  await etape({ scene: 'programme' });
  const ecran: Page = await (
    await browser.newContext({
      storageState: await bureau.storageState(),
      viewport: { width: 1920, height: 1080 },
      isMobile: false,
      reducedMotion: 'no-preference',
    })
  ).newPage();
  await ecran.goto(`/ecran/${evenement.code}`);
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });
  await ecran.getByRole('button', { name: 'Activer le son' }).click();
  // L'habillage : le halo partout, les ronds pendant les attentes (le programme).
  await expect(ecran.locator('.tu-stage--habillage')).toHaveCount(1);
  await expect(ecran.locator('.tu-habillage__ronds')).toHaveAttribute('data-visible', 'true');

  // ========== Points communs trouvés : plein écran vert, le palier, les points qui défilent.
  const pcp = { scene: 'jeu', manche_id: pc.id, passage_id: pc.passages[0] };
  await etape(
    { ...pcp, etape: 'lance', chrono: 'demarrer', chrono_duree_s: 130 },
    {
      p_manche: { id: pc.id, statut: 'en_cours' },
      p_passage: { id: pc.passages[0], statut: 'en_cours' },
    },
  );
  await expect(ecran.locator('[data-scene="list2"][data-etape="lance"]')).toBeVisible();
  // Pendant le jeu, plus de ronds en fond.
  await expect(ecran.locator('.tu-habillage__ronds')).toHaveAttribute('data-visible', 'false');
  await service
    .from('passages')
    .update({ statut: 'termine', points: 120, resultat: { ecoule_ms: 30_000 } })
    .eq('id', pc.passages[0]!);
  await etape({ ...pcp, etape: 'trouve', chrono: 'arreter' });
  const verdict = ecran.locator('[data-scene="list2"][data-etape="trouve"]');
  await expect(verdict).toHaveAttribute('data-ton', 'vert');
  await expect(verdict).toHaveAttribute('data-en-direct', 'true');
  await expect(ecran.getByTestId('verdict')).toHaveText('Trouvé !');
  await expect(verdict).toContainText('Palier 1 · ×3');
  await expect(verdict).toContainText('+120 points', { timeout: 5000 });
  await expect(ecran.getByTestId('celebration')).toBeAttached();
  // Rechargé, le verdict est posé d'emblée : ni fête, ni défilement.
  await ecran.reload();
  await expect(verdict).toContainText('+120 points', { timeout: 15_000 });
  // Un écran rechargé redemande le geste qui active le son.
  await ecran.getByRole('button', { name: 'Activer le son' }).click();
  await expect(verdict).not.toHaveAttribute('data-en-direct', 'true');
  await expect(ecran.getByTestId('celebration')).toHaveCount(0);

  // ========== Quiz au téléphone : réponses verrouillées, puis le suspense.
  const qp = { scene: 'jeu', manche_id: quiz.id, passage_id: quiz.passages[0] };
  await etape(
    { ...qp, etape: 'pret', chrono: 'arreter' },
    {
      p_manche: { id: pc.id, statut: 'terminee' },
    },
  );
  await etape(
    { ...qp, etape: 'pret' },
    { p_manche: { id: quiz.id, statut: 'en_cours', options: { questions: 3, mode: 'telephone' } } },
  );
  await etape(
    { ...qp, etape: 'question', indices: 4, chrono: 'demarrer', chrono_duree_s: 4 },
    { p_passage: { id: quiz.passages[0], statut: 'en_cours' } },
  );
  // Zoé répond faux.
  await expect(async () => {
    const r = await zoe.request.post(`/api/partie/${evenement.code}/quiz`, { data: { choix: 0 } });
    expect(r.status()).toBe(200);
  }).toPass({ timeout: 10_000 });
  await expect(ecran.getByTestId('quiz-tete')).toContainText('Réponses verrouillées !', {
    timeout: 8000,
  });

  await service.from('passages').update({ statut: 'termine' }).eq('id', quiz.passages[0]!);
  const revele = Date.now();
  await etape({ ...qp, etape: 'reponse', indices: 4, chrono: 'arreter' });
  // L'état est là (la bonne case est connue), mais la salle attend le roulement.
  await expect(ecran.getByTestId('bonne-reponse')).toBeVisible({ timeout: 5000 });
  await expect(ecran.getByTestId('quiz-tete')).toHaveText('Et la bonne réponse est…');
  await expect(ecran.getByTestId('bonne-reponse')).not.toHaveAttribute('data-revelee', 'true');
  await expect(ecran.getByTestId('bonne-reponse')).toHaveAttribute('data-revelee', 'true', {
    timeout: 5000,
  });
  await expect(ecran.getByTestId('bonne-reponse-bandeau')).toHaveText('Bonne réponse !');
  // Le téléphone de Zoé ne dévoile son verdict qu'après le suspense de l'écran.
  await expect(zoe.getByTestId('statut-quiz')).toHaveText(/Hors jeu/, { timeout: 8000 });
  expect(Date.now() - revele).toBeGreaterThanOrEqual(1500);
  // Le verdict en bandeau plein, rouge.
  await expect(zoe.getByTestId('statut-quiz')).toHaveClass(/tu-quiz__statut--verdict/);
  await expect(zoe.getByTestId('statut-quiz')).toHaveClass(/tu-quiz__statut--out/);

  // ========== Classement : les Comètes (équipe 2) passent devant au dernier jeu.
  await service.from('scores').insert([
    {
      evenement_id: evenement.id,
      equipe_id: equipe(1),
      manche_id: pc.id,
      points: 120,
      motif: 'Points communs',
      cree_le: '2026-11-19T20:00:00Z',
    },
    {
      evenement_id: evenement.id,
      equipe_id: equipe(2),
      manche_id: quiz.id,
      points: 300,
      motif: 'Quiz',
      cree_le: '2026-11-19T20:30:00Z',
    },
  ]);
  await etape({ scene: 'scores' }, { p_manche: { id: quiz.id, statut: 'terminee' } });
  const liste = ecran.locator('[data-scene="scores"] .tu-stage-rank');
  await expect(liste).toHaveAttribute('data-classement', 'anime', { timeout: 5000 });
  // Avant : l'équipe 1 en tête (120) ; après : l'équipe 2 (300) la dépasse.
  const premiere = liste.locator('.tu-stage-rank__ligne').first();
  await expect(premiere).toHaveClass(/tu-stage-rank__ligne--leader/);
  await expect(premiere).toContainText('Équipe 2');
  await expect(ecran.getByTestId('points-2')).toHaveText('300', { timeout: 5000 });
  await expect(ecran.getByTestId('points-1')).toHaveText('120');

  // ========== Duel gagné : la couleur de l'équipe du vainqueur, +50 points.
  const { data: joueurs } = await service
    .from('joueurs')
    .select('id, prenom, equipe_id')
    .eq('evenement_id', evenement.id);
  const zoeJoueur = (joueurs as { id: string; prenom: string; equipe_id: string }[])[0]!;
  const numeroZoe = (lignes as { id: string; numero: number }[]).find(
    (e) => e.id === zoeJoueur.equipe_id,
  )!.numero;
  const duellistes = [
    { joueur_id: zoeJoueur.id, prenom: 'Zoé', equipe: numeroZoe },
    { joueur_id: zoeJoueur.id, prenom: 'Hugo', equipe: numeroZoe === 1 ? 2 : 1 },
  ];
  const dp = { scene: 'jeu', manche_id: duel.id, passage_id: duel.passages[0] };
  await etape(
    { ...dp, etape: 'face_a_face' },
    {
      p_manche: { id: duel.id, statut: 'en_cours' },
      p_passage: { id: duel.passages[0], statut: 'en_cours' },
    },
  );
  await service
    .from('passages')
    .update({ statut: 'termine', points: 50, resultat: { duellistes, gagnant: 0 } })
    .eq('id', duel.passages[0]!);
  await etape({ ...dp, etape: 'gagne' });
  const gagne = ecran.locator('[data-scene="duel"][data-etape="gagne"]');
  await expect(gagne).toHaveAttribute('data-ton', 'equipe');
  await expect(ecran.getByTestId('verdict')).toHaveText('Zoé gagne !');
  await expect(ecran.getByTestId('verdict-duel')).toHaveText('+50 points', { timeout: 5000 });

  // ========== La boîte à sons de la régie, puis l'habillage retiré.
  await regie.goto(`/regie/${evenement.code}/pilotage`);
  const boite = regie.getByTestId('boite-a-sons');
  await boite.getByTestId('bruitage-applaudissements').click();
  await expect.poll(() => journal(ecran), { timeout: 10_000 }).toContain('applaudissements');
  await boite.getByTestId('habillage').click();
  await expect(ecran.locator('.tu-stage--habillage')).toHaveCount(0, { timeout: 10_000 });
  await expect(boite.getByTestId('habillage')).toHaveText('Habillage du plateau : retiré');
});
