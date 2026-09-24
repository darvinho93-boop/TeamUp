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

// Contenus de la démo : bonne réponse 1 (« 8 pattes ») puis 2 (« Mercure ») ; mot « parapluie ».
const QUESTION_1 = 'aaaa0301-0000-4000-8000-000000000301';
const QUESTION_2 = 'aaaa0302-0000-4000-8000-000000000302';
const MOT = 'aaaa0401-0000-4000-8000-000000000401';

interface Passage {
  id: string;
  secret: Record<string, Record<string, unknown>> | null;
  reponses: number | null;
}
interface Etat {
  pilotage: { version: string };
  programme: { id: string; survivants: Record<string, number> | null; passages: Passage[] }[];
}
interface Quiz {
  etape: string;
  question: { question: string; propositions: string[] } | null;
  ma_reponse: number | null;
  bonne: number | null;
  participant: boolean;
  elimine: boolean;
}

let evenement: { id: string; code: string };
let mancheQuiz: string;
let mancheMime: string;
let q1: string;
let q2: string;
let passageMime: string;
const jeton = (nom: string) => `quiz-${evenement.id}-${nom}`;

async function ajouterJoueur(nom: string, equipe: number, langue = 'fr') {
  const service = clientService();
  const { data: eq } = await service
    .from('equipes')
    .select('id')
    .eq('evenement_id', evenement.id)
    .eq('numero', equipe)
    .single();
  const { error } = await service.from('joueurs').insert({
    evenement_id: evenement.id,
    equipe_id: eq!['id'],
    prenom: nom,
    langue,
    jeton_hash: hacher(jeton(nom)),
  });
  if (error) throw new Error(error.message);
}

beforeAll(async () => {
  if (!baseDisponible) return;
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr', 'en'] });
  const service = clientService();
  const { data: manches } = await service
    .from('manches')
    .insert([
      { evenement_id: evenement.id, jeu: 'qcm2', ordre: 1, options: { questions: 3 } },
      { evenement_id: evenement.id, jeu: 'mime2', ordre: 2, options: {} },
    ])
    .select('id, jeu');
  mancheQuiz = manches!.find((m) => m['jeu'] === 'qcm2')!['id'] as string;
  mancheMime = manches!.find((m) => m['jeu'] === 'mime2')!['id'] as string;
  const { data: equipe } = await service
    .from('equipes')
    .select('id')
    .eq('evenement_id', evenement.id)
    .eq('numero', 1)
    .single();
  const { data: passages, error } = await service
    .from('passages')
    .insert([
      { manche_id: mancheQuiz, evenement_id: evenement.id, ordre: 1, contenu_id: QUESTION_1 },
      { manche_id: mancheQuiz, evenement_id: evenement.id, ordre: 2, contenu_id: QUESTION_2 },
      {
        manche_id: mancheMime,
        evenement_id: evenement.id,
        equipe_id: equipe!['id'],
        ordre: 1,
        contenu_id: MOT,
      },
    ])
    .select('id, contenu_id');
  if (error) throw new Error(error.message);
  const par = (contenu: string) =>
    passages.find((p) => p['contenu_id'] === contenu)!['id'] as string;
  q1 = par(QUESTION_1);
  q2 = par(QUESTION_2);
  passageMime = par(MOT);

  // Alice et Bruno dans l'équipe 1, Chloé dans l'équipe 2 (en anglais).
  await ajouterJoueur('Alice', 1);
  await ajouterJoueur('Bruno', 1);
  await ajouterJoueur('Chloe', 2, 'en');
});

afterAll(() => (baseDisponible ? supprimerEvenements([evenement.id]) : undefined));

