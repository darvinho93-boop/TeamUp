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

const POINT_COMMUN = 'aaaa0101-0000-4000-8000-000000000101';
const THEME = 'aaaa0201-0000-4000-8000-000000000201';

interface Etat {
  pilotage: { version: string; etape: string | null };
  son: { actif: boolean; volume: number };
  equipes: { numero: number; prenoms: string[]; capitaine: string | null }[];
  programme: {
    jeu: string;
    passages: { id: string; secret: Record<string, Record<string, unknown>> | null }[];
  }[];
}

let evenement: { id: string; code: string };
let passagePC: string;
let passageSE: string;
let manchePC: string;

beforeAll(async () => {
  if (!baseDisponible) return;
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr', 'ta'] });
  const service = clientService();
  const { data: equipes } = await service
    .from('equipes')
    .select('id')
    .eq('evenement_id', evenement.id)
    .order('numero');
  const { data: manches } = await service
    .from('manches')
    .insert([
      { evenement_id: evenement.id, jeu: 'list2', ordre: 1, options: {} },
      { evenement_id: evenement.id, jeu: 'enchere2', ordre: 2, options: { chrono_s: 60 } },
    ])
    .select('id, jeu');
  manchePC = manches!.find((m) => m['jeu'] === 'list2')!['id'] as string;
  const { data: passages } = await service
    .from('passages')
    .insert([
      {
        manche_id: manchePC,
        evenement_id: evenement.id,
        equipe_id: equipes![0]!['id'],
        ordre: 1,
        contenu_id: POINT_COMMUN,
      },
      {
        manche_id: manches!.find((m) => m['jeu'] === 'enchere2')!['id'],
        evenement_id: evenement.id,
        equipe_id: null,
        ordre: 1,
        contenu_id: THEME,
      },
    ])
    .select('id');
  // Les deux passages ont l'ordre 1 dans leur manche : on les retrouve par manche.
  const { data: tous } = await service
    .from('passages')
    .select('id, manche_id')
    .eq('evenement_id', evenement.id);
  passagePC = tous!.find((p) => p['manche_id'] === manchePC)!['id'] as string;
  passageSE = tous!.find((p) => p['manche_id'] !== manchePC)!['id'] as string;
  expect(passages).toHaveLength(2);
});

afterAll(() => (baseDisponible ? supprimerEvenements([evenement.id]) : undefined));

async function etat(regie = false, email = 'anna@teamup.test') {
  const client = await clientAnimateur(email);
  return appeler<Etat>(client, 'etat_ecran', { p_code: evenement.code, p_regie: regie });
}

async function piloter(pilotage: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const { data } = await etat();
  const client = await clientAnimateur('anna@teamup.test');
  return appeler<string>(client, 'enregistrer_etape', {
    p_evenement: evenement.id,
    p_version: data!.pilotage.version,
    p_pilotage: pilotage,
    ...extra,
  });
}

const secretDe = (e: Etat | null, passage: string) =>
  e?.programme.flatMap((m) => m.passages).find((p) => p.id === passage)?.secret ?? null;

avecBase('le pilotage', () => {
  it('naît avec chaque événement, sur la scène d’accueil, avec un code tiré au hasard', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const { data, error } = await anna
      .from('evenements')
      .insert({
        animateur_id: '22222222-2222-4222-8222-222222222222',
        client_nom: 'Créé depuis la régie',
        date_evenement: '2026-12-31',
        creneau_minutes: 40,
      })
      .select('id, code')
      .single();
    expect(error).toBeNull();
    expect(data!['code']).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const { data: pilotage } = await anna
      .from('pilotage')
      .select('scene')
      .eq('evenement_id', data!['id'] as string)
      .single();
    expect(pilotage).toEqual({ scene: 'accueil' });
    await supprimerEvenements([data!['id'] as string]);
  });

  it('se lit par son animateur, pas par un autre, pas sans compte', async () => {
    expect((await etat()).data?.pilotage).toBeTruthy();
    expect((await etat(false, 'brahim@teamup.test')).data).toBeNull();
    const { erreur } = await appeler(clientAnon(), 'etat_ecran', { p_code: evenement.code });
    expect(erreur).toBeTruthy();
  });

  it('refuse une écriture partie d’un état périmé : un double appui ne compte pas deux fois', async () => {
    const { data } = await etat();
    const anna = await clientAnimateur('anna@teamup.test');
    const ecrire = () =>
      appeler<string>(anna, 'enregistrer_etape', {
        p_evenement: evenement.id,
        p_version: data!.pilotage.version,
        p_pilotage: { scene: 'equipes' },
      });
    expect((await ecrire()).erreur).toBeNull();
    expect((await ecrire()).erreur).toMatch(/périmé/);
  });

  it("n'est pas modifiable par l'animateur d'un autre événement", async () => {
    const { data } = await etat();
    const brahim = await clientAnimateur('brahim@teamup.test');
    const { erreur } = await appeler(brahim, 'enregistrer_etape', {
      p_evenement: evenement.id,
      p_version: data!.pilotage.version,
      p_pilotage: { scene: 'podium' },
    });
    expect(erreur).toBeTruthy();
    expect((await etat()).data?.pilotage).toMatchObject({ version: data!.pilotage.version });
  });

  it('écrit ensemble le pilotage, le passage, la manche et les points', async () => {
    const { data: equipe } = await clientService()
      .from('equipes')
      .select('id')
      .eq('evenement_id', evenement.id)
      .eq('numero', 1)
      .single();
    const { erreur } = await piloter(
      { scene: 'jeu', manche_id: manchePC, passage_id: passagePC, etape: 'trouve' },
      {
        p_passage: { id: passagePC, statut: 'termine', resultat: { ecoule_ms: 5000 }, points: 270 },
        p_manche: { id: manchePC, statut: 'en_cours' },
        p_scores: [
          { equipe_id: equipe!['id'], points: 270, motif: 'Points communs', manche_id: manchePC },
        ],
      },
    );
    expect(erreur).toBeNull();
    const service = clientService();
    const { data: passage } = await service
      .from('passages')
      .select('statut, points')
      .eq('id', passagePC)
      .single();
    expect(passage).toEqual({ statut: 'termine', points: 270 });
    const { data: scores } = await service
      .from('scores')
      .select('points, saisi_par')
      .eq('evenement_id', evenement.id);
    expect(scores).toEqual([{ points: 270, saisi_par: '22222222-2222-4222-8222-222222222222' }]);
  });
});

