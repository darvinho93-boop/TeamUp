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
 * Portrait mystère (2026-11-18), côté base : les proches d'une soirée, la grille, les votes du
 * capitaine et de la régie, et surtout ce qui ne sort jamais vers un téléphone ni vers l'écran
 * avant l'heure (la cible, la carte noire, les indices à venir).
 */
const avecBase = describe.skipIf(!baseDisponible);

let evenement: { id: string; code: string };
let manche: string;
const cibles: string[] = [];
const cartes: string[] = [];
const equipes: Record<number, string> = {};
const jeton = (nom: string) => `portrait-${evenement.id}-${nom}`;
/** Position de la première cible dans la grille, et de la carte noire. */
const CIBLE = 7;
const NOIRE = 13;

const proche = (n: number) => ({
  fr: {
    public: { nom: `Proche ${n}` },
    secret: { indices: [`Indice A${n}`, `Indice B${n}`, `Indice C${n}`] },
  },
  en: {
    public: { nom: `Relative ${n}` },
    secret: { indices: [`Clue A${n}`, `Clue B${n}`, `Clue C${n}`] },
  },
});

async function ajouterJoueur(nom: string, equipe: number, capitaine: boolean) {
  const { error } = await clientService()
    .from('joueurs')
    .insert({
      evenement_id: evenement.id,
      equipe_id: equipes[equipe],
      prenom: nom,
      langue: 'fr',
      capitaine,
      jeton_hash: hacher(jeton(nom)),
    });
  if (error) throw new Error(error.message);
}

/** Un tour de vote, posé directement : la régie l'écrirait par `enregistrer_etape`. */
async function pilotage(etape: string, tour: number, departIlYAS = 1, passage = cibles[0]) {
  const { error } = await clientService()
    .from('pilotage')
    .update({
      scene: 'jeu',
      manche_id: manche,
      passage_id: passage,
      etape,
      indices: tour,
      chrono_depart: new Date(Date.now() - departIlYAS * 1000).toISOString(),
      chrono_duree_s: 20,
    })
    .eq('evenement_id', evenement.id);
  if (error) throw new Error(error.message);
}

const voter = (nom: string, carte: number) =>
  appeler<{ evenement_id: string }>(clientService(), 'voter_portrait', {
    p_jeton_hash: hacher(jeton(nom)),
    p_carte: carte,
  });

async function etatJoueur(nom: string) {
  const { data, erreur } = await appeler<Record<string, unknown>>(clientService(), 'etat_joueur', {
    p_jeton_hash: hacher(jeton(nom)),
  });
  if (erreur) throw new Error(erreur);
  return data!;
}

async function etatEcran(regie: boolean) {
  const anna = await clientAnimateur('anna@teamup.test');
  const { data, erreur } = await appeler<{
    programme: {
      id: string;
      grille: {
        cartes: Record<string, { nom: string }>[];
        ids: string[] | null;
        noire: number | null;
        retournees: Record<string, number>;
      };
      passages: {
        id: string;
        contenu_id: string | null;
        public: unknown;
        secret: Record<string, { indices?: string[] }> | null;
        votes: Record<string, unknown> | null;
      }[];
    }[];
  }>(anna, 'etat_ecran', { p_code: evenement.code, p_regie: regie });
  if (erreur) throw new Error(erreur);
  return data!.programme.find((m) => m.id === manche)!;
}

