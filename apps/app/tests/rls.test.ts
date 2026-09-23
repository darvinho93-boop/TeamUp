import { beforeAll, describe, expect, it } from 'vitest';
import {
  TABLES,
  appeler,
  baseDisponible,
  clientAnimateur,
  clientAnon,
  clientService,
  hacher,
} from './base';

if (!baseDisponible) {
  console.warn('[tests base] Aucune base locale joignable : lance `pnpm db:start`. Tests ignorés.');
}

const avecBase = describe.skipIf(!baseDisponible);

avecBase('un visiteur sans compte', () => {
  it.each(TABLES)('ne lit rien dans %s', async (table) => {
    const { data } = await clientAnon().from(table).select('*').limit(1);
    // Droit retiré (erreur, donc data null) ou RLS (zéro ligne) : jamais une ligne.
    expect(data ?? []).toHaveLength(0);
  });

  it('ne peut appeler aucune fonction joueur, même avec un jeton valide', async () => {
    const anon = clientAnon();
    for (const fonction of ['etat_joueur', 'secret_du_joueur', 'pouls_joueur']) {
      const { erreur } = await appeler(anon, fonction, { p_jeton_hash: hacher('demo-joueur-1') });
      expect(erreur, `${fonction} devrait être refusée`).toBeTruthy();
    }
  });

  it("ne peut pas s'inscrire comme joueur en écrivant dans la table", async () => {
    const { error } = await clientAnon()
      .from('joueurs')
      .insert({ prenom: 'Pirate', jeton_hash: hacher('pirate'), langue: 'fr' });
    expect(error).toBeTruthy();
  });
});

avecBase('le secret ne sort que pour le joueur désigné', () => {
  const secret = async (jeton: string) => {
    const { data, erreur } = await appeler<{ jeu: string; valeur: Record<string, unknown> }>(
      clientService(),
      'secret_du_joueur',
      { p_jeton_hash: hacher(jeton) },
    );
    expect(erreur).toBeNull();
    return data;
  };

  it('le joueur désigné du passage en cours reçoit le mot', async () => {
    const resultat = await secret('demo-joueur-1');
    expect(resultat?.jeu).toBe('mime2');
    expect(resultat?.valeur).toEqual({ mot: 'éléphant' });
  });

  it.each([
    ['un coéquipier', 'demo-joueur-2'],
    ['un joueur de la même équipe', 'demo-joueur-3'],
    ['le désigné du passage suivant, pas encore lancé', 'demo-joueur-4'],
    ["un joueur d'une autre équipe", 'demo-joueur-7'],
    ["un joueur d'un autre événement", 'demo-autre-evenement'],
    ['un jeton inconnu', 'jeton-qui-n-existe-pas'],
  ])('%s ne reçoit rien', async (_cas, jeton) => {
    expect(await secret(jeton)).toBeNull();
  });

  it("l'état d'attente ne contient jamais de secret", async () => {
    const { data } = await appeler<{ evenement: { code: string } }>(
      clientService(),
      'etat_joueur',
      { p_jeton_hash: hacher('demo-joueur-1') },
    );
    expect(JSON.stringify(data)).not.toContain('éléphant');
    expect(data).toMatchObject({ evenement: { code: 'FETE24' } });
  });
});

