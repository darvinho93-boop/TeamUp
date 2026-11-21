import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  aleaDepuis,
  pointsTournoi,
  prochaineSequence,
  tirerTableau,
  type Duelliste,
  type MatchTournoi,
} from '@teamup/game';
import {
  appeler,
  baseDisponible,
  clientAnimateur,
  clientAnon,
  clientService,
  creerEvenementJetable,
  hacher,
  supprimerEvenements,
} from './base';

/**
 * Tournoi du gobelet (2026-11-21), côté base : le tirage revérifié, les séquences, les résultats
 * donnés par la régie, et ce qu'un téléphone reçoit (son seul match, aucun droit d'écrire).
 */
const avecBase = describe.skipIf(!baseDisponible);

interface Ligne {
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
  sequence: number | null;
  poste: number | null;
}
type MatchLu = MatchTournoi & { id: string };

let evenement: { id: string; code: string };
let manche: string;
let passage: string;
let joueurs: Duelliste[] = [];
const equipes: Record<number, string> = {};
const jeton = (prenom: string) => `tournoi-${evenement.id}-${prenom}`;

const anna = () => clientAnimateur('anna@teamup.test');

async function lire(): Promise<MatchLu[]> {
  const { data, error } = await clientService()
    .from('matchs_tournoi')
    .select('*')
    .eq('manche_id', manche)
    .order('tour')
    .order('rang');
  if (error) throw new Error(error.message);
  const duelliste = (id: string | null, prenom: string | null, equipe: number | null) =>
    prenom ? { joueur_id: id ?? '', prenom, equipe: equipe ?? 0 } : null;
  return (data as unknown as Ligne[]).map((l) => ({
    id: l.id,
    tour: l.tour,
    rang: l.rang,
    a: duelliste(l.joueur_a, l.prenom_a, l.equipe_a),
    b: duelliste(l.joueur_b, l.prenom_b, l.equipe_b),
    gagnant: l.gagnant,
    sequence: l.sequence,
    poste: l.poste,
  }));
}

async function version(): Promise<string> {
  const { data, error } = await clientService()
    .from('pilotage')
    .select('maj_le')
    .eq('evenement_id', evenement.id)
    .single();
  if (error) throw new Error(error.message);
  return (data as { maj_le: string }).maj_le;
}

const pilotage = (etape: string) => ({
  scene: 'jeu',
  manche_id: manche,
  passage_id: passage,
  etape,
  indices: 0,
  chrono: 'arreter',
});

const premierTour = (matchs: MatchTournoi[]) =>
  matchs
    .filter((m) => m.tour === 1)
    .map((m) => ({ rang: m.rang, a: m.a?.joueur_id, b: m.b?.joueur_id ?? null }));

async function poser(participants: Duelliste[], graine = 'tirage', gobelets = 4) {
  const tableau = tirerTableau(participants, aleaDepuis(graine));
  if (!tableau) throw new Error('tableau attendu');
  return appeler<number>(await anna(), 'poser_tableau', {
    p_manche: manche,
    p_premier_tour: premierTour(tableau),
    p_gobelets: gobelets,
  });
}

async function ouvrir(gobelets = 4, client?: Awaited<ReturnType<typeof anna>>) {
  const sequence = prochaineSequence(await lire(), gobelets);
  if (!sequence) throw new Error('séquence attendue');
  const reponse = await appeler<string>(client ?? (await anna()), 'ouvrir_sequence', {
    p_manche: manche,
    p_version: await version(),
    p_numero: sequence.numero,
    p_matchs: sequence.matchs.map((m) => m.id),
    p_gobelets: gobelets,
    p_pilotage: pilotage('jeu'),
  });
  return { ...reponse, sequence };
}

const resultat = async (id: string, gagnant: 0 | 1 | null) =>
  appeler<null>(await anna(), 'resultat_match', { p_match: id, p_gagnant: gagnant });

async function remettre() {
  const service = clientService();
  await service.from('matchs_tournoi').delete().eq('manche_id', manche);
  await service
    .from('pilotage')
    .update({ scene: 'jeu', manche_id: manche, passage_id: passage, etape: 'tirage' })
    .eq('evenement_id', evenement.id);
}