beforeAll(async () => {
  if (!baseDisponible) return;
  evenement = await creerEvenementJetable({ equipes: 3, langues: ['fr', 'en'] });
  const service = clientService();
  const { data: eqs } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id);
  for (const e of eqs ?? []) equipes[e.numero as number] = e.id as string;

  // 26 proches de la soirée, par Anna : 25 pour la grille, un de rechange.
  const anna = await clientAnimateur('anna@teamup.test');
  for (let n = 0; n < 26; n++) {
    const { data, erreur } = await appeler<string>(anna, 'enregistrer_proche', {
      p_evenement: evenement.id,
      p_id: null,
      p_langues: proche(n),
    });
    if (erreur) throw new Error(erreur);
    cartes.push(data!);
  }

  const { data: m, error } = await service
    .from('manches')
    .insert({
      evenement_id: evenement.id,
      jeu: 'portrait',
      ordre: 1,
      statut: 'en_cours',
      options: { mode: 'telephones' },
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  manche = (m as { id: string }).id;
  for (const [ordre, position] of [
    [1, CIBLE],
    [2, 3],
  ] as const) {
    const { data: pa, error: e } = await service
      .from('passages')
      .insert({
        evenement_id: evenement.id,
        manche_id: manche,
        ordre,
        contenu_id: cartes[position],
        statut: ordre === 1 ? 'en_cours' : 'a_venir',
      })
      .select('id')
      .single();
    if (e) throw new Error(e.message);
    cibles.push((pa as { id: string }).id);
  }
  const { error: g } = await anna
    .from('grilles_portrait')
    .insert({ manche_id: manche, cartes: cartes.slice(0, 25), noire: NOIRE });
  if (g) throw new Error(g.message);

  await ajouterJoueur('Alice', 1, true);
  await ajouterJoueur('Bruno', 2, true);
  await ajouterJoueur('Chloé', 3, true);
  await ajouterJoueur('Denis', 1, false);
});

afterAll(async () => {
  if (baseDisponible) await supprimerEvenements([evenement.id]);
});

avecBase('Portrait mystère : proches et grille', () => {
  it('un proche exige toutes les langues de la soirée et trois indices', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const sansAnglais = { fr: proche(99).fr };
    expect(
      (
        await appeler(anna, 'enregistrer_proche', {
          p_evenement: evenement.id,
          p_id: null,
          p_langues: sansAnglais,
        })
      ).erreur,
    ).toMatch(/langues de la soirée/);
    const deuxIndices = proche(98);
    deuxIndices.fr.secret.indices = ['a', 'b'];
    expect(
      (
        await appeler(anna, 'enregistrer_proche', {
          p_evenement: evenement.id,
          p_id: null,
          p_langues: deuxIndices,
        })
      ).erreur,
    ).toMatch(/mal formé/);
  });

  it('les proches ne se lisent que par l’animateur de la soirée', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const brahim = await clientAnimateur('brahim@teamup.test');
    const lus = async (client: Awaited<ReturnType<typeof clientAnimateur>>) =>
      (await client.from('contenus_secrets').select('contenu_id').eq('contenu_id', cartes[0]!))
        .data ?? [];
    expect(await lus(anna)).toHaveLength(2);
    expect(await lus(brahim)).toHaveLength(0);
    const { data: contenus } = await brahim.from('contenus').select('id').eq('id', cartes[0]!);
    expect(contenus).toEqual([]);
    expect(
      (
        await appeler(brahim, 'enregistrer_proche', {
          p_evenement: evenement.id,
          p_id: null,
          p_langues: proche(97),
        })
      ).erreur,
    ).toMatch(/accès refusé/);
    // La banque reste lisible par tous les animateurs.
    const { data: banque } = await brahim
      .from('contenus')
      .select('id')
      .is('evenement_id', null)
      .limit(1);
    expect(banque?.length).toBe(1);
  });

  it('la grille : 25 cartes différentes, écrite par l’animateur de la soirée seulement', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const doublon = [...cartes.slice(0, 24), cartes[0]!];
    expect(
      (await anna.from('grilles_portrait').update({ cartes: doublon }).eq('manche_id', manche))
        .error,
    ).not.toBeNull();
    const brahim = await clientAnimateur('brahim@teamup.test');
    const { data } = await brahim.from('grilles_portrait').select('noire').eq('manche_id', manche);
    expect(data).toEqual([]);
    expect((await clientAnon().from('grilles_portrait').select('noire')).data ?? []).toEqual([]);
  });
});

