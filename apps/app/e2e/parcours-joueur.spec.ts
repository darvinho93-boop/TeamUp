import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  acces,
  appeler,
  clientAnimateur,
  clientService,
  creerEvenementJetable,
  supprimerEvenements,
} from '../tests/base';

/**
 * La recette du parcours joueur (`docs/parcours-joueur-mobile.md`, § 6) : scans et rescan, étapes
 * de l'inscription, priorité de la manche depuis un onglet, carte et accord, messages et avis,
 * classement, téléphone étroit, veille.
 */
const CONTENU_QUIZ = 'aaaa0002-0000-4000-8000-000000000002';
const crees: string[] = [];

test.afterAll(() => supprimerEvenements(crees));

async function soiree(options: Parameters<typeof creerEvenementJetable>[0] = {}) {
  const evenement = await creerEvenementJetable({ langues: ['fr'], ...options });
  crees.push(evenement.id);
  return evenement;
}

async function telephone(browser: Browser, largeur?: number): Promise<Page> {
  const contexte = await browser.newContext(
    largeur ? { viewport: { width: largeur, height: 568 } } : {},
  );
  return contexte.newPage();
}

async function arriver(browser: Browser, code: string, prenom: string, largeur?: number) {
  const page = await telephone(browser, largeur);
  const r = await page.request.post(`/api/partie/${code}/rejoindre`, {
    data: { prenom, langue: 'fr', volontaire: false },
  });
  expect(r.status()).toBe(200);
  await page.goto(`/${code}`);
  await expect(page.getByTestId('navigation-joueur')).toBeVisible();
  return page;
}

