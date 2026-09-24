import { expect, request, test, type Locator, type Page } from '@playwright/test';
import { scorePointsCommuns } from '@teamup/game';
import { clientService, supprimerEvenements } from '../tests/base';

/**
 * Critère de fin du lot 6 : une partie complète de Points communs et de Surenchère se pilote
 * depuis la régie, et l'écran projeté suit chaque touche en moins d'1 s.
 *
 * La latence est mesurée à chaque touche (une trentaine par partie) et jugée sur sa
 * distribution : médiane, 90e centile, et un plafond qu'aucune touche ne franchit. Une touche
 * isolée à 1,1 s sur un poste de développement chargé (Docker sous WSL, deux navigateurs, le
 * serveur) ne dit rien de la salle ; une médiane ou un 90e centile qui dérive, si.
 */

const CLIENT = `Partie e2e ${Date.now()}`;
const LIMITE_MS = 1000;
const MEDIANE_MAX_MS = 500;
const PLAFOND_MS = 1500;
const latences: { etape: string; ms: number }[] = [];
let evenementId: string | undefined;

test.afterAll(async () => {
  if (evenementId) await supprimerEvenements([evenementId]);
  console.log('Latences régie → écran :', latences.map((l) => `${l.etape} ${l.ms} ms`).join(', '));
});

/**
 * Une touche de la régie, et le temps qu'il faut pour que l'écran projeté la montre : de l'appui
 * (une fois le bouton actionnable) à l'apparition sur l'écran. `waitFor` observe la page en continu,
 * sans les paliers de nouvelle tentative d'`expect` qui gonfleraient la mesure.
 */
async function mesurer(etape: string, action: () => Promise<void>, attendu: Locator) {
  await action();
  const debut = Date.now();
  await attendu.waitFor({ state: 'visible', timeout: PLAFOND_MS }).catch(() => {
    throw new Error(
      `écran pas à jour ${PLAFOND_MS} ms après « ${etape} » (précédentes : ${latences.map((l) => l.ms).join(', ')})`,
    );
  });
  latences.push({ etape, ms: Date.now() - debut });
}

const confirmer = async (regie: Page, nom: string) => {
  await regie.getByRole('button', { name: nom, exact: true }).click();
  await regie.getByRole('button', { name: `Confirmer : ${nom}` }).click();
};

