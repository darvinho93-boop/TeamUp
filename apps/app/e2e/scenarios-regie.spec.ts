import { expect, request, test, type Browser, type Page } from '@playwright/test';
import {
  appeler,
  clientService,
  creerEvenementJetable,
  hacher,
  supprimerEvenements,
} from '../tests/base';

/**
 * Scénarios de la panne du 2026-10-31 (ABXNJK, 7 équipes ramenées à 5 en soirée) et de ses
 * variantes : à chaque fois, la régie garde la main (une touche pour continuer, jamais de page
 * blanche) et l'écran commun montre toujours quelque chose.
 *
 * 1. L'état exact laissé par la soirée : Points communs ouvert sur un passage sans équipe, deux
 *    passages orphelins dans Points communs et dans le Mime. La régie reprend et finit les jeux.
 * 2. La même suppression d'équipes faite aujourd'hui : les passages partent avec les équipes,
 *    le tirage et les jeux se déroulent sur les 5 équipes restantes.
 * 3. Ce qu'on fera désormais : former 7 équipes, puis les refaire à 5 avant le premier jeu.
 * 4. Audit du 2026-11-02 : la régie montre les scores en plein jeu, avant « Terminer la manche »,
 *    puis revient au jeu par « Présenter ». Le quiz reprend à son mode et ses points comptent une
 *    fois ; un jeu joué en entier se termine au lieu de rester bloqué.
 */

const crees: string[] = [];
test.afterAll(() => supprimerEvenements(crees));

type Service = ReturnType<typeof clientService>;

/**
 * Des consignes de Points communs ou des mots de Mime en français. La démo n'en a que 6 de
 * Points communs : il en faut 7 distincts (une réserve à 7 équipes), on complète par des contenus
 * jetables, retirés en fin de fichier.
 */
const contenusJetables: string[] = [];
test.afterAll(async () => {
  if (contenusJetables.length)
    await clientService().from('contenus').delete().in('id', contenusJetables);
});

async function contenus(service: Service, jeu: 'list2' | 'mime2', n: number) {
  const { data } = await service
    .from('contenus')
    .select('id, contenus_traductions!inner(langue)')
    .eq('jeu', jeu)
    .eq('actif', true)
    .eq('contenus_traductions.langue', 'fr')
    .limit(n);
  const ids = (data as { id: string }[]).map((c) => c.id);
  while (ids.length < n) {
    const k = ids.length + 1;
    const { data: cree, error } = await service
      .from('contenus')
      .insert({ jeu, etiquette: 'tout_public', actif: false })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    const id = (cree as { id: string }).id;
    contenusJetables.push(id);
    await service.from('contenus_traductions').insert({
      contenu_id: id,
      langue: 'fr',
      valeur: jeu === 'list2' ? { consigne: 'Levez-vous si ça vous concerne.' } : {},
    });
    await service.from('contenus_secrets').insert({
      contenu_id: id,
      langue: 'fr',
      valeur:
        jeu === 'list2'
          ? { reponse: `scénario ${k}`, indices: ['Premier indice', 'Second indice'] }
          : { mot: `Mot ${k}` },
    });
    ids.push(id);
  }
  return ids;
}