avecBase('tournoi du gobelet', () => {
  beforeAll(async () => {
    evenement = await creerEvenementJetable({ equipes: 4, langues: ['fr'] });
    const service = clientService();
    const { data: lues } = await service
      .from('equipes')
      .select('id, numero')
      .eq('evenement_id', evenement.id);
    for (const e of lues as { id: string; numero: number }[]) equipes[e.numero] = e.id;

    const { data: m, error: em } = await service
      .from('manches')
      .insert({
        evenement_id: evenement.id,
        jeu: 'cup',
        ordre: 1,
        statut: 'en_cours',
        options: { format: 'tournoi' },
      })
      .select('id')
      .single();
    if (em) throw new Error(em.message);
    manche = (m as { id: string }).id;

    const { data: pa, error: ep } = await service
      .from('passages')
      .insert({ manche_id: manche, evenement_id: evenement.id, ordre: 1, statut: 'en_cours' })
      .select('id')
      .single();
    if (ep) throw new Error(ep.message);
    passage = (pa as { id: string }).id;

    const lignes = Array.from({ length: 16 }, (_, i) => {
      const prenom = `Joueur${String.fromCharCode(65 + i)}`;
      return {
        evenement_id: evenement.id,
        equipe_id: equipes[(i % 4) + 1],
        prenom,
        langue: 'fr',
        jeton_hash: hacher(`tournoi-${evenement.id}-${prenom}`),
      };
    });
    const { data: js, error: ej } = await service
      .from('joueurs')
      .insert(lignes)
      .select('id, prenom, equipe_id');
    if (ej) throw new Error(ej.message);
    const numero = new Map(Object.entries(equipes).map(([n, id]) => [id, Number(n)]));
    joueurs = (js as { id: string; prenom: string; equipe_id: string }[]).map((j) => ({
      joueur_id: j.id,
      prenom: j.prenom,
      equipe: numero.get(j.equipe_id)!,
    }));
  });

  afterAll(async () => {
    await supprimerEvenements([evenement.id]);
  });

  it('personne d’autre que l’animateur de la soirée ne lit ni n’écrit le tableau', async () => {
    await remettre();
    expect((await poser(joueurs)).erreur).toBeNull();
    const [match] = await lire();

    const { data: vus } = await clientAnon()
      .from('matchs_tournoi')
      .select('id')
      .eq('manche_id', manche);
    expect(vus ?? []).toHaveLength(0);
    const brahim = await clientAnimateur('brahim@teamup.test');
    const { data: voisin } = await brahim
      .from('matchs_tournoi')
      .select('id')
      .eq('manche_id', manche);
    expect(voisin ?? []).toHaveLength(0);

    for (const client of [clientAnon(), brahim]) {
      const tableau = tirerTableau(joueurs, aleaDepuis('x'))!;
      expect(
        (
          await appeler(client, 'poser_tableau', {
            p_manche: manche,
            p_premier_tour: premierTour(tableau),
            p_gobelets: 4,
          })
        ).erreur,
      ).not.toBeNull();
      expect(
        (await appeler(client, 'resultat_match', { p_match: match!.id, p_gagnant: 0 })).erreur,
      ).not.toBeNull();
    }
    const direct = await (
      await anna()
    )
      .from('matchs_tournoi')
      .update({ gagnant: 1 })
      .eq('id', match!.id)
      .select('id');
    expect(direct.data ?? []).toHaveLength(0);
  });

  it('un téléphone ne peut appeler aucune fonction du tableau', async () => {
    const anon = clientAnon();
    const { data } = await clientService()
      .from('joueurs')
      .select('*')
      .eq('id', joueurs[0]!.joueur_id)
      .single();
    expect((await appeler(anon, 'tournoi_du_joueur', { p_joueur: data })).erreur).not.toBeNull();
    expect(
      (await appeler(await anna(), 'tournoi_du_joueur', { p_joueur: data })).erreur,
    ).not.toBeNull();
  });

  it('pose l’arbre complet, prénoms et équipes relus en base', async () => {
    await remettre();
    expect((await poser(joueurs)).data).toBe(16);
    const matchs = await lire();
    expect(matchs).toHaveLength(15);
    expect(matchs.filter((m) => m.tour === 1)).toHaveLength(8);
    expect(matchs.filter((m) => m.tour === 4)).toHaveLength(1);
    const places = matchs.filter((m) => m.tour === 1).flatMap((m) => [m.a!, m.b!]);
    expect(new Set(places.map((j) => j.joueur_id)).size).toBe(16);
    for (const j of places) expect(joueurs).toContainEqual(j);
  });

  it('refuse un tableau mal formé', async () => {
    await remettre();
    const tableau = tirerTableau(joueurs, aleaDepuis('forme'))!;
    const tour = premierTour(tableau);
    const client = await anna();
    const essai = (p_premier_tour: unknown, p_gobelets = 4) =>
      appeler(client, 'poser_tableau', { p_manche: manche, p_premier_tour, p_gobelets });

    // Un même joueur deux fois.
    expect(
      (await essai(tour.map((l, i) => (i === 1 ? { ...l, a: tour[0]!.a } : l)))).erreur,
    ).not.toBeNull();
    // Un joueur d'une autre soirée.
    expect(
      (
        await essai(
          tour.map((l, i) => (i === 0 ? { ...l, a: '11111111-1111-4111-8111-111111111111' } : l)),
        )
      ).erreur,
    ).not.toBeNull();
    // Un tableau plus grand que nécessaire.
    expect(
      (await essai([...tour, ...tour.map((l) => ({ ...l, a: null, b: null }))])).erreur,
    ).not.toBeNull();
    // Un nombre de places qui n'est pas une puissance de 2.
    expect((await essai(tour.slice(0, 7))).erreur).not.toBeNull();
    expect((await essai(tour, 1)).erreur).not.toBeNull();
    expect((await essai(tour, 33)).erreur).not.toBeNull();
    expect(await lire()).toHaveLength(0);
  });

  it('monte les exemptés au deuxième tour, deux exemptés voisins compris', async () => {
    await remettre();
    const cinq = [0, 1, 2, 3, 4].map((i) => joueurs[i]!);
    expect((await poser(cinq, 'cinq')).data).toBe(5);
    const matchs = await lire();
    expect(matchs).toHaveLength(7);
    const exemptes = matchs.filter((m) => m.tour === 1 && !m.b);
    expect(exemptes).toHaveLength(3);
    for (const m of exemptes) {
      expect(m.gagnant).toBe(0);
      const suivant = matchs.find((s) => s.tour === 2 && s.rang === m.rang >> 1)!;
      expect(suivant[m.rang % 2 === 0 ? 'a' : 'b']).toEqual(m.a);
    }
  });

  it('un résultat fait monter le gagnant, se corrige et s’annule', async () => {
    await remettre();
    await poser(joueurs);
    const { erreur, sequence } = await ouvrir();
    expect(erreur).toBeNull();
    const m = sequence.matchs[0]!;
    const place = m.rang % 2 === 0 ? 'a' : 'b';
    const suivant = async () =>
      (await lire()).find((s) => s.tour === m.tour + 1 && s.rang === m.rang >> 1)!;

    expect((await resultat(m.id, 0)).erreur).toBeNull();
    expect((await suivant())[place]).toEqual(m.a);
    expect((await resultat(m.id, 1)).erreur).toBeNull();
    expect((await suivant())[place]).toEqual(m.b);
    expect((await resultat(m.id, null)).erreur).toBeNull();
    expect((await suivant())[place]).toBeNull();
    expect((await lire()).find((x) => x.id === m.id)!.gagnant).toBeNull();
  });

  it('un résultat ne change pas la version du pilotage', async () => {
    await remettre();
    await poser(joueurs);
    const { sequence } = await ouvrir();
    const avant = await version();
    await resultat(sequence.matchs[0]!.id, 0);
    expect(await version()).toBe(avant);
  });

  it('refuse un résultat sur un match pas appelé ou un exempté', async () => {
    await remettre();
    await poser(joueurs);
    const pasAppele = (await lire())[0]!;
    expect((await resultat(pasAppele.id, 0)).erreur).toMatch(/non appelé/);

    await remettre();
    await poser(
      [0, 1, 2, 3, 4].map((i) => joueurs[i]!),
      'cinq',
    );
    const exempte = (await lire()).find((m) => m.tour === 1 && !m.b)!;
    expect((await resultat(exempte.id, 0)).erreur).toMatch(/non appelé/);
  });

  it('n’ouvre pas la suite tant qu’un résultat manque, puis ferme la séquence jouée', async () => {
    await remettre();
    await poser(joueurs);
    const { sequence } = await ouvrir();
    const suite = await lire();
    const restants = suite.filter((m) => m.tour === 1 && m.sequence === null).map((m) => m.id);
    const client = await anna();
    const tente = () =>
      version().then((v) =>
        appeler(client, 'ouvrir_sequence', {
          p_manche: manche,
          p_version: v,
          p_numero: sequence.numero + 1,
          p_matchs: restants,
          p_gobelets: 4,
          p_pilotage: pilotage('appel'),
        }),
      );
    expect((await tente()).erreur).toMatch(/résultats manquants/);

    for (const m of sequence.matchs) await resultat(m.id, 0);
    // Un numéro déjà pris : le double appui.
    expect(
      (
        await appeler(client, 'ouvrir_sequence', {
          p_manche: manche,
          p_version: await version(),
          p_numero: sequence.numero,
          p_matchs: restants,
          p_gobelets: 4,
          p_pilotage: pilotage('appel'),
        })
      ).erreur,
    ).toMatch(/périmé/);
    // Plus de matchs que de gobelets.
    expect(
      (
        await appeler(client, 'ouvrir_sequence', {
          p_manche: manche,
          p_version: await version(),
          p_numero: sequence.numero + 1,
          p_matchs: restants,
          p_gobelets: 2,
          p_pilotage: pilotage('appel'),
        })
      ).erreur,
    ).not.toBeNull();

    expect((await ouvrir()).erreur).toBeNull();
    expect((await resultat(sequence.matchs[0]!.id, 1)).erreur).toMatch(/séquence close/);
    // Le tableau joué ne se retire plus.
    expect((await poser(joueurs, 'autre')).erreur).toMatch(/déjà joué/);
  });

  it('refuse un résultat quand l’étape n’attend pas de résultat', async () => {
    await remettre();
    await poser(joueurs);
    const { sequence } = await ouvrir();
    await clientService()
      .from('pilotage')
      .update({ etape: 'appel' })
      .eq('evenement_id', evenement.id);
    expect((await resultat(sequence.matchs[0]!.id, 0)).erreur).toMatch(/fermée/);
  });

  it('un téléphone reçoit son match et son adversaire, rien d’autre du tableau', async () => {
    await remettre();
    await poser(joueurs);
    const { sequence } = await ouvrir();
    const m = sequence.matchs[1]!;
    const lecture = async (prenom: string) => {
      const { data } = await appeler<{ tournoi: Record<string, unknown> }>(
        clientService(),
        'etat_joueur',
        { p_jeton_hash: hacher(jeton(prenom)) },
      );
      return data!.tournoi;
    };

    const moi = await lecture(m.a!.prenom);
    expect(moi).toMatchObject({
      etape: 'jeu',
      tire: true,
      tours: 4,
      sequence: 1,
      exempte: false,
      match: {
        tour: 1,
        poste: 2,
        sequence: 1,
        gagne: null,
        adversaire: { prenom: m.b!.prenom, equipe: m.b!.equipe },
      },
    });
    const texte = JSON.stringify(moi);
    for (const j of joueurs) {
      if (j.prenom !== m.b!.prenom) expect(texte).not.toContain(j.prenom);
    }

    await resultat(m.id, 1);
    expect(await lecture(m.a!.prenom)).toMatchObject({ match: { tour: 1, gagne: false } });
    const gagnant = await lecture(m.b!.prenom);
    expect(gagnant).toMatchObject({ match: { tour: 2, sequence: null, gagne: null } });
  });

  it('hors du jeu, un téléphone ne reçoit rien du tournoi', async () => {
    await clientService()
      .from('pilotage')
      .update({ scene: 'scores' })
      .eq('evenement_id', evenement.id);
    const { data } = await appeler<{ tournoi: unknown }>(clientService(), 'etat_joueur', {
      p_jeton_hash: hacher(jeton(joueurs[0]!.prenom)),
    });
    expect(data!.tournoi).toBeNull();
  });

  it('l’écran lit la séquence en cours, le compte et la fin du tableau', async () => {
    await remettre();
    await poser(joueurs);
    const { sequence } = await ouvrir();
    await resultat(sequence.matchs[0]!.id, 0);
    const { data } = await appeler<{
      tournoi: {
        joueurs: number;
        gobelets: number;
        tours: number;
        tour: number;
        sequence: number;
        reste: boolean;
        en_lice: number;
        matchs: { poste: number; gagnant: number | null }[];
        tableau: { tour: number }[];
      };
    }>(await anna(), 'etat_ecran', { p_code: evenement.code, p_regie: false });
    expect(data!.tournoi).toMatchObject({
      joueurs: 16,
      gobelets: 4,
      tours: 4,
      tour: 1,
      sequence: 1,
      reste: true,
      en_lice: 15,
    });
    expect(data!.tournoi.matchs.map((m) => m.poste)).toEqual([1, 2, 3, 4]);
    expect(data!.tournoi.matchs[0]!.gagnant).toBe(0);
    expect(data!.tournoi.tableau.map((m) => m.tour)).toEqual([2, 2, 2, 2, 3, 3, 4]);
  });

  it('se joue jusqu’à la finale, sans jamais dépasser les gobelets', async () => {
    await remettre();
    await poser(joueurs);
    const tailles: number[] = [];
    for (;;) {
      const matchs = await lire();
      if (!prochaineSequence(matchs, 4)) break;
      const { erreur, sequence } = await ouvrir();
      expect(erreur).toBeNull();
      tailles.push(sequence.matchs.length);
      for (const m of sequence.matchs) expect((await resultat(m.id, 1)).erreur).toBeNull();
    }
    expect(tailles).toEqual([4, 4, 4, 1, 1, 1]);
    const fin = await lire();
    expect(fin.every((m) => m.gagnant !== null)).toBe(true);
    const points = pointsTournoi(fin)!;
    expect(Object.values(points).reduce((a, b) => a + b, 0)).toBe(220);
  });

  it('relancer le jeu retire le tableau et les joueurs comptés', async () => {
    await remettre();
    await poser(joueurs);
    await ouvrir();
    const { erreur } = await appeler(await anna(), 'recommencer_manche', {
      p_manche: manche,
      p_motif: 'Tournoi relancé',
    });
    expect(erreur).toBeNull();
    expect(await lire()).toHaveLength(0);
    const { data } = await clientService()
      .from('manches')
      .select('options, statut')
      .eq('id', manche)
      .single();
    const relue = data as { options: Record<string, unknown>; statut: string };
    expect(relue.statut).toBe('a_venir');
    expect(relue.options['format']).toBe('tournoi');
    expect(relue.options['gobelets']).toBe(4);
    expect(relue.options['joueurs']).toBeUndefined();
    await clientService().from('manches').update({ statut: 'en_cours' }).eq('id', manche);
    await clientService().from('passages').update({ statut: 'en_cours' }).eq('id', passage);
  });

  it('retirer un joueur garde son prénom au tableau', async () => {
    await remettre();
    await poser(joueurs);
    const avant = (await lire())[0]!;
    await clientService().from('joueurs').delete().eq('id', avant.a!.joueur_id);
    const apres = (await lire())[0]!;
    expect(apres.a).toEqual({ ...avant.a, joueur_id: '' });
  });
});