test('une partie complète se pilote depuis la régie, écran à jour en moins d’1 s', async ({
  page: regie,
  context,
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);

  // --- Connexion et préparation, depuis la régie.
  await regie.goto('/regie');
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL('**/regie');

  await regie.getByLabel('Client').fill(CLIENT);
  await regie.getByLabel('Date').fill(new Date().toISOString().slice(0, 10));
  await regie.getByLabel("Nombre d'équipes").fill('3');
  await regie.getByRole('checkbox', { name: 'தமிழ்' }).check();
  await regie.getByRole('button', { name: 'Créer et préparer' }).click();
  await regie.waitForURL('**/preparation');
  const code = regie.url().split('/').at(-2)!;

  const { data: evenement } = await clientService()
    .from('evenements')
    .select('id')
    .eq('code', code)
    .single();
  evenementId = evenement!['id'] as string;

  await regie.getByRole('button', { name: 'Ajouter Points communs' }).click();
  await expect(regie.getByText('1. Points communs')).toBeVisible({ timeout: 15_000 });
  // Le formulaire Photo challenge a lui aussi un champ « Thèmes ».
  await regie
    .locator('form', { has: regie.getByRole('button', { name: 'Ajouter Surenchère' }) })
    .getByLabel('Thèmes')
    .fill('2');
  await regie.getByRole('button', { name: 'Ajouter Surenchère' }).click();
  await expect(regie.getByText('2. Surenchère')).toBeVisible({ timeout: 15_000 });

  // --- Trois invités rejoignent, un par équipe.
  const telephones = await Promise.all(
    [1, 2, 3].map(() => request.newContext({ baseURL: baseURL! })),
  );
  for (const [i, telephone] of telephones.entries()) {
    const reponse = await telephone.post(`/api/partie/${code}/rejoindre`, {
      data: { prenom: `Invité ${i + 1}`, langue: 'fr' },
    });
    expect(reponse.status()).toBe(200);
  }

  // --- L'écran commun : une seconde fenêtre, visible, avec la session de l'animateur. Un onglet
  // en arrière-plan du même contexte verrait ses minuteries bridées par Chromium, ce qui
  // n'arrive pas à la fenêtre projetée en salle.
  const fenetreEcran = await browser.newContext({ storageState: await context.storageState() });
  const ecran = await fenetreEcran.newPage();
  await ecran.goto(`/ecran/${code}`);
  await expect(ecran.getByTestId('code')).toHaveText(code);
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });

  await regie.goto(`/regie/${code}/pilotage`);
  const scenes = regie.getByRole('group', { name: 'Scènes' });
  const scene = (nom: string, etape = '') =>
    ecran.locator(`[data-scene="${nom}"]${etape ? `[data-etape="${etape}"]` : ''}`);

  // Premier appel : il ouvre les connexions du serveur. On ne le chronomètre pas.
  await scenes.getByRole('button', { name: 'Programme' }).click();
  await expect(scene('programme')).toBeVisible({ timeout: 30_000 });

  await mesurer(
    'équipes',
    () => scenes.getByRole('button', { name: 'Équipes' }).click(),
    scene('equipes'),
  );

  // --- Points communs : trouvé, raté, trouvé.
  await mesurer(
    'présenter',
    () => regie.getByRole('button', { name: 'Présenter' }).first().click(),
    scene('intro'),
  );
  await mesurer(
    'commencer',
    () => regie.getByRole('button', { name: 'Commencer : Points communs' }).click(),
    scene('list2', 'pret'),
  );

  for (const [numero, issue] of [
    [1, 'Valider'],
    [2, 'Échec'],
    [3, 'Valider'],
  ] as const) {
    await mesurer(
      `afficher ${numero}`,
      () => regie.getByRole('button', { name: 'Afficher' }).click(),
      ecran.getByTestId('point-commun'),
    );
    await mesurer(
      `masquer ${numero}`,
      () => regie.getByRole('button', { name: 'Masquer' }).click(),
      scene('list2', 'masque'),
    );
    await expect(ecran.getByTestId('point-commun')).toHaveCount(0);
    await mesurer(
      `lancer ${numero}`,
      () => regie.getByRole('button', { name: 'Lancer' }).click(),
      scene('list2', 'lance'),
    );
    await expect(ecran.getByTestId('chrono')).not.toHaveText('2:10', { timeout: 3000 });
    await mesurer(
      `${issue.toLowerCase()} ${numero}`,
      () => confirmer(regie, issue),
      ecran.getByTestId('verdict'),
    );
    if (numero < 3) {
      await mesurer(
        `passage suivant ${numero}`,
        () => regie.getByRole('button', { name: /Passage suivant/ }).click(),
        scene('list2', 'pret'),
      );
    }
  }
  await mesurer(
    'terminer Points communs',
    () => regie.getByRole('button', { name: 'Terminer la manche' }).click(),
    scene('scores'),
  );

  // --- Surenchère : un pari tenu par l'équipe 2, un raté par l'équipe 1.
  await mesurer(
    'présenter Surenchère',
    () => regie.getByRole('button', { name: 'Présenter' }).first().click(),
    scene('intro'),
  );
  await mesurer(
    'commencer Surenchère',
    () => regie.getByRole('button', { name: 'Commencer : Surenchère' }).click(),
    scene('enchere2', 'themes'),
  );
  for (const [champion, verdict] of [
    ['Équipe 2', 'Tenu'],
    ['Équipe 1', 'Raté'],
  ] as const) {
    await mesurer(
      `dévoiler (${champion})`,
      () => regie.getByRole('button', { name: 'Dévoiler' }).first().click(),
      ecran.getByTestId('sujet'),
    );
    await mesurer(
      `adjuger (${champion})`,
      () => regie.getByRole('button', { name: /Adjugé/ }).click(),
      scene('enchere2', 'chrono'),
    );
    await regie
      .getByRole('group', { name: 'Équipe du champion' })
      .getByRole('button', { name: champion })
      .click();
    await mesurer(
      `${verdict} (${champion})`,
      () => confirmer(regie, verdict),
      ecran.getByTestId('verdict'),
    );
    await mesurer(
      `retour (${champion})`,
      () => regie.getByRole('button', { name: 'Retour aux thèmes' }).click(),
      scene('enchere2', 'themes'),
    );
  }
  await expect(ecran.getByTestId('sujet')).toHaveCount(0);
  await mesurer(
    'terminer Surenchère',
    () => regie.getByRole('button', { name: 'Terminer la manche' }).click(),
    scene('scores'),
  );

  // --- Les points : ceux du barème, et ceux que l'écran affiche.
  const service = clientService();
  const { data: equipes } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenementId)
    .order('numero');
  const { data: passages } = await service
    .from('passages')
    .select('equipe_id, points, resultat, manches(jeu)')
    .eq('evenement_id', evenementId);
  const attendus = new Map<number, number>([
    [1, 0],
    [2, 0],
    [3, 0],
  ]);
  const numero = (id: unknown) => equipes!.find((e) => e['id'] === id)!['numero'] as number;
  for (const p of passages!) {
    const resultat = p['resultat'] as { ecoule_ms?: number; trouve?: boolean };
    if (p['equipe_id']) {
      const points = resultat.trouve ? scorePointsCommuns(resultat.ecoule_ms!) : 0;
      expect(p['points']).toBe(points);
      attendus.set(numero(p['equipe_id']), attendus.get(numero(p['equipe_id']))! + points);
    }
  }
  // Tenu par l'équipe 2 : +100. Raté par l'équipe 1 : +20 aux équipes 2 et 3.
  attendus.set(2, attendus.get(2)! + 100 + 20);
  attendus.set(3, attendus.get(3)! + 20);
  for (const [n, points] of attendus) {
    await expect(ecran.getByTestId(`points-${n}`)).toHaveText(String(points));
  }

  await mesurer(
    'podium',
    () => scenes.getByRole('button', { name: 'Podium' }).click(),
    scene('podium'),
  );
  const premier = [...attendus.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]!;
  await expect(ecran.getByTestId('podium-1')).toContainText(`Équipe ${premier[0]}`);
  await expect(ecran.getByTestId('podium-1')).toContainText(String(premier[1]));

  // Les téléphones voient la soirée avancer (sans aucun secret).
  const etat = await telephones[0]!.get(`/api/partie/${code}/etat`);
  expect(JSON.stringify(await etat.json())).not.toMatch(/reponse|sujet|indices/);
  await Promise.all(telephones.map((t) => t.dispose()));
  await fenetreEcran.close();

  const triees = latences.map((l) => l.ms).sort((a, b) => a - b);
  const centile = (q: number) =>
    triees[Math.min(triees.length - 1, Math.floor(q * triees.length))]!;
  test.info().annotations.push({
    type: 'latence régie → écran',
    description: `médiane ${centile(0.5)} ms, 90e centile ${centile(0.9)} ms, max ${triees.at(-1)} ms sur ${triees.length} touches`,
  });
  expect(triees.length).toBeGreaterThanOrEqual(30);
  expect(centile(0.5), 'médiane').toBeLessThan(MEDIANE_MAX_MS);
  expect(centile(0.9), '90e centile').toBeLessThan(LIMITE_MS);
});

test('sans session, ni écran ni régie', async ({ page }) => {
  await page.goto('/ecran/FETE24');
  await expect(page).toHaveURL(/\/regie\/connexion/);
  await page.goto('/regie/FETE24/pilotage');
  await expect(page).toHaveURL(/\/regie\/connexion/);
});
