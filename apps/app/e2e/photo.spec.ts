import { expect, test, type Page } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

/**
 * Critère de fin du lot 8 : une photo prise hors réseau part seule au retour du réseau.
 *
 * Le capitaine prend sa photo en mode avion : elle attend sur le téléphone, rien n'arrive en
 * base. Le réseau revient : elle part sans aucun geste. Il la remplace : l'ancien fichier
 * disparaît du bucket. La régie clôt les envois, le téléphone le voit ; puis la diffusion
 * montre la photo à l'écran et la gagnante rapporte 100 points.
 */

let evenement: { id: string; code: string };

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
});

test.afterAll(async () => {
  const service = clientService();
  const { data: fichiers } = await service
    .from('photos')
    .select('chemin')
    .eq('evenement_id', evenement.id);
  const chemins = (fichiers ?? []).map((f) => f['chemin'] as string);
  if (chemins.length) await service.storage.from('photos').remove(chemins);
  await supprimerEvenements([evenement.id]);
});

/** Une vraie photo JPEG, fabriquée par le navigateur (4:3, comme un appareil photo). */
async function unePhoto(page: Page, texte: string): Promise<Buffer> {
  const base64 = await page.evaluate((legende) => {
    const toile = document.createElement('canvas');
    toile.width = 2400;
    toile.height = 1800;
    const contexte = toile.getContext('2d')!;
    contexte.fillText(legende, 100, 900);
    contexte.fillRect(0, 0, legende.length * 100, 600);
    return toile.toDataURL('image/jpeg', 0.9).split(',')[1]!;
  }, texte);
  return Buffer.from(base64, 'base64');
}

async function objetsDuBucket(equipeId: string): Promise<string[]> {
  const { data } = await clientService().storage.from('photos').list(`${evenement.id}/${equipeId}`);
  return (data ?? []).map((o) => `${evenement.id}/${equipeId}/${o.name}`);
}

