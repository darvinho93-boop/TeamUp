import { fileURLToPath } from 'node:url';
import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  appeler,
  clientService,
  creerEvenementJetable,
  hacher,
  supprimerEvenements,
} from '../tests/base';

/**
 * Ciné-mime (2026-11-20) : l'admin dépose une scène de film au back-office ; à l'écran commun, elle
 * passe muette pour le groupe 1, puis la chaîne court sous un seul chrono ; au verdict, le titre du
 * film paraît, et la scène rejoue avec le son. Le titre ne paraît jamais avant, ni à l'écran ni
 * sur un téléphone.
 *
 * `extrait-test.mp4` : 4 s, 320 × 180, une couleur par demi-seconde et la 440 Hz de
 * `la-440.mp3` (images `sharp`, puis le ffmpeg du projet vidéo : `-framerate 2 -i f%02d.png
 * -i la-440.mp3 -c:v libx264 -pix_fmt yuv420p -r 25 -c:a aac -t 4`).
 */

/** `CAPTURES=<dossier>` : une capture de l'écran, de la régie et du back-office à chaque étape. */
const CAPTURES = process.env['CAPTURES'];
const capturer = async (page: Page, nom: string) => {
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/cinemime-${nom}.png` });
};

const MP4 = fileURLToPath(new URL('./fichiers/extrait-test.mp4', import.meta.url));
const film = `La Scène de test ${Date.now()}`;
const crees: string[] = [];

test.afterAll(async () => {
  await supprimerEvenements(crees);
  const service = clientService();
  const { data: secrets } = await service
    .from('contenus_secrets')
    .select('contenu_id')
    .eq('valeur->>film', film);
  const ids = ((secrets ?? []) as { contenu_id: string }[]).map((s) => s.contenu_id);
  if (!ids.length) return;
  const { data: contenus } = await service.from('contenus').select('extrait').in('id', ids);
  const chemins = ((contenus ?? []) as { extrait: string | null }[]).flatMap((c) =>
    c.extrait ? [c.extrait] : [],
  );
  if (chemins.length) await service.storage.from('extraits').remove(chemins);
  await service.from('contenus').delete().in('id', ids);
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

const confirmer = async (regie: Page, nom: string) => {
  await regie.getByRole('button', { name: nom, exact: true }).click();
  await regie.getByRole('button', { name: `Confirmer : ${nom}` }).click();
};

/** Où en est la vidéo de la scène, et si elle sonne. */
const lecture = (ecran: Page) =>
  ecran.getByTestId('scene-video').evaluate((v: HTMLVideoElement) => ({
    temps: v.currentTime,
    muette: v.muted,
    enPause: v.paused,
    finie: v.ended || v.currentTime >= v.duration - 0.1,
  }));

test('une scène muette, mimée de groupe en groupe, puis rejouée avec le son au verdict', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const service = clientService();

  // --- Le back-office : un fichier qui n'est pas un MP4 est refusé avant tout envoi.
  const admin = await connecter(browser, 'admin@teamup.test');
  await admin.goto('/admin/contenus/nouveau?jeu=cinemime');
  await admin.locator('[name="fr.film"]').fill(film);
  const fichier = admin.getByTestId('extrait-fichier');
  await fichier.setInputFiles({
    name: 'faux.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('ceci n’est pas une vidéo'),
  });
  await admin.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(admin.getByText(/n.est pas un MP4/)).toBeVisible();

  // La vraie scène : aperçu et durée lue avant l'envoi, puis le contenu dans la banque.
  await fichier.setInputFiles([]);
  await fichier.setInputFiles(MP4);
  await expect(admin.getByTestId('extrait-duree')).toHaveText('Nouvelle vidéo · 4 s');
  await capturer(admin, 'back-office');
  await admin.getByRole('button', { name: 'Enregistrer' }).click();
  await admin.waitForURL('**/admin/contenus?jeu=cinemime', { timeout: 20_000 });
  await expect(admin.getByTestId('contenu').filter({ hasText: film })).toContainText('4 s');
  const { data: secret } = await service
    .from('contenus_secrets')
    .select('contenu_id')
    .eq('valeur->>film', film)
    .single();
  const contenu = (secret as { contenu_id: string }).contenu_id;
  const { data: ligne } = await service
    .from('contenus')
    .select('extrait, extrait_duree_ms')
    .eq('id', contenu)
    .single();
  const { extrait, extrait_duree_ms: duree } = ligne as {
    extrait: string;
    extrait_duree_ms: number;
  };
  expect(duree).toBeGreaterThanOrEqual(3_900);
  expect(duree).toBeLessThanOrEqual(4_100);
  const { error: absent } = await service.storage.from('extraits').createSignedUrl(extrait, 60);
  expect(absent).toBeNull();

  // --- Une soirée : deux équipes, un Ciné-mime d'un passage, chrono de la chaîne à 60 s, et une
  // joueuse au téléphone.
  const ev = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
  crees.push(ev.id);
  const { data: equipes } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', ev.id)
    .order('numero');
  const { data: m } = await service
    .from('manches')
    .insert({ evenement_id: ev.id, jeu: 'cinemime', ordre: 1, options: { chrono_s: 60 } })
    .select('id')
    .single();
  await service.from('passages').insert({
    manche_id: (m as { id: string }).id,
    evenement_id: ev.id,
    equipe_id: (equipes as { id: string }[])[0]!.id,
    ordre: 1,
    contenu_id: contenu,
  });
  const jeton = hacher(`cinemime-e2e-${ev.code}`);
  const arrivee = await appeler(service, 'rejoindre_evenement', {
    p_code: ev.code,
    p_prenom: 'Spectatrice',
    p_langue: 'fr',
    p_jeton_hash: jeton,
    p_volontaire: false,
  });
  expect(arrivee.erreur).toBeNull();
  const rienAuTelephone = async () => {
    const { data } = await appeler(service, 'etat_joueur', { p_jeton_hash: jeton });
    const texte = JSON.stringify(data);
    expect(texte).not.toContain(film);
    expect(texte).not.toContain(extrait);
  };

  // --- L'écran commun, son activé, et la régie.
  const regie = await connecter(browser, 'anna@teamup.test');
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
  await expect(ecran.getByRole('button', { name: 'Activer le son' })).toHaveCount(0);
  const scene = (etape: string) => ecran.locator(`[data-scene="cinemime"][data-etape="${etape}"]`);

  await regie.goto(`/regie/${ev.code}/pilotage`);
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await regie.getByRole('button', { name: 'Commencer : Ciné-mime' }).click();
  await expect(scene('pret')).toContainText('formez vos groupes');
  // Le titre du film est à la régie, pour l'animateur seul.
  await expect(regie.getByTestId('regie-film')).toContainText(film);
  await capturer(ecran, 'pret');
  await capturer(regie, 'regie-pret');

  // --- La scène, muette, pour le groupe 1 : elle avance, puis s'arrête sur sa dernière image.
  await regie.getByRole('button', { name: 'Montrer la scène (sans le son)' }).click();
  await expect(scene('extrait')).toContainText('Seul le groupe 1 regarde');
  await expect
    .poll(async () => (await lecture(ecran)).temps, { timeout: 10_000 })
    .toBeGreaterThan(1);
  await capturer(ecran, 'extrait');
  expect((await lecture(ecran)).muette).toBe(true);
  await expect(ecran.getByTestId('scene-video')).toHaveAttribute('data-son', 'non');
  await expect(ecran.getByText(film)).toHaveCount(0);
  await expect(scene('extrait')).toContainText('Groupe 1, à vous de mimer', { timeout: 10_000 });
  expect((await lecture(ecran)).finie).toBe(true);
  await capturer(ecran, 'extrait-fini');
  // Un écran rechargé retombe sur la fin de la scène, sans la rejouer.
  await ecran.reload();
  await expect(scene('extrait')).toContainText('Groupe 1, à vous de mimer', { timeout: 15_000 });
  await ecran.getByRole('button', { name: 'Activer le son' }).click();
  await expect(ecran.getByRole('button', { name: 'Activer le son' })).toHaveCount(0);
  await rienAuTelephone();

  // « Revoir la scène » la relance depuis le début.
  await regie.getByRole('button', { name: 'Revoir la scène', exact: true }).click();
  await expect(scene('extrait')).toContainText('Seul le groupe 1 regarde');
  await expect.poll(async () => (await lecture(ecran)).enPause, { timeout: 10_000 }).toBe(false);

  // --- La chaîne : un seul chrono, celui de la préparation.
  await regie.getByRole('button', { name: 'Lancer le mime' }).click();
  await expect(scene('lance')).toContainText(/1:00|0:5\d/);
  await expect(ecran.getByText(film)).toHaveCount(0);
  await capturer(ecran, 'lance');
  await capturer(regie, 'regie-lance');
  await rienAuTelephone();

  // --- Le verdict : vert, le titre du film, +100 à l'équipe.
  await confirmer(regie, 'Trouvé');
  await expect(scene('trouve')).toBeVisible();
  await expect(ecran.getByTestId('film')).toContainText(film);
  await expect(ecran.locator('.tu-stage-verdict')).toHaveClass(/tu-stage-verdict--vert/);
  await expect
    .poll(async () => {
      const { data } = await service.from('scores').select('points').eq('evenement_id', ev.id);
      return ((data ?? []) as { points: number }[]).reduce((t, s) => t + s.points, 0);
    })
    .toBe(100);
  await capturer(ecran, 'trouve');

  // --- La revue : la scène rejoue, avec le son, sous le titre du film.
  await regie.getByRole('button', { name: 'Revoir la scène avec le son' }).click();
  await expect(scene('revue')).toBeVisible();
  await expect(ecran.getByTestId('scene-video')).toHaveAttribute('data-son', 'oui');
  await expect
    .poll(
      async () => {
        const l = await lecture(ecran);
        return !l.muette && !l.enPause && l.temps > 0.5;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  await expect(scene('revue').getByTestId('film')).toContainText(film);
  await capturer(ecran, 'revue');
  await capturer(regie, 'regie-revue');

  // L'aperçu de la régie montre la même scène, toujours muette.
  const apercu = regie.locator('.tu-stage--apercu [data-testid="scene-video"]');
  await expect(apercu).toHaveAttribute('data-son', 'non');
});