/** Une soirée comme ABXNJK : 7 équipes, des inscrits, Points communs puis Mime, un passage chacune. */
async function soireeASeptEquipes(inscrits = 21) {
  const service = clientService();
  const ev = await creerEvenementJetable({ equipes: 7, langues: ['fr'] });
  crees.push(ev.id);
  for (let i = 1; i <= inscrits; i++) {
    const { erreur } = await appeler(service, 'rejoindre_evenement', {
      p_code: ev.code,
      p_prenom: `Invité ${i}`,
      p_langue: 'fr',
      p_jeton_hash: hacher(`scenario-${ev.code}-${i}`),
    });
    expect(erreur).toBeNull();
  }
  const { data: equipes } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', ev.id)
    .order('numero');
  const eqs = equipes as { id: string; numero: number }[];
  const manches: Record<'list2' | 'mime2', string> = { list2: '', mime2: '' };
  for (const [ordre, jeu] of [
    [1, 'list2'],
    [2, 'mime2'],
  ] as const) {
    const { data } = await service
      .from('manches')
      .insert({ evenement_id: ev.id, jeu, ordre, options: { passages_par_equipe: 1 } })
      .select('id')
      .single();
    manches[jeu] = (data as { id: string }).id;
    const ids = await contenus(service, jeu, 7);
    const { error } = await service.from('passages').insert(
      eqs.map((e, i) => ({
        manche_id: manches[jeu],
        evenement_id: ev.id,
        equipe_id: e.id,
        ordre: i + 1,
        contenu_id: ids[i],
      })),
    );
    expect(error).toBeNull();
  }
  return { ...ev, equipes: eqs, manches, service };
}

