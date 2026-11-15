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

/**
 * Relancer un jeu depuis le début (2026-11-15). Le 2026-11-14, un quiz aux jetons s'est fini sans
 * que ses points soient écrits, et rien ne permettait de le rejouer.
 */
const avecBase = describe.skipIf(!baseDisponible);

const QUESTION_1 = 'aaaa0301-0000-4000-8000-000000000301';
const QUESTION_2 = 'aaaa0302-0000-4000-8000-000000000302';
const MOTIF = 'Quiz relancé : points remis à zéro';

let evenement: { id: string; code: string };
let quiz: string;
let surenchere: string;
let theme: string;
const questions: string[] = [];
const equipes: Record<number, string> = {};

const relancer = async (email: string, manche: string, motif = MOTIF) =>
  appeler<string>(await clientAnimateur(email), 'recommencer_manche', {
    p_manche: manche,
    p_motif: motif,
  });

/** Un quiz joué en entier aux jetons, validé et terminé, avec ses points. */
async function jouerLeQuiz() {
  const service = clientService();
  const maintenant = new Date().toISOString();
  const ecritures = await Promise.all([
    service
      .from('manches')
      .update({
        statut: 'terminee',
        commence_le: maintenant,
        termine_le: maintenant,
        options: {
          questions: 2,
          chrono_s: 120,
          ordre_tire: true,
          mode: 'jetons',
          jetons: 3,
          fin: true,
          survivants: { 1: 2, 2: 1 },
        },
      })
      .eq('id', quiz),
    service
      .from('passages')
      .update({
        statut: 'termine',
        resultat: { annulee: false },
        points: 0,
        commence_le: maintenant,
        termine_le: maintenant,
      })
      .eq('manche_id', quiz),
    service.from('mises_quiz').insert(
      questions.flatMap((passage_id) =>
        [1, 2].map((numero) => ({
          passage_id,
          evenement_id: evenement.id,
          equipe_id: equipes[numero],
          repartition: [0, 2, 0, 0],
          valide: true,
        })),
      ),
    ),
    service.from('scores').insert([
      {
        evenement_id: evenement.id,
        equipe_id: equipes[1],
        manche_id: quiz,
        points: 200,
        motif: 'Quiz – 2 jetons',
      },
      {
        evenement_id: evenement.id,
        equipe_id: equipes[2],
        manche_id: quiz,
        points: 100,
        motif: 'Quiz – 1 jeton',
      },
    ]),
  ]);
  for (const { error } of ecritures) expect(error).toBeNull();
}

const points = async () => {
  const { data } = await clientService()
    .from('classement')
    .select('numero, points')
    .eq('evenement_id', evenement.id)
    .order('numero');
  return (data ?? []).map((l) => l['points'] as number);
};

beforeAll(async () => {
  if (!baseDisponible) return;
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
  const service = clientService();
  const { data: eqs } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id);
  for (const eq of eqs!) equipes[eq['numero'] as number] = eq['id'] as string;

  const { data: manches, error } = await service
    .from('manches')
    .insert([
      { evenement_id: evenement.id, jeu: 'qcm2', ordre: 1, options: { questions: 2 } },
      { evenement_id: evenement.id, jeu: 'enchere2', ordre: 2, options: { themes: 1 } },
    ])
    .select('id, jeu');
  if (error) throw new Error(error.message);
  quiz = manches.find((m) => m['jeu'] === 'qcm2')!['id'] as string;
  surenchere = manches.find((m) => m['jeu'] === 'enchere2')!['id'] as string;

  const { data: passages, error: refus } = await service
    .from('passages')
    .insert([
      { manche_id: quiz, evenement_id: evenement.id, ordre: 1, contenu_id: QUESTION_1 },
      { manche_id: quiz, evenement_id: evenement.id, ordre: 2, contenu_id: QUESTION_2 },
      { manche_id: surenchere, evenement_id: evenement.id, ordre: 1 },
    ])
    .select('id, manche_id, ordre');
  if (refus) throw new Error(refus.message);
  for (const p of [...passages].sort((a, b) => (a['ordre'] as number) - (b['ordre'] as number))) {
    if (p['manche_id'] === quiz) questions.push(p['id'] as string);
    else theme = p['id'] as string;
  }

  const { data: joueur, error: e } = await service
    .from('joueurs')
    .insert({
      evenement_id: evenement.id,
      equipe_id: equipes[1],
      prenom: 'Alice',
      langue: 'fr',
      capitaine: true,
      jeton_hash: hacher(`relance-${evenement.id}-alice`),
    })
    .select('id')
    .single();
  if (e) throw new Error(e.message);

  // Hors du quiz : une correction à la main, un mot de la Surenchère, une réponse au téléphone.
  const ecritures = await Promise.all([
    service.from('scores').insert({
      evenement_id: evenement.id,
      equipe_id: equipes[1],
      points: 50,
      motif: 'Bonus',
    }),
    service.from('mots_surenchere').insert({
      passage_id: theme,
      evenement_id: evenement.id,
      equipe_id: equipes[1],
      mot: 'Paris',
      cle: 'paris',
    }),
    service.from('reponses_quiz').insert({
      passage_id: questions[0],
      evenement_id: evenement.id,
      joueur_id: joueur['id'],
      choix: 1,
    }),
  ]);
  for (const { error: err } of ecritures) expect(err).toBeNull();
  await jouerLeQuiz();
});