avecBase("ce que l'écran montre des secrets", () => {
  it('Points communs : la réponse pendant la consigne seulement, dans toutes les langues', async () => {
    await piloter({ scene: 'jeu', manche_id: manchePC, passage_id: passagePC, etape: 'consigne' });
    expect(secretDe((await etat()).data, passagePC)).toEqual({
      fr: { reponse: 'les personnes qui portent des lunettes' },
      ta: { reponse: 'கண்ணாடி அணிந்தவர்கள்' },
    });

    await piloter({ scene: 'jeu', manche_id: manchePC, passage_id: passagePC, etape: 'masque' });
    expect(secretDe((await etat()).data, passagePC)).toBeNull();
  });

  it('Points communs : seulement les indices déjà donnés', async () => {
    await piloter({
      scene: 'jeu',
      manche_id: manchePC,
      passage_id: passagePC,
      etape: 'lance',
      indices: 1,
    });
    const secret = secretDe((await etat()).data, passagePC);
    expect(secret?.['fr']).toEqual({ indices: ['Regardez les visages'] });
    expect(JSON.stringify(secret)).not.toContain('lunettes');
  });

  it('Surenchère : le sujet reste caché tant qu’il n’est pas dévoilé', async () => {
    await piloter({ scene: 'jeu', passage_id: null, etape: 'themes' });
    expect(secretDe((await etat()).data, passageSE)).toBeNull();

    await piloter({ scene: 'jeu', passage_id: passageSE, etape: 'sujet' });
    expect(secretDe((await etat()).data, passageSE)?.['fr']).toEqual({ sujet: 'citer des épices' });
  });

  it('la régie voit toujours tout : l’animateur juge sur la réponse', async () => {
    await piloter({ scene: 'jeu', passage_id: null, etape: 'themes' });
    const secret = secretDe((await etat(true)).data, passagePC);
    expect(secret?.['fr']).toMatchObject({ reponse: 'les personnes qui portent des lunettes' });
  });
});

avecBase('les membres des équipes', () => {
  it('sortent avec leur équipe, et le capitaine est nommé', async () => {
    const service = clientService();
    for (const prenom of ['Zoé', 'Adam', 'Mila']) {
      const { erreur } = await appeler(service, 'rejoindre_evenement', {
        p_code: evenement.code,
        p_prenom: prenom,
        p_langue: 'fr',
        p_jeton_hash: hacher(`membres-${prenom}-${evenement.id}`),
      });
      expect(erreur).toBeNull();
    }
    const avant = (await etat()).data!.equipes;
    expect(avant.flatMap((e) => e.prenoms).sort()).toEqual(['Adam', 'Mila', 'Zoé']);
    expect(avant.map((e) => e.capitaine)).toEqual([null, null]);

    await service
      .from('joueurs')
      .update({ capitaine: true })
      .eq('evenement_id', evenement.id)
      .eq('prenom', 'Mila');
    const apres = (await etat()).data!.equipes;
    const equipeDeMila = apres.find((e) => e.prenoms.includes('Mila'))!;
    expect(equipeDeMila.capitaine).toBe('Mila');
    expect(apres.filter((e) => e !== equipeDeMila).map((e) => e.capitaine)).toEqual([null]);
  });
});

avecBase('le son de la salle', () => {
  it('est actif à 80 par défaut, et se règle sans périmer le pilotage', async () => {
    const avant = (await etat()).data!;
    expect(avant.son).toEqual({ actif: true, volume: 80 });

    const anna = await clientAnimateur('anna@teamup.test');
    const { erreur } = await appeler(anna, 'regler_son', {
      p_evenement: evenement.id,
      p_actif: false,
      p_volume: 35,
    });
    expect(erreur).toBeNull();
    const apres = (await etat()).data!;
    expect(apres.son).toEqual({ actif: false, volume: 35 });
    // La version n'a pas bougé : la touche de régie suivante passe.
    expect(apres.pilotage.version).toBe(avant.pilotage.version);
    expect((await piloter({ scene: 'equipes' })).erreur).toBeNull();

    // Un volume hors bornes est ramené dans les bornes.
    await appeler(anna, 'regler_son', { p_evenement: evenement.id, p_actif: true, p_volume: 250 });
    expect((await etat()).data!.son).toEqual({ actif: true, volume: 100 });
  });

  it('ne se règle ni par un autre animateur, ni sans compte', async () => {
    const brahim = await clientAnimateur('brahim@teamup.test');
    await appeler(brahim, 'regler_son', { p_evenement: evenement.id, p_actif: false, p_volume: 0 });
    expect((await etat()).data!.son).toEqual({ actif: true, volume: 100 });
    const { erreur } = await appeler(clientAnon(), 'regler_son', {
      p_evenement: evenement.id,
      p_actif: false,
      p_volume: 0,
    });
    expect(erreur).toBeTruthy();
  });
});