async function connecter(browser: Browser): Promise<Page> {
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

/**
 * Le tirage de l'ordre a eu lieu : la régie propose « Tirer à nouveau », l'écran montre l'ordre
 * (pendant l'animation de 5 s ou après, selon la vitesse du poste).
 */
async function ordreTire(regie: Page, ecran: Page) {
  const retirer = regie.getByRole('button', { name: 'Tirer à nouveau' });
  await expect(retirer).toBeVisible({ timeout: 10_000 });
  // Deux touches trop rapprochées : la régie refuse la seconde (« La salle a changé
  // entre-temps ») au lieu de l'écrire sur un état périmé. L'animateur réessaie, et ça repart.
  const alerte = regie.locator('.tu-regie__alert');
  if (await alerte.isVisible()) {
    await expect(alerte).toContainText('La salle a changé');
    await retirer.click();
  }
  await expect(alerte).toHaveCount(0, { timeout: 10_000 });
  await expect(ecran.getByText('Ordre de passage').first()).toBeVisible({ timeout: 10_000 });
}

const confirmer = async (regie: Page, nom: string) => {
  await regie.getByRole('button', { name: nom, exact: true }).click();
  await regie.getByRole('button', { name: `Confirmer : ${nom}` }).click();
};

/** L'écran commun n'est jamais vide : une scène y est montée, avec du contenu. */
async function ecranNonVide(ecran: Page) {
  await expect(ecran.locator('.tu-stage__body').first()).toBeVisible();
  await expect(ecran.locator('.tu-stage__body').first()).not.toBeEmpty();
}

/**
 * Joue le passage ouvert jusqu'au bout : s'il a une équipe, un tour de Points communs ou de Mime
 * conclu par un échec ; sinon « Passer ce passage ». Puis le suivant, jusqu'à la fin de la manche.
 * Rend le nombre de passages joués et passés.
 */
async function jouerJusquauBout(regie: Page, ecran: Page, jeu: 'list2' | 'mime2') {
  let joues = 0;
  let passes = 0;
  const journal: string[] = [];
  for (let garde = 0; garde < 30; garde++) {
    const sansEquipe = regie.getByTestId('passage-sans-equipe');
    const commencer = regie.getByRole('button', {
      name: `Commencer : ${jeu === 'list2' ? 'Points communs' : 'Mime'}`,
    });
    const terminer = regie.getByRole('button', { name: 'Terminer la manche' });
    const suivant = regie.getByRole('button', { name: /Passage suivant/ });
    // Le dernier passage passé termine la manche : la régie revient d'elle-même au programme.
    const finie = regie.getByText('Présente un jeu du programme pour le lancer.');
    const pret =
      jeu === 'list2'
        ? regie.getByRole('button', { name: 'Afficher', exact: true })
        : regie.getByRole('button', { name: 'Montrer le mot au premier de la file' });
    await expect(
      sansEquipe.or(commencer).or(pret).or(terminer).or(suivant).or(finie).first(),
    ).toBeVisible({
      timeout: 10_000,
    });
    await ecranNonVide(ecran);
    if (await finie.isVisible()) {
      journal.push('fin');
      break;
    }

    if (await sansEquipe.isVisible()) {
      // La panne d'hier : plus de page blanche, une touche pour passer.
      await expect(ecran.getByTestId('un-instant')).toBeVisible({ timeout: 5000 });
      await regie.getByRole('button', { name: 'Passer ce passage' }).click();
      passes += 1;
      journal.push('passer');
      await expect(sansEquipe).toHaveCount(0, { timeout: 10_000 });
      continue;
    }
    if (await commencer.isVisible()) {
      await commencer.click();
      // La touche part, la régie change d'écran : on attend avant d'en regarder une autre.
      await expect(commencer).toHaveCount(0, { timeout: 10_000 });
      journal.push('commencer');
      continue;
    }
    // Après un verdict, « Afficher » reste visible mais grisé : seule une touche active compte.
    if ((await pret.isVisible()) && (await pret.isEnabled())) {
      if (jeu === 'list2') {
        await pret.click();
        await regie.getByRole('button', { name: 'Masquer' }).click();
      } else {
        await pret.click();
        await regie.getByTestId('regie-mot').click();
      }
      await regie.getByRole('button', { name: 'Lancer' }).click();
      await confirmer(regie, jeu === 'list2' ? 'Échec' : 'Raté');
      await expect(ecran.getByTestId('verdict')).toBeVisible({ timeout: 5000 });
      joues += 1;
      journal.push('joué');
      continue;
    }
    if (await suivant.isVisible()) {
      await suivant.click();
      await expect(suivant).toHaveCount(0, { timeout: 10_000 });
      journal.push('suivant');
      continue;
    }
    if (await terminer.isVisible()) {
      await terminer.click();
      await expect(ecran.locator('[data-scene="programme"]')).toBeVisible({ timeout: 10_000 });
      journal.push('terminer');
      break;
    }
  }
  console.log(`JOURNAL ${jeu} : ${journal.join(' → ')}`);
  return { joues, passes };
}

async function statutManche(service: Service, id: string) {
  const { data } = await service.from('manches').select('statut').eq('id', id).single();
  return (data as { statut: string }).statut;
}

test("1. l'état exact laissé par la soirée d'hier : la régie reprend la main et finit les jeux", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const s = await soireeASeptEquipes();
  const { service } = s;
  // Comme avant le correctif : les passages des équipes 1 et 4 perdent leur équipe (la clé
  // étrangère les mettait à null), puis les équipes partent.
  const orphelines = s.equipes.filter((e) => e.numero === 1 || e.numero === 4).map((e) => e.id);
  await service.from('passages').update({ equipe_id: null }).in('equipe_id', orphelines);
  await service.from('equipes').delete().in('id', orphelines);
  // Points communs ouvert à 19 h 26 sur le passage 1, sans équipe ; la salle sur « Équipes ».
  const { data: p1 } = await service
    .from('passages')
    .update({ statut: 'en_cours', commence_le: new Date().toISOString() })
    .eq('manche_id', s.manches.list2)
    .eq('ordre', 1)
    .select('id')
    .single();
  await service
    .from('manches')
    .update({ statut: 'en_cours', commence_le: new Date().toISOString() })
    .eq('id', s.manches.list2);
  const { error } = await service
    .from('pilotage')
    .update({
      scene: 'equipes',
      manche_id: s.manches.list2,
      passage_id: (p1 as { id: string }).id,
      etape: 'pret',
    })
    .eq('evenement_id', s.id);
  expect(error).toBeNull();

  const regie = await connecter(browser);
  const ecran = await ouvrirEcran(browser, regie, s.code);
  await regie.goto(`/regie/${s.code}/pilotage`);
  await ecranNonVide(ecran);

  // La régie revient au jeu : « Présenter » Points communs, puis la touche « Commencer ».
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await expect(ecran.locator('[data-scene="intro"]')).toBeVisible({ timeout: 5000 });
  const pc = await jouerJusquauBout(regie, ecran, 'list2');
  expect(pc).toEqual({ joues: 5, passes: 2 });
  await expect.poll(() => statutManche(service, s.manches.list2)).toBe('terminee');

  // Le Mime, avec ses deux passages orphelins : le tirage de l'ordre les range à la fin.
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await expect(ecran.locator('[data-scene="intro"]')).toBeVisible({ timeout: 10_000 });
  await regie.getByRole('button', { name: "Tirer l'ordre de passage" }).click();
  await ordreTire(regie, ecran);
  // Aucune alerte de la régie (le tirage échouait sans rien dire le 2026-10-31).
  await expect(regie.locator('.tu-regie__alert')).toHaveCount(0);
  const mime = await jouerJusquauBout(regie, ecran, 'mime2');
  expect(mime).toEqual({ joues: 5, passes: 2 });
  await expect.poll(() => statutManche(service, s.manches.mime2)).toBe('terminee');

  // Aucun point pour les passages passés : seuls les 5 joués comptent (en échec, 0 aussi).
  const { data: passes } = await service
    .from('passages')
    .select('points, resultat')
    .eq('evenement_id', s.id)
    .is('equipe_id', null);
  expect(passes).toHaveLength(4);
  for (const p of passes as { points: number; resultat: Record<string, unknown> }[]) {
    expect(p.points).toBe(0);
    expect(p.resultat['passe']).toBe(true);
  }
});

