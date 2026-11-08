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

// Contenus de la démo : « La cuisine » → « citer des épices », puis « Les voyages ».
const CUISINE = 'aaaa0201-0000-4000-8000-000000000201';
const VOYAGES = 'aaaa0202-0000-4000-8000-000000000202';

interface Mot {
  id: string;
  mot: string;
  refuse: boolean;
  masque?: boolean;
}
interface MotsEquipe {
  valides: number;
  liste: Mot[] | null;
}
interface Etat {
  pilotage: { version: string };
  programme: {
    id: string;
    passages: { id: string; mots: Record<string, MotsEquipe> | null }[];
  }[];
}
interface SurenchereJoueur {
  mode: string;
  etape: string;
  theme: string | null;
  sujet: string | null;
  capitaine: boolean;
  mots: Mot[];
  rang: number | null;
  points: number | null;
}

let evenement: { id: string; code: string };
let manche: string;
let cuisine: string;
const equipes: Record<number, string> = {};
const jeton = (nom: string) => `mots-${evenement.id}-${nom}`;

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
  evenement = await creerEvenementJetable({ equipes: 3, langues: ['fr', 'en'] });
  const service = clientService();
  const { data: eqs } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id);
  for (const eq of eqs!) equipes[eq['numero'] as number] = eq['id'] as string;

  const { data: m } = await service
    .from('manches')
    .insert({ evenement_id: evenement.id, jeu: 'enchere2', ordre: 1, options: { themes: 2 } })
    .select('id')
    .single();
  manche = m!['id'] as string;
  const { data: passages, error } = await service
    .from('passages')
    .insert(
      [CUISINE, VOYAGES].map((contenu, i) => ({
        manche_id: manche,
        evenement_id: evenement.id,
        ordre: i + 1,
        contenu_id: contenu,
      })),
    )
    .select('id, contenu_id');
  if (error) throw new Error(error.message);
  cuisine = passages.find((p) => p['contenu_id'] === CUISINE)!['id'] as string;

  // Alice, capitaine, et Bruno dans l'équipe 1 ; Chloé, capitaine (en anglais), dans la 2.
  await ajouterJoueur('Alice', 1, true);
  await ajouterJoueur('Bruno', 1);
  await ajouterJoueur('Chloe', 2, true, 'en');
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

const ajouter = (nom: string, mot: string) =>
  appeler<Mot[]>(clientService(), 'ajouter_mot', {
    p_jeton_hash: hacher(jeton(nom)),
    p_mot: mot,
  });

const retirer = (nom: string, id: string) =>
  appeler<Mot[]>(clientService(), 'retirer_mot', { p_jeton_hash: hacher(jeton(nom)), p_mot: id });

async function refuser(email: string, id: string, refuse: boolean) {
  const client = await clientAnimateur(email);
  return appeler(client, 'refuser_mot', { p_mot: id, p_refuse: refuse });
}

async function surenchereDe(nom: string) {
  const { data } = await appeler<{ surenchere: SurenchereJoueur | null }>(
    clientService(),
    'etat_joueur',
    { p_jeton_hash: hacher(jeton(nom)) },
  );
  return data!.surenchere;
}

const motsDe = (e: Etat) =>
  e.programme.find((m) => m.id === manche)!.passages.find((p) => p.id === cuisine)!.mots!;
const textes = (mots: { mot: string }[] | null | undefined) => (mots ?? []).map((m) => m.mot);

const ecouler = () =>
  clientService()
    .from('pilotage')
    .update({ chrono_depart: new Date(Date.now() - 62_000).toISOString() })
    .eq('evenement_id', evenement.id);

const chrono = {
  scene: 'jeu',
  etape: 'chrono',
  chrono: 'demarrer',
  chrono_duree_s: 60,
} as const;