/** Le signal sans données de la régie : les téléphones relisent aussitôt. */
async function signaler(id: string) {
  const r = await fetch(`${acces!.url}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: acces!.service,
      authorization: `Bearer ${acces!.service}`,
    },
    body: JSON.stringify({
      messages: [{ topic: `salle:${id}`, event: 'relire', payload: {}, private: false }],
    }),
  });
  expect(r.ok).toBe(true);
}

async function equipesDe(id: string) {
  const { data } = await clientService()
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', id)
    .order('numero');
  return data as { id: string; numero: number }[];
}

async function poserQuestion(id: string) {
  const service = clientService();
  const { data: manche, error } = await service
    .from('manches')
    .insert({
      evenement_id: id,
      jeu: 'qcm2',
      ordre: 1,
      statut: 'en_cours',
      options: { mode: 'telephone' },
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const mancheId = (manche as { id: string }).id;
  const { data: passage, error: e } = await service
    .from('passages')
    .insert({
      manche_id: mancheId,
      evenement_id: id,
      ordre: 1,
      statut: 'en_cours',
      contenu_id: CONTENU_QUIZ,
    })
    .select('id')
    .single();
  if (e) throw new Error(e.message);
  const { error: p } = await service
    .from('pilotage')
    .update({
      scene: 'jeu',
      manche_id: mancheId,
      passage_id: (passage as { id: string }).id,
      etape: 'question',
      indices: 4,
      chrono_depart: new Date().toISOString(),
      chrono_duree_s: 30,
    })
    .eq('evenement_id', id);
  if (p) throw new Error(p.message);
  await signaler(id);
  return mancheId;
}

test('chaque QR, un mauvais code, puis le rescan sans ressaisie, manche en cours comprise', async ({
  browser,
}) => {
  const evenement = await soiree({ equipes: 2, langues: ['fr', 'en'] });
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  await clientService()
    .from('evenements')
    .update({ date_evenement: jour, carte_visible: true, titre_public: 'Soirée parcours' })
    .eq('id', evenement.id);

  // QR de table : la bonne soirée, la langue de la carte reprise.
  const page = await telephone(browser);
  await page.goto('/soirees');
  await page.getByLabel('Langue').selectOption('en');
  const carte = page.getByTestId('soiree').filter({ hasText: 'Soirée parcours' });
  await carte.getByRole('link', { name: 'Join this event' }).click();
  await expect(page).toHaveURL(`/${evenement.code}?carte=1`);
  await expect(page.getByRole('heading', { name: 'Your registration' })).toBeVisible();
  await page.getByLabel('First name').fill('Asha');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Confirm my registration' }).click();
  await expect(page.getByText('Welcome, Asha')).toBeVisible();
  await expect(page.getByTestId('onglet-partie')).toHaveAttribute('aria-current', 'page');

  // Mauvais code, récupérable, puis le bon : la session est retrouvée sans rien ressaisir.
  await page.goto('/ZZZZZZ');
  await expect(page.getByText("This code doesn't open any game")).toBeVisible();
  await page.getByLabel('Character 1').click();
  await page.keyboard.type(evenement.code);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByText('Welcome, Asha')).toBeVisible();
  await expect(page.getByLabel('First name')).toHaveCount(0);

  // Rescan du QR de table, puis du QR de salle, pendant une question en cours.
  await page.goto('/soirees');
  await expect(carte.getByRole('link', { name: 'Back to my game' })).toBeVisible();
  await poserQuestion(evenement.id);
  await carte.getByRole('link', { name: 'Back to my game' }).click();
  // Ce parcours ne mesure aucune latence : l'accès à Docker s'arrête parfois 10 s sur le poste.
  await expect(page.getByTestId('vue-du-jeu')).toHaveAttribute('data-urgent', 'true', {
    timeout: 25_000,
  });
  await expect(page.locator('.tu-quiz-choice')).toHaveCount(4);
  await page.goto(`/${evenement.code}`, { timeout: 30_000 });
  await expect(page.locator('.tu-quiz-choice')).toHaveCount(4, { timeout: 25_000 });
  await expect(page.getByLabel('First name')).toHaveCount(0);

  const { count } = await clientService()
    .from('joueurs')
    .select('*', { count: 'exact', head: true })
    .eq('evenement_id', evenement.id);
  expect(count).toBe(1);
});

test('aucune soirée ouverte : « J’ai un code » est dans le premier écran', async ({ browser }) => {
  const page = await telephone(browser, 320);
  // La page de contrôle : la liste vide, quelles que soient les soirées du jour de la base.
  await page.goto('/kit-ui/soirees?etat=vide');
  await expect(page.getByTestId('soirees-vide')).toBeVisible();
  await expect(page.getByRole('link', { name: "J'ai un code" })).toBeInViewport({ ratio: 1 });
});

test('inscription : retour, groupe facultatif puis obligatoire, doublon au champ', async ({
  browser,
}) => {
  const evenement = await soiree({ equipes: 2 });
  await clientService()
    .from('groupes')
    .insert([
      { evenement_id: evenement.id, nom: 'Famille', ordre: 1 },
      { evenement_id: evenement.id, nom: 'Amis', ordre: 2 },
    ]);
  await arriver(browser, evenement.code, 'Lina');

  const page = await telephone(browser);
  await page.goto(`/${evenement.code}`);
  await expect(page.getByRole('heading', { name: 'Votre inscription' })).toBeVisible();
  const prenom = page.getByLabel('Votre prénom');
  const groupe = page.getByLabel('Groupe (facultatif)');
  await prenom.fill('lina');
  await groupe.selectOption({ label: 'Amis' });
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(prenom).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.tu-field__error')).toContainText('déjà pris');
  await expect(prenom).toBeFocused();
  await expect(groupe).toHaveValue(/.+/);

  await prenom.fill('Mona');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByRole('heading', { name: 'Votre rôle' })).toBeVisible();
  await page.getByRole('button', { name: 'Étape précédente' }).click();
  await expect(prenom).toHaveValue('Mona');
  await expect(groupe.locator('option:checked')).toHaveText('Amis');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Confirmer mon inscription' }).click();
  await expect(page.getByText('Bienvenue, Mona')).toBeVisible();

  // Groupe obligatoire : plus de « Je préfère ne pas répondre », et il faut choisir.
  await clientService()
    .from('evenements')
    .update({ groupe_facultatif: false })
    .eq('id', evenement.id);
  const oblige = await telephone(browser);
  await oblige.goto(`/${evenement.code}`);
  await oblige.getByLabel('Votre prénom').fill('Noé');
  const champ = oblige.getByLabel('Groupe', { exact: true });
  await expect(champ.getByRole('option', { name: 'Je préfère ne pas répondre' })).toHaveCount(0);
  await oblige.getByRole('button', { name: 'Continuer' }).click();
  await expect(champ).toHaveAttribute('aria-invalid', 'true');
  await expect(oblige.getByText('Choisissez votre groupe pour continuer.')).toBeVisible();
  await champ.selectOption({ label: 'Famille' });
  await oblige.getByRole('button', { name: 'Continuer' }).click();
  await expect(oblige.getByRole('heading', { name: 'Votre rôle' })).toBeVisible();
});

test('la bulle explique le rôle ; le nom proposé suit seulement une candidature', async ({
  browser,
}) => {
  const evenement = await soiree();
  const page = await telephone(browser);
  await page.goto(`/${evenement.code}`);
  await page.getByLabel('Votre prénom').fill('Yara');
  await page.getByRole('button', { name: 'Continuer' }).click();

  const membre = page.getByLabel("Membre de l'équipe");
  const volontaire = page.getByLabel('Me proposer comme capitaine');
  await expect(membre).toBeChecked();
  const bulle = page.getByTestId('bulle-capitaine');
  await bulle.locator('summary').click();
  await expect(bulle).toContainText("L'animateur tire les capitaines au sort");
  await expect(membre).toBeChecked();
  await bulle.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(bulle).not.toHaveAttribute('open', '');
  await expect(membre).toBeChecked();

  const nom = page.getByLabel("Nom d'équipe proposé (facultatif)");
  await expect(nom).toHaveCount(0);
  await volontaire.check();
  await expect(nom).toHaveAttribute('maxlength', '24');
  await nom.fill('Les Comètes');
  await membre.check();
  await expect(nom).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirmer mon inscription' }).click();
  await expect(page.getByText('Bienvenue, Yara')).toBeVisible();

  const { data } = await clientService()
    .from('joueurs')
    .select('volontaire, nom_propose')
    .eq('evenement_id', evenement.id)
    .single();
  expect(data).toEqual({ volontaire: false, nom_propose: null });
});

test('une réponse perdue se rattrape sans doublon ; un double appui n’envoie qu’une demande', async ({
  browser,
}) => {
  const evenement = await soiree();
  const page = await telephone(browser);
  let demandes = 0;
  let perdre = true;
  await page.route(`**/api/partie/${evenement.code}/rejoindre`, async (route) => {
    demandes += 1;
    if (!perdre) return route.continue();
    perdre = false;
    // La base a écrit, mais ni la réponse ni le cookie n'atteignent le téléphone.
    await route.fetch();
    await page.context().clearCookies({ name: `tu_j_${evenement.code}` });
    await route.abort('connectionfailed');
  });

  await page.goto(`/${evenement.code}`);
  await page.getByLabel('Votre prénom').fill('Sana');
  await page.getByRole('button', { name: 'Continuer' }).click();
  const confirmer = page.getByRole('button', { name: 'Confirmer mon inscription' });
  await confirmer.evaluate((b: HTMLButtonElement) => {
    b.click();
    b.click();
  });
  await expect(page.getByTestId('erreur-inscription')).toContainText('réessayez');
  expect(demandes).toBe(1);
  await expect(page.getByRole('heading', { name: 'Votre rôle' })).toBeVisible();

  await confirmer.click();
  await expect(page.getByText('Bienvenue, Sana')).toBeVisible();
  expect(demandes).toBe(2);
  const { count } = await clientService()
    .from('joueurs')
    .select('*', { count: 'exact', head: true })
    .eq('evenement_id', evenement.id);
  expect(count).toBe(1);

  await page.reload();
  await expect(page.getByText('Bienvenue, Sana')).toBeVisible();
});

test('une question prend la main depuis Équipe, la carte ou le message ; seul le capitaine buzze', async ({
  browser,
}) => {
  const evenement = await soiree({ equipes: 2 });
  const service = clientService();
  const [equipe] = await equipesDe(evenement.id);
  const ana = await arriver(browser, evenement.code, 'Ana');
  const bao = await arriver(browser, evenement.code, 'Bao');
  const cleo = await arriver(browser, evenement.code, 'Cléo');
  await service.from('joueurs').update({ equipe_id: equipe!.id }).eq('evenement_id', evenement.id);
  await service
    .from('joueurs')
    .update({ capitaine: true })
    .eq('evenement_id', evenement.id)
    .eq('prenom', 'Ana');
  await service
    .from('pilotage')
    .update({ messages_ouverts: true })
    .eq('evenement_id', evenement.id);
  for (const p of [ana, bao, cleo]) await p.reload();

  // Trois téléphones ailleurs : l'onglet Équipe, une carte en cours, un message en cours.
  await ana.getByTestId('onglet-equipe').click();
  await expect(ana.getByTestId('coequipiers')).toContainText('Bao');
  await bao.getByRole('button', { name: 'Créer ma carte' }).click();
  await bao.getByLabel('Que faites-vous dans la vie').fill('Pilote de ligne');
  await cleo.getByTestId('ouvrir-message').click();
  await cleo.getByLabel('Votre message').fill('Bravo à tous');

  const mancheQuiz = await poserQuestion(evenement.id);
  for (const p of [ana, bao, cleo]) {
    await expect(p.getByTestId('vue-du-jeu')).toHaveAttribute('data-urgent', 'true', {
      timeout: 3000,
    });
    await expect(p.locator('.tu-quiz-choice').first()).toBeVisible();
    await expect(p.getByTestId('navigation-joueur')).toHaveCount(0);
  }
  await expect(cleo.locator('dialog[open]')).toHaveCount(0);

  // Répondre rend la navigation ; les brouillons sont là, quand on y retourne.
  for (const p of [bao, cleo]) {
    await p.locator('.tu-quiz-choice').first().click();
    await expect(p.getByTestId('navigation-joueur')).toBeVisible();
  }
  await bao.getByRole('button', { name: 'Créer ma carte' }).click();
  await expect(bao.getByLabel('Que faites-vous dans la vie')).toHaveValue('Pilote de ligne');
  await cleo.getByTestId('ouvrir-message').click();
  await expect(cleo.getByLabel('Votre message')).toHaveValue('Bravo à tous');
  await cleo.getByRole('button', { name: 'Annuler' }).click();

  // Le blind test : deux rôles, un seul buzzer.
  await service.from('manches').update({ statut: 'terminee' }).eq('id', mancheQuiz);
  const { data: m } = await service
    .from('manches')
    .insert({
      evenement_id: evenement.id,
      jeu: 'blind',
      ordre: 2,
      statut: 'en_cours',
      options: { extrait_s: 30, titres: [{ musique: null, debut_s: 0 }] },
    })
    .select('id')
    .single();
  const { data: titre } = await service
    .from('passages')
    .insert({
      manche_id: (m as { id: string }).id,
      evenement_id: evenement.id,
      ordre: 1,
      statut: 'en_cours',
    })
    .select('id')
    .single();
  await service
    .from('pilotage')
    .update({
      scene: 'jeu',
      manche_id: (m as { id: string }).id,
      passage_id: (titre as { id: string }).id,
      etape: 'ecoute',
      chrono_depart: new Date().toISOString(),
      chrono_duree_s: 30,
    })
    .eq('evenement_id', evenement.id);
  await signaler(evenement.id);

  await expect(ana.getByTestId('buzzer')).toBeEnabled({ timeout: 5000 });
  await expect(bao.getByTestId('statut-blind')).toBeVisible({ timeout: 5000 });
  await expect(bao.getByTestId('buzzer')).toHaveCount(0);
  const refus = await bao.request.post(`/api/partie/${evenement.code}/buzz`);
  expect(refus.ok()).toBe(false);
  await ana.getByTestId('buzzer').click();
  await expect(ana.getByTestId('statut-blind')).toContainText('À vous');
});

test('la carte : métier seul sans accord, puis autorisée ; limites, retrait et suppression', async ({
  browser,
}) => {
  const evenement = await soiree({ equipes: 1 });
  const [equipe] = await equipesDe(evenement.id);
  const page = await arriver(browser, evenement.code, 'Ines');
  const anna = await clientAnimateur('anna@teamup.test');
  const tirer = async () =>
    (
      await appeler<{ joueur_id: string | null }>(anna, 'tirer_carte', {
        p_evenement: evenement.id,
        p_manche: null,
        p_equipe: equipe!.id,
      })
    ).data!.joueur_id;
  const carteALEcran = async () => {
    const { data } = await appeler<{ connaissance: { carte: unknown } | null }>(
      anna,
      'etat_ecran',
      { p_code: evenement.code, p_regie: false },
    );
    return data!.connaissance?.carte ?? null;
  };

  await page.getByRole('button', { name: 'Créer ma carte' }).click();
  await expect(page.getByTestId('carte-accord')).not.toBeChecked();

  // Limites : la saisie est refusée, avec son message au champ.
  await page.getByLabel('Quel âge avez-vous').fill('9');
  await page.getByRole('button', { name: 'Enregistrer ma carte' }).click();
  await expect(page.getByText('Indiquez un âge entre 10 et 110 ans')).toBeVisible();
  await page.getByLabel('Quel âge avez-vous').fill('');
  await page.getByLabel('Que faites-vous dans la vie').fill('x'.repeat(61));
  await page.getByRole('button', { name: 'Enregistrer ma carte' }).click();
  await expect(page.getByText('60 caractères au plus.')).toBeVisible();

  // Le métier seul, sans accord : l'aperçu le montre avec le prénom, la carte n'est pas tirable.
  await page.getByLabel('Que faites-vous dans la vie').fill('Infirmière');
  const apercu = page.getByTestId('carte-apercu');
  await expect(apercu).toContainText('Ines');
  await expect(apercu).toContainText('Infirmière');
  await expect(apercu).not.toContainText('ans');
  await page.getByRole('button', { name: 'Enregistrer ma carte' }).click();
  await expect(page.getByTestId('carte-merci')).toContainText('ne sera pas affichée');
  expect(await tirer()).toBeNull();

  // Autorisée : elle devient tirable, et l'accord se relit à la modification.
  await page.getByRole('button', { name: 'Modifier ma carte' }).click();
  await page.getByTestId('carte-accord').check();
  await page.getByRole('button', { name: 'Enregistrer ma carte' }).click();
  await expect(page.getByTestId('carte-merci')).toContainText('modifier avant son affichage');
  const { data: joueur } = await clientService()
    .from('joueurs')
    .select('id')
    .eq('evenement_id', evenement.id)
    .single();
  expect(await tirer()).toBe((joueur as { id: string }).id);
  await clientService()
    .from('pilotage')
    .update({ scene: 'connaissance' })
    .eq('evenement_id', evenement.id);
  expect(await carteALEcran()).toMatchObject({ prenom: 'Ines', metier: 'Infirmière' });

  // L'accord retiré après le tirage : la carte quitte aussitôt l'état de l'écran.
  await page.getByRole('button', { name: 'Modifier ma carte' }).click();
  await expect(page.getByTestId('carte-accord')).toBeChecked();
  await page.getByTestId('carte-accord').uncheck();
  await page.getByRole('button', { name: 'Enregistrer ma carte' }).click();
  await expect(page.getByTestId('carte-merci')).toContainText('ne sera pas affichée');
  expect(await carteALEcran()).toBeNull();

  // Tout effacer supprime la carte.
  await page.getByRole('button', { name: 'Modifier ma carte' }).click();
  await page.getByLabel('Que faites-vous dans la vie').fill('');
  await page.getByRole('button', { name: 'Enregistrer ma carte' }).click();
  await expect(page.getByTestId('carte-merci')).toContainText('supprimée');
  const { count } = await clientService()
    .from('cartes_joueurs')
    .select('*', { count: 'exact', head: true })
    .eq('evenement_id', evenement.id);
  expect(count).toBe(0);
});

test('messages fermés et avis ouverts : quatre destinations, accord de citation distinct', async ({
  browser,
}) => {
  const evenement = await soiree({ equipes: 1 });
  await clientService()
    .from('pilotage')
    .update({ messages_ouverts: true })
    .eq('evenement_id', evenement.id);
  const page = await arriver(browser, evenement.code, 'Zoé');
  const barre = page.getByTestId('navigation-joueur');
  await expect(barre.getByRole('button')).toHaveCount(5);

  await clientService()
    .from('pilotage')
    .update({ messages_ouverts: false, avis_ouverts: true })
    .eq('evenement_id', evenement.id);
  await signaler(evenement.id);
  await expect(page.getByTestId('ouvrir-message')).toHaveCount(0, { timeout: 6000 });
  await expect(barre.getByRole('button')).toHaveCount(4);
  await expect(barre).toHaveAttribute('data-colonnes', '4');

  await page.getByRole('button', { name: 'Donner mon avis' }).click();
  await expect(page.getByTestId('avis-citable')).not.toBeChecked();
  await page.getByLabel(/1/).first().fill('Le blind test');
  await page.getByRole('button', { name: /Suivant|Continuer/ }).click();
  await page.getByRole('button', { name: 'Rien à redire' }).click();
  await expect(page.getByTestId('avis-merci')).toBeVisible();
  const { data } = await clientService()
    .from('avis_joueurs')
    .select('positifs, citable, prenom')
    .eq('evenement_id', evenement.id)
    .single();
  expect(data).toMatchObject({ positifs: ['Le blind test'], citable: false, prenom: null });
});

test('le classement : rien avant la révélation, puis les rangs du grand écran', async ({
  browser,
}) => {
  const evenement = await soiree({ equipes: 3 });
  const service = clientService();
  const equipes = await equipesDe(evenement.id);
  const page = await arriver(browser, evenement.code, 'Hugo');
  await service
    .from('joueurs')
    .update({ equipe_id: equipes[1]!.id })
    .eq('evenement_id', evenement.id);
  for (const [i, points] of [100, 300, 200].entries()) {
    await service
      .from('scores')
      .insert({ evenement_id: evenement.id, equipe_id: equipes[i]!.id, points, motif: 'test' });
  }

  await page.getByTestId('onglet-classement').click();
  await expect(page.getByTestId('classement-attente')).toContainText(
    "Les scores seront disponibles après l'annonce du podium.",
  );

  // Une clôture seule ne publie rien.
  await service.from('evenements').update({ statut: 'termine' }).eq('id', evenement.id);
  await page.reload();
  await page.getByTestId('onglet-classement').click();
  await expect(page.getByTestId('classement-attente')).toBeVisible();
  await service.from('evenements').update({ statut: 'en_cours' }).eq('id', evenement.id);

  const regie = await (
    await browser.newContext({ viewport: { width: 1920, height: 1080 }, isMobile: false })
  ).newPage();
  await regie.goto('/regie');
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL('**/regie');
  await service.from('pilotage').update({ scene: 'podium' }).eq('evenement_id', evenement.id);
  await regie.goto(`/ecran/${evenement.code}`);
  await expect(regie.getByTestId('podium-1')).toContainText('300', { timeout: 15_000 });

  await expect(async () => {
    await page.reload();
    await page.getByTestId('onglet-classement').click();
    await expect(page.getByTestId('classement')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 12_000 });
  await expect(page.getByTestId('rang-1')).toContainText('Équipe 2');
  await expect(page.getByTestId('rang-1')).toContainText('300');
  await expect(page.getByTestId('rang-1')).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('rang-2')).toContainText('Équipe 3');
  await expect(page.getByTestId('rang-3')).toContainText('Équipe 1');
  for (const place of [1, 2, 3]) {
    const points = regie.locator(`[data-testid="podium-${place}"] .tu-stage-podium__points`);
    await expect(page.getByTestId(`rang-${place}`)).toContainText(
      (await points.innerText()).trim(),
    );
  }

  // Rouverte, l'app garde ce classement.
  await page.close();
  const rouverte = await page.context().newPage();
  await rouverte.goto(`/${evenement.code}`);
  await rouverte.getByRole('button', { name: 'Voir le podium' }).click();
  await expect(rouverte.getByTestId('rang-1')).toContainText('Équipe 2');
});

for (const [langue, libelles] of [
  ['fr', ['Ma partie', 'Les jeux', 'Message', 'Équipe', 'Classement']],
  ['en', ['My game', 'Games', 'Message', 'Team', 'Ranking']],
  ['ta', ['என் ஆட்டம்', 'ஆட்டங்கள்', 'செய்தி', 'அணி', 'தரவரிசை']],
] as const) {
  test(`320 px en ${langue} : cinq libellés lisibles, cibles tactiles, clavier`, async ({
    browser,
  }) => {
    const evenement = await soiree({ equipes: 1, langues: ['fr', 'en', 'ta'] });
    await clientService()
      .from('pilotage')
      .update({ messages_ouverts: true })
      .eq('evenement_id', evenement.id);
    const page = await telephone(browser, 320);
    await page
      .context()
      .addCookies([{ name: 'tu_langue', value: langue, url: 'http://localhost:3100' }]);
    const r = await page.request.post(`/api/partie/${evenement.code}/rejoindre`, {
      data: { prenom: 'Maya', langue, volontaire: false },
    });
    expect(r.status()).toBe(200);
    await page.goto(`/${evenement.code}`);
    const barre = page.getByTestId('navigation-joueur');
    for (const libelle of libelles) await expect(barre.getByText(libelle)).toBeVisible();

    const mesure = await page.evaluate(() => ({
      debord: document.documentElement.scrollWidth - window.innerWidth,
      items: [...document.querySelectorAll<HTMLElement>('.tu-player-nav__item')].map((b) => {
        const texte = b.querySelector('span:last-child')!.getBoundingClientRect();
        const boite = b.getBoundingClientRect();
        return {
          hauteur: boite.height,
          dans: texte.left >= boite.left - 0.5 && texte.right <= boite.right + 0.5,
        };
      }),
    }));
    expect(mesure.debord).toBeLessThanOrEqual(0);
    for (const item of mesure.items) {
      expect(item.hauteur).toBeGreaterThanOrEqual(56);
      expect(item.dans).toBe(true);
    }

    // Le dernier élément de la page n'est pas caché par la barre.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const lien = page.locator('.tu-liens__ligne').last();
    const basLien = (await lien.boundingBox())!;
    const hautBarre = (await barre.boundingBox())!.y;
    expect(basLien.y + basLien.height).toBeLessThanOrEqual(hautBarre);

    // Champ actif : la barre s'efface, le bouton de validation reste atteignable.
    await page.locator('.tu-liens__ligne').first().click();
    await page.locator('input').first().focus();
    await expect(barre).toBeHidden();
    const enregistrer = page.getByTestId('carte-saisie').locator('button[type="submit"]');
    await enregistrer.scrollIntoViewIfNeeded();
    await expect(enregistrer).toBeInViewport();
  });
}

test('au retour de veille, aucune action sur un état périmé ; la manche est celle de la régie', async ({
  browser,
}) => {
  const evenement = await soiree({ equipes: 1 });
  const page = await arriver(browser, evenement.code, 'Rémi');
  await poserQuestion(evenement.id);
  await expect(page.locator('.tu-quiz-choice').first()).toBeVisible({ timeout: 5000 });

  // Le téléphone se réveille : tant que l'état n'est pas relu, ses boutons ne répondent pas.
  let relache: () => void = () => {};
  const retenue = new Promise<void>((fin) => (relache = fin));
  await page.route(`**/api/partie/${evenement.code}/etat`, async (route) => {
    await retenue;
    await route.continue();
  });
  await clientService()
    .from('pilotage')
    .update({ etape: 'reponse' })
    .eq('evenement_id', evenement.id);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByTestId('vue-du-jeu')).toHaveAttribute('inert', '');
  relache();
  await expect(page.getByTestId('vue-du-jeu')).not.toHaveAttribute('inert', '', { timeout: 5000 });
  await expect(page.getByTestId('vue-du-jeu')).toHaveAttribute('data-urgent', 'false');
  await expect(page.getByTestId('navigation-joueur')).toBeVisible();
});
