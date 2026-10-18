import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

const avecBase = describe.skipIf(!baseDisponible);

// Contenus de la démo : bonnes réponses 1 (« 8 pattes »), 2 (« Mercure »), 0 (« 90 »).
const QUESTION_1 = 'aaaa0301-0000-4000-8000-000000000301';
const QUESTION_2 = 'aaaa0302-0000-4000-8000-000000000302';
const QUESTION_3 = 'aaaa0303-0000-4000-8000-000000000303';

interface Mise {
  repartition: number[];
  valide: boolean;
  debloquee: boolean;
}
interface Etat {
  pilotage: { version: string };
  programme: {
    id: string;
    jetons: Record<string, { depart: number; restants: number }> | null;
    passages: { id: string; mises: Record<string, Mise> | null }[];
  }[];
}
interface QuizJetons {
  mode: string;
  etape: string;
  question: { question: string; propositions: string[] } | null;
  capitaine: boolean;
  jetons: number;
  repartition: number[];
  valide: boolean;
  fige: boolean;
  bonne: number | null;
}

let evenement: { id: string; code: string };
let manche: string;
let q1: string;
let q2: string;
let q3: string;
const equipes: Record<number, string> = {};
const jeton = (nom: string) => `jetons-${evenement.id}-${nom}`;

async function ajouterJoueur(nom: string, equipe: number, capitaine = false, langue = 'fr') {
  const { error } = await clientService()
    .from('joueurs')
    .insert({
      evenement_id: evenement.id,
      equipe_id: equipes[equipe],
      prenom: nom,
      langue,
      capitaine,
      jeton_hash: hacher(jeton(nom)),
    });
  if (error) throw new Error(error.message);
}

beforeAll(async () => {
  if (!baseDisponible) return;
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr', 'en'] });
  const service = clientService();
  const { data: eqs } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id);
  for (const eq of eqs!) equipes[eq['numero'] as number] = eq['id'] as string;

  const { data: m } = await service
    .from('manches')
    .insert({ evenement_id: evenement.id, jeu: 'qcm2', ordre: 1, options: { questions: 3 } })
    .select('id')
    .single();
  manche = m!['id'] as string;
  const { data: passages, error } = await service
    .from('passages')
    .insert(
      [QUESTION_1, QUESTION_2, QUESTION_3].map((contenu, i) => ({
        manche_id: manche,
        evenement_id: evenement.id,
        ordre: i + 1,
        contenu_id: contenu,
      })),
    )
    .select('id, contenu_id');
  if (error) throw new Error(error.message);
  const par = (contenu: string) =>
    passages.find((p) => p['contenu_id'] === contenu)!['id'] as string;
  q1 = par(QUESTION_1);
  q2 = par(QUESTION_2);
  q3 = par(QUESTION_3);

  // Alice, capitaine, et Bruno dans l'équipe 1 ; Chloé, capitaine (en anglais), dans la 2.
  await ajouterJoueur('Alice', 1, true);
  await ajouterJoueur('Bruno', 1);
  await ajouterJoueur('Chloe', 2, true, 'en');
});

afterAll(() => (baseDisponible ? supprimerEvenements([evenement.id]) : undefined));

async function etat() {
  const client = await clientAnimateur('anna@teamup.test');
  const { data } = await appeler<Etat>(client, 'etat_ecran', { p_code: evenement.code });
  return data!;
}

async function piloter(pilotage: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const { pilotage: p } = await etat();
  const client = await clientAnimateur('anna@teamup.test');
  const { erreur } = await appeler<string>(client, 'enregistrer_etape', {
    p_evenement: evenement.id,
    p_version: p.version,
    p_pilotage: pilotage,
    ...extra,
  });
  expect(erreur).toBeNull();
}

const question = (passage: string) =>
  piloter(
    {
      scene: 'jeu',
      manche_id: manche,
      passage_id: passage,
      etape: 'question',
      chrono: 'demarrer',
      chrono_duree_s: 30,
    },
    { p_passage: { id: passage, statut: 'en_cours' } },
  );

const reveler = (passage: string, resultat: object = {}) =>
  piloter(
    { scene: 'jeu', manche_id: manche, passage_id: passage, etape: 'reponse', chrono: 'arreter' },
    { p_passage: { id: passage, statut: 'termine', resultat } },
  );