test('une photo prise hors réseau part seule au retour du réseau, puis passe à la diffusion', async ({
  page: regie,
  browser,
}) => {
  test.setTimeout(180_000);
  const { code } = evenement;
  const service = clientService();

  // --- Préparation : un photo challenge à deux thèmes.
  await regie.goto('/regie');
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL('**/regie');
  await regie.goto(`/regie/${code}/preparation`);
  await regie.getByRole('button', { name: 'Ajouter Photo challenge' }).click();
  await expect(regie.getByText('1. Photo challenge')).toBeVisible();
  // Une seule manche photo par soirée : le formulaire disparaît.
  await expect(regie.getByRole('button', { name: 'Ajouter Photo challenge' })).toHaveCount(0);

  // --- Zoé rejoint ; la régie en fait la capitaine de son équipe.
  const fenetreTelephone = await browser.newContext();
  const telephone = await fenetreTelephone.newPage();
  const arrivee = await telephone.request.post(`/api/partie/${code}/rejoindre`, {
    data: { prenom: 'Zoé', langue: 'fr' },
  });
  expect(arrivee.status()).toBe(200);
  const { data: zoe } = await service
    .from('joueurs')
    .update({ capitaine: true })
    .eq('evenement_id', evenement.id)
    .select('equipe_id')
    .single();
  const equipeId = zoe!['equipe_id'] as string;

  await telephone.goto(`/${code}`);
  await telephone.getByRole('button', { name: 'Photos : 0 sur 2' }).click();
  await expect(telephone.getByRole('heading', { name: 'Photo challenge' })).toBeVisible();

  // --- Hors réseau : la photo attend sur le téléphone, rien n'arrive en base.
  const premiere = await unePhoto(telephone, 'Première');
  await fenetreTelephone.setOffline(true);
  await expect(telephone.getByText('Connexion perdue')).toBeVisible();
  await telephone
    .getByLabel(/Prendre la photo/)
    .first()
    .setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: premiere });
  await expect(telephone.getByTestId('statut-photo-1')).toHaveText(/En attente de réseau/);
  // Le temps de plusieurs tentatives : aucune ne passe.
  await telephone.waitForTimeout(2000);
  const avant = await service
    .from('photos')
    .select('*', { count: 'exact', head: true })
    .eq('evenement_id', evenement.id);
  expect(avant.count).toBe(0);

  // --- Retour du réseau : elle part seule, sans aucun geste.
  await fenetreTelephone.setOffline(false);
  await expect(telephone.getByTestId('statut-photo-1')).toHaveText(/Envoyée à/, {
    timeout: 20_000,
  });
  const { data: envoyee } = await service
    .from('photos')
    .select('chemin')
    .eq('evenement_id', evenement.id)
    .single();
  const premierChemin = envoyee!['chemin'] as string;
  expect(await objetsDuBucket(equipeId)).toEqual([premierChemin]);
  await expect(telephone.getByText('1 photo envoyée sur 2')).toBeVisible();

  // --- Remplacement : l'ancien fichier quitte le bucket.
  await telephone
    .getByLabel(/Remplacer la photo/)
    .first()
    .setInputFiles({
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      buffer: await unePhoto(telephone, 'Seconde'),
    });
  await expect
    .poll(async () => objetsDuBucket(equipeId), { timeout: 10_000 })
    .not.toEqual([premierChemin]);
  const apres = await objetsDuBucket(equipeId);
  expect(apres).toHaveLength(1);
  const { data: remplacee } = await service
    .from('photos')
    .select('chemin')
    .eq('evenement_id', evenement.id)
    .single();
  expect(apres).toEqual([remplacee!['chemin']]);

  // --- La régie suit les envois et les clôt ; le téléphone le voit aussitôt.
  await regie.goto(`/regie/${code}/photos`);
  await expect(regie.getByTestId('etat-envois')).toHaveText(/Envois ouverts · 1 sur 4/);
  await regie.getByRole('button', { name: 'Clore les envois', exact: true }).click();
  await regie.getByRole('button', { name: 'Confirmer : clore les envois' }).click();
  await expect(regie.getByTestId('etat-envois')).toHaveText(/Envois clos/);
  await expect(telephone.getByText(/Les envois sont clos/)).toBeVisible({ timeout: 5000 });
  await expect(telephone.getByLabel(/Remplacer la photo|Prendre la photo/)).toHaveCount(0);
  // Le serveur refuse de toute façon : la base tranche, pas l'interface.
  const tardif = await telephone.request.post(`/api/partie/${code}/photo`, {
    multipart: {
      theme_id: (
        await service.from('photos').select('theme_id').eq('evenement_id', evenement.id).single()
      ).data!['theme_id'] as string,
      envoi_id: crypto.randomUUID(),
      fichier: { name: 'x.jpg', mimeType: 'image/jpeg', buffer: premiere },
    },
  });
  expect(tardif.status()).toBe(409);

  // --- Diffusion : la photo à l'écran, la gagnante vaut 100 points.
  const fenetreEcran = await browser.newContext({
    storageState: await regie.context().storageState(),
  });
  const ecran = await fenetreEcran.newPage();
  await ecran.goto(`/ecran/${code}`);
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });
  await regie.goto(`/regie/${code}/pilotage`);
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await regie.getByRole('button', { name: 'Commencer : Photo challenge' }).click();
  const theme = ecran.locator('[data-scene="photo2"][data-etape="theme"]');
  await expect(theme).toBeVisible({ timeout: 5000 });
  await expect(theme.getByTestId('photo').locator('img')).toBeVisible({ timeout: 5000 });

  const { data: equipe } = await service.from('equipes').select('nom').eq('id', equipeId).single();
  const nom = equipe!['nom'] as string;
  await regie.getByRole('button', { name: nom, exact: true }).click();
  await regie.getByRole('button', { name: `Confirmer : Gagnante : ${nom}` }).click();
  await expect(ecran.getByTestId('verdict-photo')).toHaveText(/\+100 points/, { timeout: 5000 });

  const { data: scores } = await service
    .from('scores')
    .select('equipe_id, points')
    .eq('evenement_id', evenement.id);
  expect(scores).toEqual([{ equipe_id: equipeId, points: 100 }]);
  const { data: gagnante } = await service
    .from('photos')
    .select('gagnante')
    .eq('evenement_id', evenement.id)
    .single();
  expect(gagnante!['gagnante']).toBe(true);

  await fenetreTelephone.close();
  await fenetreEcran.close();
});