avecBase('Surenchère en mode téléphones : avant le chrono', () => {
  it('refuse tout mot tant que la manche n’est pas en mode téléphones', async () => {
    await piloter(
      { ...chrono, manche_id: manche, passage_id: cuisine },
      { p_manche: { id: manche, statut: 'en_cours', options: { mode: 'voix' } } },
    );
    expect((await ajouter('Alice', 'Cannelle')).erreur).toMatch(/fermé/);
    expect(await surenchereDe('Alice')).toBeNull();
  });

  it('montre le sujet aux téléphones une fois dévoilé, dans leur langue, sans saisie', async () => {
    await piloter(
      { scene: 'jeu', manche_id: manche, passage_id: null, etape: 'themes', chrono: 'arreter' },
      { p_manche: { id: manche, statut: 'en_cours', options: { mode: 'telephones' } } },
    );
    expect(await surenchereDe('Alice')).toMatchObject({ etape: 'themes', sujet: null });
    await piloter(
      { scene: 'jeu', manche_id: manche, passage_id: cuisine, etape: 'sujet', chrono: 'garder' },
      { p_passage: { id: cuisine, statut: 'en_cours' } },
    );
    expect(await surenchereDe('Alice')).toMatchObject({
      mode: 'telephones',
      etape: 'sujet',
      theme: 'La cuisine',
      sujet: 'citer des épices',
      capitaine: true,
      mots: [],
    });
    expect(await surenchereDe('Chloe')).toMatchObject({ theme: 'Cooking', sujet: 'name spices' });
    expect((await ajouter('Alice', 'Cannelle')).erreur).toMatch(/fermé/);
  });
});

avecBase('Surenchère en mode téléphones : pendant le chrono', () => {
  it('ouvre la saisie au capitaine seulement', async () => {
    await piloter({ ...chrono, manche_id: manche, passage_id: cuisine });
    expect((await ajouter('Bruno', 'Cumin')).erreur).toMatch(/pas capitaine/);
    const inconnu = await appeler(clientService(), 'ajouter_mot', {
      p_jeton_hash: 'inconnu',
      p_mot: 'x',
    });
    expect(inconnu.erreur).toMatch(/session/);

    expect(textes((await ajouter('Alice', 'Cannelle')).data)).toEqual(['Cannelle']);
    expect(textes((await ajouter('Alice', '  Poivre   noir ')).data)).toEqual([
      'Cannelle',
      'Poivre noir',
    ]);
    expect(textes((await ajouter('Chloe', 'Cumin')).data)).toEqual(['Cumin']);
  });

  it('refuse un doublon (sans casse ni accents), un mot vide ou trop long', async () => {
    expect((await ajouter('Alice', 'CANNELLE')).erreur).toMatch(/déjà/);
    expect((await ajouter('Alice', 'cannellé')).erreur).toMatch(/déjà/);
    expect((await ajouter('Alice', '   ')).erreur).toMatch(/invalide/);
    expect((await ajouter('Alice', 'x'.repeat(41))).erreur).toMatch(/invalide/);
    expect((await ajouter('Alice', 'Muscade')).erreur).toBeNull();
    // Le même mot dans une autre équipe compte pour elle aussi.
    expect((await ajouter('Chloe', 'Cannelle')).erreur).toBeNull();
  });

  it('plafonne à 60 mots par équipe et par thème', async () => {
    await ajouterJoueur('Dina', 3, true);
    const lignes = Array.from({ length: 58 }, (_, i) => ({
      passage_id: cuisine,
      evenement_id: evenement.id,
      equipe_id: equipes[3],
      mot: `mot ${i}`,
      cle: `mot ${i}`,
    }));
    const { error } = await clientService().from('mots_surenchere').insert(lignes);
    expect(error).toBeNull();
    expect((await ajouter('Dina', 'cinquante-neuf')).erreur).toBeNull();
    expect((await ajouter('Dina', 'soixante')).erreur).toBeNull();
    expect((await ajouter('Dina', 'de trop')).erreur).toMatch(/trop/);
    await clientService().from('mots_surenchere').delete().eq('equipe_id', equipes[3]!);
  });

  it('ne montre à un téléphone que les mots de son équipe', async () => {
    const bruno = await surenchereDe('Bruno');
    expect(bruno!.capitaine).toBe(false);
    expect(textes(bruno!.mots)).toEqual(['Cannelle', 'Poivre noir', 'Muscade']);
    expect(textes((await surenchereDe('Chloe'))!.mots)).toEqual(['Cumin', 'Cannelle']);
  });

  it('ne donne à l’écran que des comptes, à la régie tous les mots', async () => {
    const ecran = motsDe(await etat());
    expect(ecran['1']).toEqual({ valides: 3, liste: null });
    expect(ecran['2']).toEqual({ valides: 2, liste: null });
    expect(JSON.stringify(ecran)).not.toMatch(/Poivre/);
    const regie = motsDe(await etat(true));
    expect(textes(regie['1']!.liste)).toEqual(['Cannelle', 'Poivre noir', 'Muscade']);
  });

  it('laisse le capitaine retirer un de ses mots, pas celui d’une autre équipe', async () => {
    const regie = motsDe(await etat(true));
    const muscade = regie['1']!.liste!.find((m) => m.mot === 'Muscade')!;
    const cumin = regie['2']!.liste!.find((m) => m.mot === 'Cumin')!;
    expect(textes((await retirer('Alice', muscade.id)).data)).toEqual(['Cannelle', 'Poivre noir']);
    await retirer('Alice', cumin.id);
    expect(textes((await surenchereDe('Chloe'))!.mots)).toContain('Cumin');
    expect((await retirer('Bruno', cumin.id)).erreur).toMatch(/pas capitaine/);
  });

  it('masque pour de bon un mot rayé pendant le chrono', async () => {
    const poivre = motsDe(await etat(true))['1']!.liste!.find((m) => m.mot === 'Poivre noir')!;
    expect((await refuser('anna@teamup.test', poivre.id, true)).erreur).toBeNull();
    const regie = motsDe(await etat(true));
    expect(regie['1']!.valides).toBe(1);
    expect(regie['1']!.liste!.find((m) => m.mot === 'Poivre noir')).toMatchObject({
      refuse: true,
      masque: true,
    });
    // Son équipe le voit rayé.
    expect((await surenchereDe('Alice'))!.mots).toContainEqual(
      expect.objectContaining({ mot: 'Poivre noir', refuse: true }),
    );
  });
});