test("2. supprimer deux équipes aujourd'hui : leurs passages partent, le tirage et les jeux suivent", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const s = await soireeASeptEquipes();
  const { service } = s;
  const supprimees = s.equipes.filter((e) => e.numero === 1 || e.numero === 4).map((e) => e.id);
  const { error } = await service.from('equipes').delete().in('id', supprimees);
  expect(error).toBeNull();
  for (const manche of Object.values(s.manches)) {
    const { data } = await service.from('passages').select('equipe_id').eq('manche_id', manche);
    expect(data).toHaveLength(5);
    expect((data as { equipe_id: string | null }[]).every((p) => p.equipe_id !== null)).toBe(true);
  }

  const regie = await connecter(browser);
  const ecran = await ouvrirEcran(browser, regie, s.code);
  await regie.goto(`/regie/${s.code}/pilotage`);
  for (const [jeu, manche] of [
    ['list2', s.manches.list2],
    ['mime2', s.manches.mime2],
  ] as const) {
    await regie.getByRole('button', { name: 'Présenter' }).first().click();
    await expect(ecran.locator('[data-scene="intro"]')).toBeVisible({ timeout: 10_000 });
    await regie.getByRole('button', { name: "Tirer l'ordre de passage" }).click();
    await ordreTire(regie, ecran);
    const bilan = await jouerJusquauBout(regie, ecran, jeu);
    expect(bilan).toEqual({ joues: 5, passes: 0 });
    await expect.poll(() => statutManche(service, manche)).toBe('terminee');
  }
});