async function etat(regie = false) {
  const client = await clientAnimateur('anna@teamup.test');
  const { data } = await appeler<Etat>(client, 'etat_ecran', {
    p_code: evenement.code,
    p_regie: regie,
  });
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

const question = (passage: string, chrono = 'demarrer') =>
  piloter(
    {
      scene: 'jeu',
      manche_id: mancheQuiz,
      passage_id: passage,
      etape: 'question',
      chrono,
      chrono_duree_s: 30,
    },
    { p_passage: { id: passage, statut: 'en_cours' } },
  );

const reveler = (passage: string, resultat: object = {}) =>
  piloter(
    {
      scene: 'jeu',
      manche_id: mancheQuiz,
      passage_id: passage,
      etape: 'reponse',
      chrono: 'arreter',
    },
    { p_passage: { id: passage, statut: 'termine', resultat } },
  );

const repondre = (nom: string, choix: number) =>
  appeler(clientService(), 'repondre_quiz', { p_jeton_hash: hacher(jeton(nom)), p_choix: choix });

async function quizDe(nom: string) {
  const { data } = await appeler<{ quiz: Quiz | null }>(clientService(), 'etat_joueur', {
    p_jeton_hash: hacher(jeton(nom)),
  });
  return data!.quiz;
}

const passageDe = (e: Etat, id: string) =>
  e.programme.flatMap((m) => m.passages).find((p) => p.id === id)!;

avecBase('le quiz en mode croix', () => {
  it('ne donne rien aux téléphones et refuse toute réponse', async () => {
    await piloter(
      { scene: 'intro', manche_id: mancheQuiz },
      { p_manche: { id: mancheQuiz, statut: 'en_cours', options: { mode: 'croix' } } },
    );
    await question(q1);
    expect(await quizDe('Alice')).toBeNull();
    expect((await repondre('Alice', 1)).erreur).toMatch(/fermée/);
  });
});

avecBase('le quiz en mode téléphone', () => {
  it('fixe le mode au lancement, sans perdre les options de la préparation', async () => {
    await piloter(
      { scene: 'intro', manche_id: mancheQuiz },
      { p_manche: { id: mancheQuiz, statut: 'en_cours', options: { mode: 'telephone' } } },
    );
    const { data } = await clientService()
      .from('manches')
      .select('options')
      .eq('id', mancheQuiz)
      .single();
    expect(data!['options']).toEqual({ questions: 3, mode: 'telephone' });
  });

  it('montre la question dans la langue du joueur, jamais la bonne réponse avant la révélation', async () => {
    await question(q1);
    const alice = await quizDe('Alice');
    expect(alice).toMatchObject({
      etape: 'question',
      question: { question: 'Combien de pattes a une araignée ?' },
      bonne: null,
      participant: true,
      elimine: false,
    });
    expect((await quizDe('Chloe'))?.question?.question).toBe('How many legs does a spider have?');
    expect(passageDe(await etat(), q1).secret).toBeNull();
  });

  it('accepte une seule réponse par joueur et par question', async () => {
    expect((await repondre('Alice', 1)).erreur).toBeNull();
    expect((await repondre('Bruno', 0)).erreur).toBeNull();
    expect((await repondre('Alice', 2)).erreur).toMatch(/déjà/);
    expect((await quizDe('Alice'))?.ma_reponse).toBe(1);
    expect(passageDe(await etat(), q1).reponses).toBe(2);
  });

  it('refuse sans rôle de service, et pour un joueur d’un autre événement', async () => {
    const { erreur } = await appeler(clientAnon(), 'repondre_quiz', {
      p_jeton_hash: hacher(jeton('Alice')),
      p_choix: 1,
    });
    expect(erreur).toBeTruthy();
    const autre = await appeler(clientService(), 'repondre_quiz', {
      p_jeton_hash: hacher('demo-autre-evenement'),
      p_choix: 1,
    });
    expect(autre.erreur).toMatch(/fermée/);
  });

  it('à la révélation : bonne réponse visible, mauvaises réponses et silences éliminés', async () => {
    await reveler(q1);
    expect(await quizDe('Alice')).toMatchObject({ bonne: 1, elimine: false });
    expect(await quizDe('Bruno')).toMatchObject({ bonne: 1, elimine: true });
    expect(await quizDe('Chloe')).toMatchObject({ elimine: true });
    const ecran = await etat();
    expect(passageDe(ecran, q1).secret).toEqual({ fr: { bonne: 1 }, en: { bonne: 1 } });
    expect(ecran.programme.find((m) => m.id === mancheQuiz)?.survivants).toEqual({ 1: 1, 2: 0 });
    expect((await repondre('Alice', 1)).erreur).toMatch(/fermée/);
  });

  it('refuse un éliminé et un joueur arrivé après la première question', async () => {
    await ajouterJoueur('Damien', 2);
    await question(q2);
    expect((await repondre('Bruno', 2)).erreur).toMatch(/éliminé/);
    expect((await repondre('Damien', 2)).erreur).toMatch(/spectateur/);
    expect(await quizDe('Damien')).toMatchObject({ participant: false });
  });

  it('refuse une réponse une fois le chrono écoulé, à l’heure de la base', async () => {
    const service = clientService();
    await service
      .from('pilotage')
      .update({ chrono_depart: new Date(Date.now() - 32_000).toISOString() })
      .eq('evenement_id', evenement.id);
    expect((await repondre('Alice', 2)).erreur).toMatch(/fermée/);
  });

  it('une question annulée n’élimine personne', async () => {
    await question(q2);
    await reveler(q2, { annulee: true });
    expect(await quizDe('Alice')).toMatchObject({ elimine: false });
    expect(passageDe(await etat(), q2).secret).toBeNull();
    expect((await etat()).programme.find((m) => m.id === mancheQuiz)?.survivants).toEqual({
      1: 1,
      2: 0,
    });
  });
});

avecBase('le mime', () => {
  const mime = (etape: string, statut: 'en_cours' | 'termine') =>
    piloter(
      { scene: 'jeu', manche_id: mancheMime, passage_id: passageMime, etape },
      { p_passage: { id: passageMime, statut } },
    );

  it('le mot reste à la régie tant que la chaîne tourne', async () => {
    for (const etape of ['pret', 'secret', 'lance']) {
      await mime(etape, 'en_cours');
      expect(passageDe(await etat(), passageMime).secret).toBeNull();
      expect(passageDe(await etat(true), passageMime).secret?.['fr']).toEqual({ mot: 'parapluie' });
    }
  });

  it('ne sort vers aucun téléphone', async () => {
    const { data } = await appeler(clientService(), 'etat_joueur', {
      p_jeton_hash: hacher(jeton('Alice')),
    });
    expect(JSON.stringify(data)).not.toContain('parapluie');
  });

  it('la salle le découvre au verdict', async () => {
    await mime('trouve', 'termine');
    expect(passageDe(await etat(), passageMime).secret).toEqual({
      fr: { mot: 'parapluie' },
      en: { mot: 'umbrella' },
    });
  });
});