avecBase('Surenchère en mode téléphones : après le chrono', () => {
  it('ferme la saisie et montre les mots à l’écran, sauf les mots masqués', async () => {
    await ecouler();
    expect((await ajouter('Alice', 'Safran')).erreur).toMatch(/fermé/);
    const ecran = motsDe(await etat());
    expect(textes(ecran['1']!.liste)).toEqual(['Cannelle']);
    expect(textes(ecran['2']!.liste)).toEqual(['Cumin', 'Cannelle']);
    expect(JSON.stringify(ecran)).not.toMatch(/Poivre/);
  });

  it('barre à l’écran un mot rayé après la fin', async () => {
    const cumin = motsDe(await etat(true))['2']!.liste!.find((m) => m.mot === 'Cumin')!;
    expect((await refuser('anna@teamup.test', cumin.id, true)).erreur).toBeNull();
    const ecran = motsDe(await etat());
    expect(ecran['2']!.valides).toBe(1);
    expect(ecran['2']!.liste![0]).toEqual({
      id: cumin.id,
      mot: 'Cumin',
      refuse: true,
      masque: false,
    });
  });

  it('n’ouvre rien à la clé anon ni à un autre animateur', async () => {
    const { data } = await clientAnon().from('mots_surenchere').select('id');
    expect(data ?? []).toEqual([]);
    const cumin = motsDe(await etat(true))['2']!.liste![0]!;
    const anon = await appeler(clientAnon(), 'refuser_mot', { p_mot: cumin.id, p_refuse: false });
    expect(anon.erreur).not.toBeNull();
    expect((await refuser('brahim@teamup.test', cumin.id, false)).erreur).toMatch(/inconnu/);
    const brahim = await clientAnimateur('brahim@teamup.test');
    const { data: vus } = await brahim.from('mots_surenchere').select('id');
    expect(vus).toEqual([]);
    const ajout = await appeler(clientAnon(), 'ajouter_mot', { p_jeton_hash: 'x', p_mot: 'x' });
    expect(ajout.erreur).not.toBeNull();
  });

  it('annonce au podium le rang et les points de l’équipe, puis fige les mots', async () => {
    await piloter(
      { scene: 'jeu', manche_id: manche, passage_id: cuisine, etape: 'podium', chrono: 'arreter' },
      {
        p_passage: {
          id: cuisine,
          statut: 'termine',
          points: 200,
          resultat: {
            mode: 'telephones',
            comptes: { 1: 1, 2: 1 },
            rangs: { 1: 1, 2: 1 },
            points: { 1: 100, 2: 100 },
          },
        },
      },
    );
    expect(await surenchereDe('Bruno')).toMatchObject({
      etape: 'podium',
      sujet: 'citer des épices',
      rang: 1,
      points: 100,
    });
    const cannelle = motsDe(await etat(true))['1']!.liste![0]!;
    expect((await refuser('anna@teamup.test', cannelle.id, true)).erreur).toMatch(/classé/);
  });
});