test('3. désormais : former 7 équipes, puis les refaire à 5 avant le premier jeu', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const service = clientService();
  const ev = await creerEvenementJetable({ equipes: 0, langues: ['fr'] });
  crees.push(ev.id);
  await service.from('evenements').update({ equipes_prevues: 7 }).eq('id', ev.id);
  const { data: groupes } = await service
    .from('groupes')
    .insert([
      { evenement_id: ev.id, ordre: 1, nom: 'Famille' },
      { evenement_id: ev.id, ordre: 2, nom: 'Amis' },
    ])
    .select('id');
  const [famille, amis] = (groupes as { id: string }[]).map((g) => g.id);
  // 36 inscrits comme hier soir, deux tiers de la famille, trois volontaires avec un nom.
  for (let i = 1; i <= 36; i++) {
    const volontaire = i <= 3;
    const { erreur } = await appeler(service, 'rejoindre_evenement', {
      p_code: ev.code,
      p_prenom: `Invité ${i}`,
      p_langue: 'fr',
      p_jeton_hash: hacher(`scenario3-${ev.code}-${i}`),
      p_groupe: i % 3 === 0 ? amis : famille,
      p_volontaire: volontaire,
      ...(volontaire ? { p_nom_propose: `Équipe de ${i}` } : {}),
    });
    expect(erreur).toBeNull();
  }
  const manches: Record<'list2' | 'mime2', string> = { list2: '', mime2: '' };
  for (const [ordre, jeu] of [
    [1, 'list2'],
    [2, 'mime2'],
  ] as const) {
    const reserve = await contenus(service, jeu, 7);
    const { data } = await service
      .from('manches')
      .insert({
        evenement_id: ev.id,
        jeu,
        ordre,
        options: { passages_par_equipe: 1, reserve },
      })
      .select('id')
      .single();
    manches[jeu] = (data as { id: string }).id;
  }

  const regie = await connecter(browser);
  const ecran = await ouvrirEcran(browser, regie, ev.code);

  // Avant la formation, la régie ne peut pas lancer un jeu par équipe : elle le dit.
  await regie.goto(`/regie/${ev.code}/pilotage`);
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await expect(regie.getByTestId('former-dabord')).toBeVisible({ timeout: 10_000 });
  await expect(regie.getByRole('button', { name: 'Commencer : Points communs' })).toHaveCount(0);
  await ecranNonVide(ecran);

  // Formation à 7.
  await regie.goto(`/regie/${ev.code}/salle`);
  await expect(regie.getByTestId('nombre-equipes')).toHaveValue('7');
  await regie.getByTestId('former-equipes').click();
  await regie.getByRole('button', { name: 'Confirmer : 7 équipes' }).click();
  await expect(regie.getByTestId('refaire-equipes')).toBeVisible({ timeout: 15_000 });
  const passagesDe = async (manche: string) =>
    ((await service.from('passages').select('equipe_id').eq('manche_id', manche)).data ?? [])
      .length;
  expect(await passagesDe(manches.list2)).toBe(7);

  // Trop peu remplies : on refait à 5, comme hier, mais avant de jouer.
  await regie.getByTestId('nombre-equipes').fill('5');
  await regie.getByTestId('refaire-equipes').click();
  await regie.getByRole('button', { name: 'Confirmer : tout refaire' }).click();
  await expect.poll(() => passagesDe(manches.list2), { timeout: 15_000 }).toBe(5);
  expect(await passagesDe(manches.mime2)).toBe(5);

  const { data: equipes } = await service
    .from('equipes')
    .select('id, nom')
    .eq('evenement_id', ev.id);
  expect(equipes).toHaveLength(5);
  const { data: joueurs } = await service
    .from('joueurs')
    .select('equipe_id, capitaine')
    .eq('evenement_id', ev.id);
  const js = joueurs as { equipe_id: string | null; capitaine: boolean }[];
  expect(js.every((j) => j.equipe_id !== null)).toBe(true);
  const tailles = (equipes as { id: string }[]).map(
    (e) => js.filter((j) => j.equipe_id === e.id).length,
  );
  expect(Math.max(...tailles) - Math.min(...tailles)).toBeLessThanOrEqual(1);
  expect(js.filter((j) => j.capitaine)).toHaveLength(5);
  // Les trois volontaires sont capitaines, leurs noms sont ceux de trois équipes.
  expect((equipes as { nom: string }[]).filter((e) => e.nom.startsWith('Équipe de '))).toHaveLength(
    3,
  );

  // Puis le jeu se déroule sur les 5 équipes.
  await regie.goto(`/regie/${ev.code}/pilotage`);
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await expect(ecran.locator('[data-scene="intro"]')).toBeVisible({ timeout: 10_000 });
  await regie.getByRole('button', { name: "Tirer l'ordre de passage" }).click();
  await ordreTire(regie, ecran);
  const bilan = await jouerJusquauBout(regie, ecran, 'list2');
  expect(bilan).toEqual({ joues: 5, passes: 0 });

  // Un jeu a commencé : la Salle ne propose plus de refaire, et la base le refuserait.
  await regie.goto(`/regie/${ev.code}/salle`);
  await expect(regie.getByTestId('formation')).toHaveCount(0);
});

