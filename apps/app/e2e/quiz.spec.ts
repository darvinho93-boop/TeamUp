import {
  expect,
  request,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { POINTS_PAR_SURVIVANT } from '@teamup/game';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

/**
 * Critère de fin du lot 7 : les deux modes du quiz donnent le même score pour les mêmes
 * survivants.
 *
 * Une manche se joue en mode téléphone : une trentaine d'invités simulés répondent par l'API,
 * selon un scénario écrit d'avance (qui tombe à quelle question, qui ne répond pas), plus un
 * vrai téléphone qui se trompe dès la première. La base compte les survivants. Une seconde
 * manche se joue en mode croix, et l'animateur y saisit les survivants attendus. Les points du
 * journal doivent être identiques, équipe par équipe, et valoir survivants × 100.
 *
 * Le mime suit : le mot ne s'affiche qu'à la régie, puis au verdict, vert ou rouge.
 */

const INVITES = 30;
const LETTRES = ['A', 'B', 'C', 'D'] as const;
const PLAFOND_MS = 1500;
const latences: { etape: string; ms: number }[] = [];
let evenement: { id: string; code: string };

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 3, langues: ['fr'] });
});

test.afterAll(async () => {
  await supprimerEvenements([evenement.id]);
  console.log('Latences régie → écran :', latences.map((l) => `${l.etape} ${l.ms} ms`).join(', '));
});

async function mesurer(etape: string, action: () => Promise<void>, attendu: Locator) {
  await action();
  const debut = Date.now();
  await attendu.waitFor({ state: 'visible', timeout: PLAFOND_MS });
  latences.push({ etape, ms: Date.now() - debut });
}

const confirmer = async (regie: Page, nom: string) => {
  await regie.getByRole('button', { name: nom, exact: true }).click();
  await regie.getByRole('button', { name: `Confirmer : ${nom}` }).click();
};

/** La bonne réponse d'une question, lue en base : le scénario en a besoin pour se tromper. */
async function bonneReponse(passageId: string): Promise<number> {
  const service = clientService();
  const { data: passage } = await service
    .from('passages')
    .select('contenu_id')
    .eq('id', passageId)
    .single();
  const { data: secret } = await service
    .from('contenus_secrets')
    .select('valeur')
    .eq('contenu_id', passage!['contenu_id'] as string)
    .eq('langue', 'fr')
    .single();
  return (secret!['valeur'] as { bonne: number }).bonne;
}

async function pointsDeLaManche(mancheId: string): Promise<Record<number, number>> {
  const service = clientService();
  const { data: equipes } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id);
  const { data: scores } = await service
    .from('scores')
    .select('equipe_id, points')
    .eq('manche_id', mancheId);
  const points: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (const s of scores!) {
    const numero = equipes!.find((e) => e['id'] === s['equipe_id'])!['numero'] as number;
    points[numero] = (points[numero] ?? 0) + (s['points'] as number);
  }
  return points;
}