avecBase('un animateur connecté', () => {
  let anna: Awaited<ReturnType<typeof clientAnimateur>>;
  let brahim: Awaited<ReturnType<typeof clientAnimateur>>;

  beforeAll(async () => {
    anna = await clientAnimateur('anna@teamup.test');
    brahim = await clientAnimateur('brahim@teamup.test');
  });

  it('ne voit que ses propres événements', async () => {
    const { data } = await anna.from('evenements').select('code').returns<{ code: string }[]>();
    expect(data?.map((e) => e.code)).toEqual(['FETE24']);

    const { data: autres } = await brahim
      .from('evenements')
      .select('code')
      .returns<{ code: string }[]>();
    expect(autres?.map((e) => e.code)).toEqual(['BUREAU']);
  });

  it("ne voit pas les joueurs d'un événement qui n'est pas le sien", async () => {
    const { data } = await brahim.from('joueurs').select('prenom').returns<{ prenom: string }[]>();
    expect(data?.map((j) => j.prenom)).toEqual(['Claire']);
  });

  it('lit les secrets des contenus : la régie doit montrer le mot à J1', async () => {
    const { data, error } = await anna
      .from('contenus_secrets')
      .select('valeur')
      .eq('contenu_id', 'aaaa0004-0000-4000-8000-000000000004')
      .eq('langue', 'fr')
      .returns<{ valeur: Record<string, unknown> }[]>()
      .single();
    expect(error).toBeNull();
    expect(data?.valeur).toEqual({ mot: 'éléphant' });
  });

  it("ne peut pas écrire dans les banques de contenus (réservé à l'admin)", async () => {
    const { error } = await anna
      .from('contenus_secrets')
      .update({ valeur: { mot: 'girafe' } })
      .eq('contenu_id', 'aaaa0004-0000-4000-8000-000000000004')
      .eq('langue', 'fr')
      .select();
    expect(error ?? { message: 'aucune ligne modifiée' }).toBeTruthy();

    const { data } = await clientService()
      .from('contenus_secrets')
      .select('valeur')
      .eq('contenu_id', 'aaaa0004-0000-4000-8000-000000000004')
      .eq('langue', 'fr')
      .returns<{ valeur: Record<string, unknown> }[]>()
      .single();
    expect(data?.valeur).toEqual({ mot: 'éléphant' });
  });

  it("ne peut pas ajouter de score à l'événement d'un autre", async () => {
    const { error } = await brahim.from('scores').insert({
      evenement_id: 'eeee0001-0000-4000-8000-000000000001',
      equipe_id: '11100001-0000-4000-8000-000000000001',
      points: 1000,
      motif: 'triche',
    });
    expect(error).toBeTruthy();
  });

  it('ne peut ni corriger ni supprimer un score : le journal est append-only', async () => {
    const { data: avant } = await anna
      .from('scores')
      .select('id, points')
      .limit(1)
      .returns<{ id: string; points: number }[]>()
      .single();

    const { data: modifie } = await anna
      .from('scores')
      .update({ points: 9999 })
      .eq('id', avant!.id)
      .select();
    expect(modifie ?? []).toHaveLength(0);

    const { data: supprime } = await anna.from('scores').delete().eq('id', avant!.id).select();
    expect(supprime ?? []).toHaveLength(0);

    const { data: apres } = await anna
      .from('scores')
      .select('points')
      .eq('id', avant!.id)
      .returns<{ points: number }[]>()
      .single();
    expect(apres?.points).toBe(avant!.points);
  });
});

avecBase('rejoindre une partie', () => {
  it('accepte un code ouvert et refuse un code inconnu', async () => {
    const service = clientService();
    const { data, erreur } = await appeler<{ code: string; prenom: string }>(
      service,
      'rejoindre_evenement',
      {
        p_code: 'FETE24',
        p_prenom: 'Nouvelle',
        p_langue: 'fr',
        p_jeton_hash: hacher(`test-${Date.now()}`),
      },
    );
    expect(erreur).toBeNull();
    expect(data).toMatchObject({ code: 'FETE24', prenom: 'Nouvelle' });

    const { erreur: refus } = await appeler(service, 'rejoindre_evenement', {
      p_code: 'XXXXXX',
      p_prenom: 'Nouvelle',
      p_langue: 'fr',
      p_jeton_hash: hacher(`test-refus-${Date.now()}`),
    });
    expect(refus).toBeTruthy();
  });

  it("refuse une langue que l'événement ne propose pas", async () => {
    const { erreur } = await appeler(clientService(), 'rejoindre_evenement', {
      p_code: 'BUREAU',
      p_prenom: 'Nouvelle',
      p_langue: 'ta',
      p_jeton_hash: hacher(`test-langue-${Date.now()}`),
    });
    expect(erreur).toBeTruthy();
  });
});