const miser = (nom: string, repartition: number[], valider = false) =>
  appeler<{ repartition: number[]; valide: boolean; dispo: number }>(
    clientService(),
    'miser_quiz',
    { p_jeton_hash: hacher(jeton(nom)), p_repartition: repartition, p_valider: valider },
  );

async function quizDe(nom: string) {
  const { data } = await appeler<{ quiz: QuizJetons | null }>(clientService(), 'etat_joueur', {
    p_jeton_hash: hacher(jeton(nom)),
  });
  return data!.quiz;
}

const ecouler = () =>
  clientService()
    .from('pilotage')
    .update({ chrono_depart: new Date(Date.now() - 32_000).toISOString() })
    .eq('evenement_id', evenement.id);

const mancheDe = (e: Etat) => e.programme.find((m) => m.id === manche)!;
const misesDe = (e: Etat, passage: string) =>
  mancheDe(e).passages.find((p) => p.id === passage)!.mises;

avecBase('le quiz en mode jetons : lancement', () => {
  it('refuse toute mise tant que la manche n’est pas en mode jetons', async () => {
    await piloter(
      { scene: 'intro', manche_id: manche },
      { p_manche: { id: manche, statut: 'en_cours', options: { mode: 'croix' } } },
    );
    await question(q1);
    expect((await miser('Alice', [5, 0, 0, 0], true)).erreur).toMatch(/fermée/);
  });

  it('fixe le mode et les jetons au lancement, sans perdre les options de la préparation', async () => {
    await piloter(
      { scene: 'intro', manche_id: manche },
      { p_manche: { id: manche, statut: 'en_cours', options: { mode: 'jetons', jetons: 5 } } },
    );
    const { data } = await clientService()
      .from('manches')
      .select('options')
      .eq('id', manche)
      .single();
    expect(data!['options']).toEqual({ questions: 3, mode: 'jetons', jetons: 5 });
    expect(mancheDe(await etat()).jetons).toEqual({
      1: { depart: 5, restants: 5 },
      2: { depart: 5, restants: 5 },
    });
  });

  it('ne donne rien au téléphone hors de la scène de jeu', async () => {
    expect(await quizDe('Alice')).toBeNull();
    expect((await miser('Alice', [5, 0, 0, 0])).erreur).toMatch(/fermée/);
  });
});