test('le quiz donne les mêmes points à la croix et au téléphone ; le mime se joue', async ({
  page: regie,
  browser,
  baseURL,
}) => {
  test.setTimeout(300_000);
  const { code } = evenement;

  // --- Préparation depuis la régie : quiz de 4 questions (téléphone), de 3 (croix), un mime.
  await regie.goto('/regie');
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL('**/regie');
  await regie.goto(`/regie/${code}/preparation`);
  await regie.getByLabel('Questions').selectOption('4');
  await regie.getByRole('button', { name: 'Ajouter Quiz' }).click();
  await expect(regie.getByText('1. Quiz')).toBeVisible();
  await regie.getByLabel('Questions').selectOption('3');
  await regie.getByRole('button', { name: 'Ajouter Quiz' }).click();
  await expect(regie.getByText('2. Quiz')).toBeVisible();
  await regie.getByRole('button', { name: 'Ajouter Mime' }).click();
  await expect(regie.getByText('3. Mime')).toBeVisible();

  const service = clientService();
  const { data: manches } = await service
    .from('manches')
    .select('id, ordre')
    .eq('evenement_id', evenement.id)
    .order('ordre');
  const [mancheTelephone, mancheCroix] = manches!.map((m) => m['id'] as string);

  // --- Les invités. Scénario : `tombe` = la question où l'invité se trompe (0 : jamais) ;
  // `silence` = la question où il ne répond pas du tout, ce qui l'élimine aussi.
  const telephones: APIRequestContext[] = [];
  const invites: { equipe: number; tombe: number; silence: number }[] = [];
  for (let i = 0; i < INVITES; i++) {
    const telephone = await request.newContext({ baseURL: baseURL! });
    const reponse = await telephone.post(`/api/partie/${code}/rejoindre`, {
      data: { prenom: `Invité ${i + 1}`, langue: 'fr' },
    });
    expect(reponse.status()).toBe(200);
    const etat = (await reponse.json()) as { equipe: { numero: number } };
    telephones.push(telephone);
    invites.push({ equipe: etat.equipe.numero, tombe: i % 5, silence: i % 10 === 9 ? 2 : 0 });
  }

  // Un vrai téléphone, qui se trompera à la première question.
  const fenetreTelephone = await browser.newContext();
  const telephone = await fenetreTelephone.newPage();
  const arrivee = await telephone.request.post(`/api/partie/${code}/rejoindre`, {
    data: { prenom: 'Zoé', langue: 'fr' },
  });
  expect(arrivee.status()).toBe(200);
  await telephone.goto(`/${code}`);
  await expect(telephone.getByText('Salut Zoé !')).toBeVisible();

  // Survivants attendus : ceux qui ne tombent jamais et ne se taisent jamais (Zoé tombe).
  const attendus: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (const invite of invites) {
    if (invite.tombe === 0 && invite.silence === 0) attendus[invite.equipe]! += 1;
  }

  // --- Écran commun et régie.
  const fenetreEcran = await browser.newContext({
    storageState: await regie.context().storageState(),
  });
  const ecran = await fenetreEcran.newPage();
  await ecran.goto(`/ecran/${code}`);
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });
  await regie.goto(`/regie/${code}/pilotage`);
  const scene = (nom: string, etape = '') =>
    ecran.locator(`[data-scene="${nom}"]${etape ? `[data-etape="${etape}"]` : ''}`);

  // --- Manche 1 : mode téléphone.
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await expect(scene('intro')).toBeVisible({ timeout: 30_000 });
  await mesurer(
    'quiz téléphone : commencer',
    () => regie.getByRole('button', { name: 'Mode téléphone (salle sans croix)' }).click(),
    scene('qcm2', 'pret'),
  );

  for (let q = 1; q <= 4; q++) {
    await mesurer(
      `question ${q}`,
      () => regie.getByRole('button', { name: 'Afficher la question' }).click(),
      scene('qcm2', 'question'),
    );
    const { data: pilotage } = await service
      .from('pilotage')
      .select('passage_id')
      .eq('evenement_id', evenement.id)
      .single();
    const bonne = await bonneReponse(pilotage!['passage_id'] as string);
    const fausse = (bonne + 1) % 4;

    // Le vrai téléphone reçoit la question par le signal de la salle, sans attendre sa relecture.
    if (q === 1) {
      const bouton = telephone.getByRole('button', {
        name: new RegExp(`^Réponse ${LETTRES[fausse]}`),
      });
      await expect(bouton).toBeEnabled({ timeout: 2000 });
      await bouton.click();
      await expect(telephone.getByTestId('statut-quiz')).toHaveText(/Réponse envoyée/);
    }

    // Les invités encore en jeu répondent, selon le scénario.
    const envois = invites.flatMap((invite, i) => {
      const dejaTombe =
        (invite.tombe > 0 && invite.tombe < q) || (invite.silence > 0 && invite.silence < q);
      if (dejaTombe || invite.silence === q) return [];
      const choix = invite.tombe === q ? fausse : bonne;
      return [telephones[i]!.post(`/api/partie/${code}/quiz`, { data: { choix } })];
    });
    const statuts = (await Promise.all(envois)).map((r) => r.status());
    expect(
      statuts.filter((s) => s !== 200),
      `statuts : ${statuts.join(',')}`,
    ).toEqual([]);
    await expect(regie.getByTestId('regie-reponses')).toHaveText(
      new RegExp(`^${envois.length + (q === 1 ? 1 : 0)} réponses? reçues?`),
    );

    await mesurer(
      `révéler ${q}`,
      () => regie.getByRole('button', { name: 'Révéler la réponse' }).click(),
      ecran.getByTestId('bonne-reponse'),
    );
    if (q === 1) {
      await expect(telephone.getByTestId('statut-quiz')).toHaveText(/Éliminé/, { timeout: 2000 });
    }
    await regie
      .getByRole('button', { name: q < 4 ? 'Question suivante' : 'Fin des questions' })
      .click();
  }

  // Une réponse après la fin est refusée, et un éliminé ne répond plus.
  expect(
    (await telephones[0]!.post(`/api/partie/${code}/quiz`, { data: { choix: 0 } })).status(),
  ).toBe(409);

  await expect(scene('qcm2', 'survivants')).toBeVisible();
  for (const [n, survivants] of Object.entries(attendus)) {
    await expect(regie.getByTestId(`survivants-${n}`)).toHaveText(
      new RegExp(`^${survivants === 0 ? 'aucun' : survivants} survivant`),
    );
  }
  await confirmer(regie, 'Valider les survivants');
  await expect(scene('qcm2', 'resultat')).toBeVisible();
  await regie.getByRole('button', { name: 'Terminer la manche' }).click();
  await expect(scene('scores')).toBeVisible();

  // --- Manche 2 : mode croix, mêmes survivants saisis à la main.
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await expect(scene('intro')).toBeVisible();
  await regie.getByRole('button', { name: 'Commencer le quiz en mode croix' }).click();
  await expect(scene('qcm2', 'pret')).toBeVisible();
  for (let q = 1; q <= 3; q++) {
    await regie.getByRole('button', { name: 'Afficher la question' }).click();
    await expect(scene('qcm2', 'question')).toBeVisible();
    if (q === 1) {
      // En mode croix, les téléphones ne voient rien du quiz et ne peuvent pas répondre.
      const etat = await telephones[0]!.get(`/api/partie/${code}/etat`);
      expect(((await etat.json()) as { quiz: unknown }).quiz).toBeNull();
      const refus = await telephones[0]!.post(`/api/partie/${code}/quiz`, { data: { choix: 0 } });
      expect(refus.status()).toBe(409);
    }
    await regie.getByRole('button', { name: 'Révéler la réponse' }).click();
    await expect(ecran.getByTestId('bonne-reponse')).toBeVisible();
    await regie
      .getByRole('button', { name: q < 3 ? 'Question suivante' : 'Fin des questions' })
      .click();
  }
  const { data: equipes } = await service
    .from('equipes')
    .select('numero, nom')
    .eq('evenement_id', evenement.id)
    .order('numero');
  for (const e of equipes!) {
    await regie
      .getByLabel(`Survivants de ${e['nom'] as string}`)
      .fill(String(attendus[e['numero'] as number]));
  }
  await confirmer(regie, 'Valider les survivants');
  await expect(scene('qcm2', 'resultat')).toBeVisible();
  await expect(ecran.getByTestId('survivants')).toBeVisible();
  await regie.getByRole('button', { name: 'Terminer la manche' }).click();
  await expect(scene('scores')).toBeVisible();

  // --- Le critère : mêmes survivants, mêmes points, survivants × 100.
  const parTelephone = await pointsDeLaManche(mancheTelephone!);
  const aLaCroix = await pointsDeLaManche(mancheCroix!);
  expect(parTelephone).toEqual(
    Object.fromEntries(Object.entries(attendus).map(([n, s]) => [n, s * POINTS_PAR_SURVIVANT])),
  );
  expect(aLaCroix).toEqual(parTelephone);

  // --- Mime : trouvé par l'équipe 1, raté par l'équipe 2.
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await expect(scene('intro')).toBeVisible();
  await mesurer(
    'mime : commencer',
    () => regie.getByRole('button', { name: 'Commencer : Mime' }).click(),
    scene('mime2', 'pret'),
  );
  for (const [numero, verdict] of [
    [1, 'Trouvé'],
    [2, 'Raté'],
  ] as const) {
    await mesurer(
      `montrer le mot ${numero}`,
      () => regie.getByRole('button', { name: 'Montrer le mot au premier de la file' }).click(),
      scene('mime2', 'secret'),
    );
    // Le mot est sur la régie, pour J1 : ni l'écran ni les téléphones ne l'ont.
    const mot = (await regie.getByTestId('regie-mot').locator('[lang="fr"]').textContent())!;
    expect(mot.length).toBeGreaterThan(0);
    await expect(ecran.getByText(mot)).toHaveCount(0);
    const etat = await telephones[0]!.get(`/api/partie/${code}/etat`);
    expect(await etat.text()).not.toContain(mot);
    await regie.getByTestId('regie-mot').click();

    await mesurer(
      `lancer ${numero}`,
      () => regie.getByRole('button', { name: 'Lancer' }).click(),
      scene('mime2', 'lance'),
    );
    await mesurer(
      `${verdict} ${numero}`,
      () => confirmer(regie, verdict),
      ecran.getByTestId('verdict'),
    );
    await expect(ecran.getByTestId('mot')).toContainText(mot);
    await expect(ecran.locator('.tu-stage-verdict')).toHaveClass(
      verdict === 'Trouvé' ? /tu-stage-verdict--vert/ : /tu-stage-verdict--rouge/,
    );
    if (numero === 1) {
      await mesurer(
        'mime : passage suivant',
        () => regie.getByRole('button', { name: /Passage suivant/ }).click(),
        scene('mime2', 'pret'),
      );
    }
  }
  await regie.getByRole('button', { name: 'Terminer la manche' }).click();
  await expect(scene('scores')).toBeVisible();

  const { data: mime } = await service
    .from('scores')
    .select('points, motif')
    .eq('evenement_id', evenement.id)
    .like('motif', 'Mime%');
  expect(mime).toEqual([{ points: 100, motif: 'Mime – Équipe 1' }]);

  // Aucune touche au-delà du plafond ; la médiane sous 500 ms, comme au lot 6.
  const tries = latences.map((l) => l.ms).sort((a, b) => a - b);
  expect(tries[Math.floor(tries.length / 2)]!).toBeLessThan(500);

  await Promise.all(telephones.map((t) => t.dispose()));
  await fenetreTelephone.close();
  await fenetreEcran.close();
});