afterAll(() => (baseDisponible ? supprimerEvenements([evenement.id]) : undefined));

avecBase('relancer un jeu depuis le début', () => {
  it('n’est ouvert qu’à l’animateur de la soirée', async () => {
    expect(await points()).toEqual([250, 100]);
    const { erreur: anon } = await appeler(clientAnon(), 'recommencer_manche', {
      p_manche: quiz,
      p_motif: MOTIF,
    });
    expect(anon).not.toBeNull();
    expect((await relancer('brahim@teamup.test', quiz)).erreur).toMatch(/manche inconnue/);
    expect((await relancer('anna@teamup.test', quiz, '')).erreur).toMatch(/motif invalide/);
    expect(await points()).toEqual([250, 100]);
  });

  it('remet le jeu à zéro et ramène la salle à sa présentation', async () => {
    const { data: version, erreur } = await relancer('anna@teamup.test', quiz);
    expect(erreur).toBeNull();
    const service = clientService();

    const { data: pilotage } = await service
      .from('pilotage')
      .select('scene, manche_id, passage_id, etape, indices, chrono_depart, maj_le')
      .eq('evenement_id', evenement.id)
      .single();
    expect(pilotage).toMatchObject({
      scene: 'intro',
      manche_id: quiz,
      passage_id: null,
      etape: null,
      indices: 0,
      chrono_depart: null,
    });
    // La version rendue est celle du pilotage : la régie qui relance n'est pas « périmée ».
    expect(new Date(pilotage!['maj_le'] as string).getTime()).toBe(new Date(version!).getTime());

    const { data: manche } = await service
      .from('manches')
      .select('statut, options, commence_le, termine_le')
      .eq('id', quiz)
      .single();
    // Le mode se rechoisit ; les réglages de la préparation et l'ordre tiré restent.
    expect(manche).toEqual({
      statut: 'a_venir',
      options: { questions: 2, chrono_s: 120, ordre_tire: true },
      commence_le: null,
      termine_le: null,
    });

    const { data: passages } = await service
      .from('passages')
      .select('statut, resultat, points, commence_le, termine_le, contenu_id')
      .eq('manche_id', quiz)
      .order('ordre');
    expect(passages).toEqual(
      [QUESTION_1, QUESTION_2].map((contenu_id) => ({
        statut: 'a_venir',
        resultat: {},
        points: null,
        commence_le: null,
        termine_le: null,
        contenu_id,
      })),
    );

    for (const table of ['mises_quiz', 'reponses_quiz'] as const) {
      const { count } = await service
        .from(table)
        .select('*', { count: 'exact', head: true })
        .in('passage_id', questions);
      expect(count).toBe(0);
    }
  });

  it('annule les points du jeu par une ligne contraire, sans rien effacer du journal', async () => {
    const { data: journal } = await clientService()
      .from('scores')
      .select('equipe_id, points, motif, manche_id, saisi_par')
      .eq('evenement_id', evenement.id)
      .order('cree_le');
    expect(journal).toHaveLength(5);
    const annulations = journal!.filter((l) => l['motif'] === MOTIF);
    expect(annulations.map((l) => [l['equipe_id'], l['points'], l['manche_id']]).sort()).toEqual(
      [
        [equipes[1], -200, quiz],
        [equipes[2], -100, quiz],
      ].sort(),
    );
    expect(annulations.every((l) => l['saisi_par'] !== null)).toBe(true);
    // Le bonus donné à la main reste.
    expect(await points()).toEqual([50, 0]);
  });

  it('ne touche pas aux autres jeux, et une seconde relance n’annule rien deux fois', async () => {
    const service = clientService();
    const { count: mots } = await service
      .from('mots_surenchere')
      .select('*', { count: 'exact', head: true })
      .eq('passage_id', theme);
    expect(mots).toBe(1);

    expect((await relancer('anna@teamup.test', quiz)).erreur).toBeNull();
    const { count } = await service
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('evenement_id', evenement.id);
    expect(count).toBe(5);
    expect(await points()).toEqual([50, 0]);
  });

  it('rejoué puis relancé : seuls les nouveaux points sont annulés', async () => {
    await jouerLeQuiz();
    expect(await points()).toEqual([250, 100]);
    expect((await relancer('anna@teamup.test', quiz)).erreur).toBeNull();
    expect(await points()).toEqual([50, 0]);
  });

  it('la Surenchère relancée perd ses mots et son mode', async () => {
    const service = clientService();
    const { error } = await service
      .from('manches')
      .update({ statut: 'en_cours', options: { themes: 1, mode: 'telephones' } })
      .eq('id', surenchere);
    expect(error).toBeNull();
    expect((await relancer('anna@teamup.test', surenchere)).erreur).toBeNull();
    const { count } = await service
      .from('mots_surenchere')
      .select('*', { count: 'exact', head: true })
      .eq('passage_id', theme);
    expect(count).toBe(0);
    const { data: manche } = await service
      .from('manches')
      .select('statut, options')
      .eq('id', surenchere)
      .single();
    expect(manche).toEqual({ statut: 'a_venir', options: { themes: 1 } });
  });

  it('refuse un jeu annulé', async () => {
    const service = clientService();
    await service.from('manches').update({ statut: 'annulee' }).eq('id', surenchere);
    expect((await relancer('anna@teamup.test', surenchere)).erreur).toMatch(/manche annulée/);
  });
});
