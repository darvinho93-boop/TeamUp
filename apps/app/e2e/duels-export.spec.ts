import { expect, request, test } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

/**
 * Critère du lot 10 : un duel se joue de la régie à l'écran et donne ses points ; l'export de la
 * soirée contient ses scores et ses photos.
 *
 * Deux invités rejoignent, un par équipe. La régie ajoute un duel de Tête, épaule, gobelet, le
 * tire, le présente, le lance (la séquence reste sur la régie) et désigne le vainqueur : +50.
 * Une photo est déposée pour un thème ; le CSV porte le duel, le ZIP porte la photo.
 */

let evenement: { id: string; code: string };
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
});

test.afterAll(async () => {
  const { data } = await clientService()
    .from('photos')
    .select('chemin')
    .eq('evenement_id', evenement.id)
    .returns<{ chemin: string }[]>();
  if (data?.length)
    await clientService()
      .storage.from('photos')
      .remove(data.map((p) => p.chemin));
  await supprimerEvenements([evenement.id]);
});

test('un duel donne +50 au vainqueur ; l’export porte les scores et les photos', async ({
  page: regie,
  context,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const { code } = evenement;
  const service = clientService();

  await regie.goto(`/regie/${code}/preparation`);
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL(`**/regie/${code}/preparation`);

  // --- Préparation : un duel (section bêta) et une manche photo pour l'export.
  await regie
    .locator('form', { has: regie.getByRole('button', { name: 'Ajouter Tête, épaule, gobelet' }) })
    .getByLabel('Duels')
    .fill('1');
  await regie.getByRole('button', { name: 'Ajouter Tête, épaule, gobelet' }).click();
  await expect(regie.getByText('1. Tête, épaule, gobelet')).toBeVisible({ timeout: 30_000 });
  await regie.getByRole('button', { name: 'Ajouter Photo challenge' }).click();
  await expect(regie.getByText('2. Photo challenge')).toBeVisible({ timeout: 30_000 });

  // --- Deux invités, un par équipe (l'arrivée remplit la moins remplie).
  const telephones = await Promise.all(
    ['Zoé', 'Malik'].map(async (prenom) => {
      const telephone = await request.newContext({ baseURL: baseURL! });
      const reponse = await telephone.post(`/api/partie/${code}/rejoindre`, {
        data: { prenom, langue: 'fr' },
      });
      expect(reponse.status()).toBe(200);
      return telephone;
    }),
  );

  // --- Une photo pour le premier thème, déposée comme le ferait le serveur.
  const { data: theme } = await service
    .from('passages')
    .select('contenu_id, manches!inner(jeu)')
    .eq('evenement_id', evenement.id)
    .eq('manches.jeu', 'photo2')
    .eq('ordre', 1)
    .single();
  const { data: equipe } = await service
    .from('equipes')
    .select('id')
    .eq('evenement_id', evenement.id)
    .eq('numero', 1)
    .single();
  const chemin = `${evenement.id}/${(equipe as { id: string }).id}/e2e.jpg`;
  await service.storage.from('photos').upload(chemin, JPEG, { contentType: 'image/jpeg' });
  const { error } = await service.from('photos').insert({
    evenement_id: evenement.id,
    equipe_id: (equipe as { id: string }).id,
    theme_id: (theme as { contenu_id: string }).contenu_id,
    chemin,
  });
  expect(error).toBeNull();

  // --- L'écran commun, seconde fenêtre de la régie.
  const fenetreEcran = await browser.newContext({ storageState: await context.storageState() });
  const ecran = await fenetreEcran.newPage();
  await ecran.goto(`/ecran/${code}`);
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });
  const scene = (etape: string) => ecran.locator(`[data-scene="duel"][data-etape="${etape}"]`);

  // --- Le duel.
  await regie.goto(`/regie/${code}/pilotage`);
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await regie.getByRole('button', { name: 'Commencer : Tête, épaule, gobelet' }).click();
  await expect(scene('tirage')).toBeVisible({ timeout: 10_000 });

  await regie.getByRole('button', { name: 'Tirer les duellistes' }).click();
  await expect(regie.getByTestId('duellistes')).toContainText('Zoé');
  await expect(regie.getByTestId('duellistes')).toContainText('Malik');
  // Tant que la régie n'a pas présenté le duel, la salle ne voit pas les noms.
  await expect(scene('tirage')).toBeVisible();
  await expect(ecran.getByText('Zoé')).toHaveCount(0);

  await regie.getByRole('button', { name: 'Présenter le duel' }).click();
  await expect(scene('face_a_face')).toBeVisible({ timeout: 10_000 });
  await expect(ecran.getByTestId('duel')).toContainText('Zoé');
  await expect(ecran.getByTestId('duel')).toContainText('Malik');

  await regie.getByRole('button', { name: 'Lancer' }).click();
  await expect(scene('chrono')).toBeVisible({ timeout: 10_000 });
  // La séquence du gobelet : sur la régie, jamais à l'écran.
  await expect(regie.getByTestId('sequence')).toContainText('GOBELET');
  await expect(ecran.getByText('GOBELET')).toHaveCount(0);

  const gagne = regie.getByRole('button', { name: 'Malik gagne' });
  await gagne.click();
  await regie.getByRole('button', { name: 'Confirmer : Malik gagne' }).click();
  await expect(scene('gagne')).toBeVisible({ timeout: 10_000 });
  await expect(ecran.getByTestId('verdict-duel')).toHaveText('+50 points');

  const { data: scores } = await service
    .from('scores')
    .select('points, motif')
    .eq('evenement_id', evenement.id);
  expect(scores).toEqual([{ points: 50, motif: expect.stringMatching(/^Duel gagné par Malik/) }]);

  // --- L'export, sous la session de l'animatrice.
  const csv = await regie.request.get(`/regie/${code}/export/scores.csv`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()['content-type']).toContain('text/csv');
  const texte = await csv.text();
  expect(texte).toContain('Rang;Équipe;Points');
  expect(texte).toMatch(/Tête, épaule, gobelet;Duel gagné par Malik[^;]*;[^;]+;50/);

  const zip = await regie.request.get(`/regie/${code}/export/photos.zip`);
  expect(zip.status()).toBe(200);
  const octets = await zip.body();
  expect(octets.subarray(0, 2).toString()).toBe('PK');
  expect(octets.includes(Buffer.from('/Equipe-1-'))).toBe(true);
  // La photo telle qu'elle a été déposée : un ZIP sans recompression la contient à l'octet près.
  expect(octets.includes(JPEG)).toBe(true);

  // Sans session, pas d'export.
  const anonyme = await request.newContext({ baseURL: baseURL! });
  const refus = await anonyme.get(`/regie/${code}/export/scores.csv`, { maxRedirects: 0 });
  expect(refus.status()).toBe(307);

  await Promise.all([...telephones, anonyme].map((t) => t.dispose()));
  await fenetreEcran.close();
});