avecBase('le quiz en mode jetons : une question', () => {
  it('montre la question et les jetons à poser, sans la bonne réponse', async () => {
    await question(q1);
    expect(await quizDe('Alice')).toMatchObject({
      mode: 'jetons',
      etape: 'question',
      question: { question: 'Combien de pattes a une araignée ?' },
      capitaine: true,
      jetons: 5,
      repartition: [0, 0, 0, 0],
      valide: false,
      fige: false,
      bonne: null,
    });
    expect(await quizDe('Chloe')).toMatchObject({
      question: { question: 'How many legs does a spider have?' },
      capitaine: true,
    });
    expect(await quizDe('Bruno')).toMatchObject({ capitaine: false, jetons: 5 });
  });

  it('refuse la mise d’un coéquipier, d’un inconnu, ou d’un client sans droit', async () => {
    expect((await miser('Bruno', [5, 0, 0, 0])).erreur).toMatch(/pas capitaine/);
    expect((await miser('Personne', [5, 0, 0, 0])).erreur).toMatch(/session inconnue/);
    const { erreur } = await appeler(clientAnon(), 'miser_quiz', {
      p_jeton_hash: hacher(jeton('Alice')),
      p_repartition: [5, 0, 0, 0],
      p_valider: true,
    });
    expect(erreur).not.toBeNull();
  });

  it('refuse une mise invalide : trop de jetons, un négatif, une réponse de moins', async () => {
    expect((await miser('Alice', [6, 0, 0, 0])).erreur).toMatch(/invalide/);
    expect((await miser('Alice', [-1, 6, 0, 0])).erreur).toMatch(/invalide/);
    expect((await miser('Alice', [5, 0, 0])).erreur).toMatch(/invalide/);
    // Valider demande tous les jetons posés.
    expect((await miser('Alice', [2, 0, 0, 0], true)).erreur).toMatch(/invalide/);
  });

  it('enregistre la mise en direct, visible des coéquipiers et de l’écran', async () => {
    expect((await miser('Alice', [1, 3, 0, 0])).erreur).toBeNull();
    expect(await quizDe('Bruno')).toMatchObject({ repartition: [1, 3, 0, 0], valide: false });
    expect(misesDe(await etat(), q1)).toEqual({
      1: { repartition: [1, 3, 0, 0], valide: false, debloquee: false },
    });
  });

  it('valide une mise complète, puis la fige', async () => {
    expect((await miser('Alice', [1, 3, 0, 1], true)).erreur).toBeNull();
    expect(await quizDe('Alice')).toMatchObject({ repartition: [1, 3, 0, 1], valide: true });
    expect((await miser('Alice', [0, 5, 0, 0], true)).erreur).toMatch(/déjà validée/);
  });

  it('fige une équipe au chrono écoulé, et la régie seule la débloque', async () => {
    await ecouler();
    expect((await miser('Chloe', [0, 0, 5, 0], true)).erreur).toMatch(/temps écoulé/);
    expect(await quizDe('Chloe')).toMatchObject({ fige: true });
    // Une équipe déjà validée n'est pas figée.
    expect(await quizDe('Alice')).toMatchObject({ fige: false });

    const brahim = await clientAnimateur('brahim@teamup.test');
    expect(
      (await appeler(brahim, 'debloquer_mise', { p_passage: q1, p_equipe: equipes[2] })).erreur,
    ).not.toBeNull();
    const anna = await clientAnimateur('anna@teamup.test');
    expect(
      (await appeler(anna, 'debloquer_mise', { p_passage: q1, p_equipe: equipes[2] })).erreur,
    ).toBeNull();

    expect(await quizDe('Chloe')).toMatchObject({ fige: false });
    expect((await miser('Chloe', [0, 0, 5, 0], true)).erreur).toBeNull();
    expect(misesDe(await etat(), q1)?.['2']).toEqual({
      repartition: [0, 0, 5, 0],
      valide: true,
      debloquee: true,
    });
  });

  it('aucune écriture directe : la table ne s’écrit que par les fonctions', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const { error } = await anna.from('mises_quiz').insert({
      passage_id: q1,
      evenement_id: evenement.id,
      equipe_id: equipes[2],
      repartition: [5, 0, 0, 0],
      valide: true,
    });
    expect(error).not.toBeNull();
    // L'écran et la régie lisent sous la session de l'animateur ; un visiteur, jamais.
    const { data } = await clientAnon().from('mises_quiz').select('*');
    expect(data ?? []).toHaveLength(0);
  });

  it('à la révélation, l’équipe garde les jetons posés sur la bonne réponse', async () => {
    await reveler(q1);
    expect(await quizDe('Alice')).toMatchObject({ etape: 'reponse', bonne: 1, jetons: 3 });
    expect(await quizDe('Chloe')).toMatchObject({ bonne: 1, jetons: 0 });
    expect(mancheDe(await etat()).jetons).toEqual({
      1: { depart: 5, restants: 3 },
      2: { depart: 5, restants: 0 },
    });
  });
});

avecBase('le quiz en mode jetons : la suite de la manche', () => {
  it('une question annulée ne coûte aucun jeton', async () => {
    await question(q2);
    expect((await miser('Alice', [3, 0, 0, 0], true)).erreur).toBeNull();
    await reveler(q2, { annulee: true });
    expect(mancheDe(await etat()).jetons?.['1']).toEqual({ depart: 5, restants: 3 });
  });

  it('une équipe sans jeton n’est jamais figée et n’a rien à poser', async () => {
    await question(q3);
    await ecouler();
    expect(await quizDe('Chloe')).toMatchObject({ jetons: 0, fige: false });
  });

  it('révélée sans validation, l’équipe perd ses jetons non posés', async () => {
    // Le chrono est écoulé : Alice est figée, sa mise partielle reste.
    const anna = await clientAnimateur('anna@teamup.test');
    await appeler(anna, 'debloquer_mise', { p_passage: q3, p_equipe: equipes[1] });
    expect((await miser('Alice', [2, 0, 0, 0])).erreur).toBeNull();
    await reveler(q3);
    expect(mancheDe(await etat()).jetons).toEqual({
      1: { depart: 5, restants: 2 },
      2: { depart: 5, restants: 0 },
    });
    expect((await miser('Alice', [2, 0, 0, 0], true)).erreur).toMatch(/fermée/);
  });
});