/** La bonne réponse d'une question, lue en base : les invités simulés répondent juste. */
async function bonneDe(service: Service, passageId: string): Promise<number> {
  const { data: passage } = await service
    .from('passages')
    .select('contenu_id')
    .eq('id', passageId)
    .single();
  const { data: secret } = await service
    .from('contenus_secrets')
    .select('valeur')
    .eq('contenu_id', (passage as { contenu_id: string }).contenu_id)
    .eq('langue', 'fr')
    .single();
  return (secret as { valeur: { bonne: number } }).valeur.bonne;
}

test('4. les scores en plein jeu : le quiz reprend à son mode, puis chaque jeu se termine', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const service = clientService();
  const ev = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
  crees.push(ev.id);

  // Un invité par équipe, arrivé avant la première question : il répondra juste partout.
  const invites = await Promise.all(
    ['Ana', 'Bao'].map(async (prenom) => {
      const api = await request.newContext({
        baseURL: baseURL!,
        extraHTTPHeaders: { connection: 'close' },
      });
      const r = await api.post(`/api/partie/${ev.code}/rejoindre`, {
        data: { prenom, langue: 'fr' },
      });
      expect(r.status()).toBe(200);
      return api;
    }),
  );

  // Un quiz de deux questions, puis Points communs déjà joué en entier mais jamais terminé.
  const { data: questions } = await service
    .from('contenus')
    .select('id')
    .eq('jeu', 'qcm2')
    .eq('actif', true)
    .order('cree_le')
    .limit(2);
  const { data: quiz } = await service
    .from('manches')
    .insert({ evenement_id: ev.id, jeu: 'qcm2', ordre: 1, options: { questions: 2 } })
    .select('id')
    .single();
  const mancheQuiz = (quiz as { id: string }).id;
  await service.from('passages').insert(
    (questions as { id: string }[]).map((q, i) => ({
      manche_id: mancheQuiz,
      evenement_id: ev.id,
      ordre: i + 1,
      contenu_id: q.id,
    })),
  );
  const { data: equipes } = await service
    .from('equipes')
    .select('id')
    .eq('evenement_id', ev.id)
    .order('numero');
  const consignes = await contenus(service, 'list2', 2);
  const { data: pc } = await service
    .from('manches')
    .insert({
      evenement_id: ev.id,
      jeu: 'list2',
      ordre: 2,
      statut: 'en_cours',
      options: { passages_par_equipe: 1 },
    })
    .select('id')
    .single();
  const manchePC = (pc as { id: string }).id;
  const { error } = await service.from('passages').insert(
    (equipes as { id: string }[]).map((e, i) => ({
      manche_id: manchePC,
      evenement_id: ev.id,
      equipe_id: e.id,
      ordre: i + 1,
      contenu_id: consignes[i],
      statut: 'termine',
      points: 0,
    })),
  );
  expect(error).toBeNull();

  const regie = await connecter(browser);
  const ecran = await ouvrirEcran(browser, regie, ev.code);
  await regie.goto(`/regie/${ev.code}/pilotage`);
  const scene = (nom: string, etape = '') =>
    ecran.locator(`[data-scene="${nom}"]${etape ? `[data-etape="${etape}"]` : ''}`);
  const scenes = regie.getByRole('group', { name: 'Scènes' });
  const reprise = regie.getByRole('button', { name: 'Commencer : Quiz · mode téléphone' });

  /** Les scores à l'écran en plein jeu, puis retour au jeu par « Présenter ». */
  const scoresPuisRetour = async () => {
    await scenes.getByRole('button', { name: 'Scores' }).click();
    await expect(scene('scores')).toBeVisible({ timeout: 10_000 });
    await regie.getByRole('button', { name: 'Présenter' }).first().click();
    await expect(scene('intro')).toBeVisible({ timeout: 10_000 });
  };

  /** Une question jusqu'à sa réponse révélée, les deux invités répondant juste. */
  const jouerLaQuestion = async () => {
    await regie.getByRole('button', { name: 'Afficher la question' }).click();
    for (const lettre of ['A', 'B', 'C', 'D']) {
      await regie.getByRole('button', { name: `Afficher la réponse ${lettre}` }).click();
    }
    await regie.getByRole('button', { name: 'Lancer le chrono' }).click();
    const reveler = regie.getByRole('button', { name: 'Révéler la réponse' });
    await expect(reveler).toBeEnabled({ timeout: 10_000 });
    const { data: pilotage } = await service
      .from('pilotage')
      .select('passage_id')
      .eq('evenement_id', ev.id)
      .single();
    const bonne = await bonneDe(service, (pilotage as { passage_id: string }).passage_id);
    for (const api of invites) {
      const r = await api.post(`/api/partie/${ev.code}/quiz`, { data: { choix: bonne } });
      expect(r.status()).toBe(200);
    }
    await expect(regie.getByTestId('regie-reponses')).toHaveText(/^2 réponses reçues/);
    await reveler.click();
    await expect(ecran.getByTestId('bonne-reponse')).toBeVisible({ timeout: 10_000 });
  };

  // --- Le quiz, lancé en mode téléphone : première question.
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await expect(scene('intro')).toBeVisible({ timeout: 10_000 });
  await regie.getByRole('button', { name: 'Mode téléphone (salle sans croix)' }).click();
  await expect(scene('qcm2', 'pret')).toBeVisible({ timeout: 10_000 });
  await jouerLaQuestion();

  // Les scores entre deux questions. De retour, une seule touche : reprendre, au même mode.
  await scoresPuisRetour();
  await expect(regie.getByRole('button', { name: 'Commencer le quiz en mode croix' })).toHaveCount(
    0,
  );
  await reprise.click();
  await expect(scene('qcm2', 'pret')).toBeVisible({ timeout: 10_000 });
  const { data: manche } = await service
    .from('manches')
    .select('options')
    .eq('id', mancheQuiz)
    .single();
  expect((manche as { options: Record<string, unknown> }).options['mode']).toBe('telephone');

  // Seconde et dernière question, puis les scores avant la validation : on y revient.
  await jouerLaQuestion();
  await scoresPuisRetour();
  await reprise.click();
  await expect(scene('qcm2', 'survivants')).toBeVisible({ timeout: 10_000 });
  await expect(regie.getByTestId('survivants-1')).toHaveText('1 survivant');
  await confirmer(regie, 'Valider les survivants');
  await expect(scene('qcm2', 'resultat')).toBeVisible({ timeout: 10_000 });

  // Validé : le quiz ne se rejoue pas, il se termine ; ses points ne comptent qu'une fois.
  await scoresPuisRetour();
  await expect(regie.getByRole('button', { name: /^Commencer/ })).toHaveCount(0);
  await regie.getByRole('button', { name: 'Terminer la manche' }).click();
  await expect(scene('programme')).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => statutManche(service, mancheQuiz)).toBe('terminee');
  const { data: points } = await service
    .from('scores')
    .select('points')
    .eq('manche_id', mancheQuiz);
  expect((points as { points: number }[]).map((p) => p.points)).toEqual([100, 100]);

  // Points communs, joué en entier : « Terminer la manche » à la place de « Commencer ».
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await expect(scene('intro')).toBeVisible({ timeout: 10_000 });
  await expect(regie.getByRole('button', { name: 'Commencer : Points communs' })).toHaveCount(0);
  await regie.getByRole('button', { name: 'Terminer la manche' }).click();
  await expect.poll(() => statutManche(service, manchePC)).toBe('terminee');
  await expect(scene('programme')).toBeVisible({ timeout: 10_000 });
  await expect(ecran.locator('.tu-stage-list__item--fait')).toHaveCount(2);
  await expect(regie.getByRole('button', { name: 'Présenter' })).toHaveCount(0);
});