avecBase('Portrait mystère : votes et secrets', () => {
  it('le capitaine vote pendant le tour et peut changer d’avis ; les autres non', async () => {
    await pilotage('vote', 1);
    expect((await voter('Alice', 2)).erreur).toBeNull();
    expect((await voter('Alice', CIBLE)).erreur).toBeNull();
    expect((await voter('Denis', 4)).erreur).toMatch(/pas capitaine/);
    expect((await voter('Inconnu', 4)).erreur).toMatch(/session inconnue/);
    expect((await voter('Bruno', 25)).erreur).toMatch(/carte invalide/);
    const { data } = await clientService()
      .from('votes_portrait')
      .select('carte, tour')
      .eq('passage_id', cibles[0]!);
    expect(data).toEqual([{ carte: CIBLE, tour: 1 }]);
  });

  it('tour fermé : chrono écoulé, verdict du tour, ou mode à voix', async () => {
    await pilotage('vote', 1, 30);
    expect((await voter('Bruno', 4)).erreur).toMatch(/tour fermé/);
    await pilotage('tour', 1);
    expect((await voter('Bruno', 4)).erreur).toMatch(/tour fermé/);
    await clientService()
      .from('manches')
      .update({ options: { mode: 'voix' } })
      .eq('id', manche);
    await pilotage('vote', 1);
    expect((await voter('Bruno', 4)).erreur).toMatch(/tour fermé/);
    await clientService()
      .from('manches')
      .update({ options: { mode: 'telephones' } })
      .eq('id', manche);
  });

  it('le téléphone voit la grille et le vote de son équipe, jamais la réponse', async () => {
    await pilotage('vote', 1);
    const alice = await etatJoueur('Alice');
    const portrait = alice['portrait'] as Record<string, unknown>;
    expect(portrait).toMatchObject({ etape: 'vote', tour: 1, vote: CIBLE, peut_voter: true });
    expect((portrait['cartes'] as unknown[]).length).toBe(25);
    const texte = JSON.stringify(alice);
    for (const interdit of [cartes[CIBLE]!, cartes[NOIRE]!, 'Indice', 'noire', 'contenu']) {
      expect(texte).not.toContain(interdit);
    }
    // Le coéquipier voit le vote de son équipe, sans pouvoir voter.
    const denis = (await etatJoueur('Denis'))['portrait'] as Record<string, unknown>;
    expect(denis).toMatchObject({ vote: CIBLE, peut_voter: false });
    // Un capitaine d'une autre équipe ne voit pas ce vote.
    expect(((await etatJoueur('Bruno'))['portrait'] as Record<string, unknown>)['vote']).toBeNull();
  });

  it('l’écran ne voit ni la cible, ni la noire, ni les indices à venir ; la régie voit tout', async () => {
    await pilotage('vote', 1);
    const ecran = await etatEcran(false);
    const courant = ecran.passages.find((p) => p.id === cibles[0])!;
    expect(courant.contenu_id).toBeNull();
    expect(courant.public).toEqual({});
    expect(courant.secret).toEqual({
      fr: { indices: ['Indice A7'] },
      en: { indices: ['Clue A7'] },
    });
    expect(courant.votes).toEqual({ 1: true });
    expect(ecran.grille.noire).toBeNull();
    expect(ecran.grille.ids).toBeNull();
    expect(ecran.grille.cartes).toHaveLength(25);
    const texte = JSON.stringify(ecran);
    expect(texte).not.toContain('Indice B7');
    expect(texte).not.toContain(cartes[CIBLE]!);

    const regie = await etatEcran(true);
    const vu = regie.passages.find((p) => p.id === cibles[0])!;
    expect(vu.contenu_id).toBe(cartes[CIBLE]);
    expect(vu.votes).toEqual({ 1: CIBLE });
    expect(regie.grille.noire).toBe(NOIRE);

    // Deuxième tour : deux indices.
    await pilotage('vote', 2);
    const second = (await etatEcran(false)).passages.find((p) => p.id === cibles[0])!;
    expect(second.secret?.['fr']?.indices).toEqual(['Indice A7', 'Indice B7']);
    // La carte noire paraît à l'étape « noire ».
    await pilotage('noire', 3);
    expect((await etatEcran(false)).grille.noire).toBe(NOIRE);
  });

  it('équipe éliminée, équipe qui a trouvé, carte retournée : refusés', async () => {
    const service = clientService();
    // La première cible révélée : Alice a trouvé, Bruno est tombé sur la noire.
    await service
      .from('passages')
      .update({ statut: 'termine', resultat: { trouvees: { 1: 1 }, eliminees: [2], tours: 1 } })
      .eq('id', cibles[0]!);
    await service.from('passages').update({ statut: 'en_cours' }).eq('id', cibles[1]!);
    await pilotage('vote', 1, 1, cibles[1]);
    expect((await voter('Bruno', 4)).erreur).toMatch(/équipe éliminée/);
    expect((await voter('Chloé', CIBLE)).erreur).toMatch(/carte invalide/);
    expect((await voter('Chloé', 3)).erreur).toBeNull();
    const bruno = (await etatJoueur('Bruno'))['portrait'] as Record<string, unknown>;
    expect(bruno).toMatchObject({ eliminee: true, peut_voter: false });
    // L'écran sait où se retourne la cible révélée.
    expect((await etatEcran(false)).grille.retournees).toEqual({ [cibles[0]!]: CIBLE });
    const cartesVues = (await etatJoueur('Chloé'))['portrait'] as {
      cartes: { retournee: boolean }[];
    };
    expect(cartesVues.cartes[CIBLE]?.retournee).toBe(true);

    // Une équipe qui a trouvé cette cible ne revote pas.
    await service
      .from('passages')
      .update({ resultat: { trouvees: { 1: 1 }, eliminees: [], tours: 1 } })
      .eq('id', cibles[1]!);
    expect((await voter('Alice', 5)).erreur).toMatch(/déjà trouvé/);
  });

  it('la régie saisit un vote (mode à voix) ou le retire ; un autre animateur non', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    expect(
      (
        await appeler(anna, 'voter_portrait_regie', {
          p_passage: cibles[1],
          p_equipe: equipes[3],
          p_carte: 9,
        })
      ).erreur,
    ).toBeNull();
    let { data } = await clientService()
      .from('votes_portrait')
      .select('carte')
      .eq('passage_id', cibles[1]!)
      .eq('equipe_id', equipes[3]!);
    expect(data).toEqual([{ carte: 9 }]);
    await appeler(anna, 'voter_portrait_regie', {
      p_passage: cibles[1],
      p_equipe: equipes[3],
      p_carte: null,
    });
    ({ data } = await clientService()
      .from('votes_portrait')
      .select('carte')
      .eq('passage_id', cibles[1]!)
      .eq('equipe_id', equipes[3]!));
    expect(data).toEqual([]);

    const brahim = await clientAnimateur('brahim@teamup.test');
    expect(
      (
        await appeler(brahim, 'voter_portrait_regie', {
          p_passage: cibles[1],
          p_equipe: equipes[3],
          p_carte: 9,
        })
      ).erreur,
    ).toMatch(/accès refusé/);
    // Aucune lecture directe des votes pour la clé anon ni pour un autre animateur.
    expect((await clientAnon().from('votes_portrait').select('carte')).data ?? []).toEqual([]);
    expect(
      (await brahim.from('votes_portrait').select('carte').eq('passage_id', cibles[1]!)).data,
    ).toEqual([]);
  });

  it('relancer le jeu retire les votes', async () => {
    await voter('Chloé', 4);
    const anna = await clientAnimateur('anna@teamup.test');
    expect(
      (await appeler(anna, 'recommencer_manche', { p_manche: manche, p_motif: 'Test' })).erreur,
    ).toBeNull();
    const { data } = await clientService()
      .from('votes_portrait')
      .select('carte')
      .in('passage_id', cibles);
    expect(data).toEqual([]);
  });
});
