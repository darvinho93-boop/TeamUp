import { afterAll, describe, expect, it } from 'vitest';
import {
  appeler,
  baseDisponible,
  clientAnimateur,
  clientService,
  creerEvenementJetable,
  supprimerEvenements,
} from './base';

const avecBase = describe.skipIf(!baseDisponible);

const crees: string[] = [];

afterAll(() => supprimerEvenements(crees));

/** Une soirée jetable d'Anna, avec un Points communs à deux tours sur trois équipes. */
async function soiree() {
  const evenement = await creerEvenementJetable({ equipes: 3 });
  crees.push(evenement.id);
  const service = clientService();
  const { data: equipes } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id)
    .order('numero');
  const { data: manche, error } = await service
    .from('manches')
    .insert({
      evenement_id: evenement.id,
      jeu: 'list2',
      ordre: 1,
      options: { passages_par_equipe: 2 },
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const mancheId = (manche as { id: string }).id;
  const lignes = [...equipes!, ...equipes!].map((e, i) => ({
    manche_id: mancheId,
    evenement_id: evenement.id,
    equipe_id: e['id'],
    ordre: i + 1,
  }));
  const { data: passages } = await service
    .from('passages')
    .insert(lignes)
    .select('id, ordre, equipe_id')
    .order('ordre');
  return {
    ...evenement,
    mancheId,
    passages: passages as { id: string; ordre: number; equipe_id: string }[],
  };
}

async function ordreEnBase(mancheId: string) {
  const { data } = await clientService()
    .from('passages')
    .select('id')
    .eq('manche_id', mancheId)
    .order('ordre');
  return (data as { id: string }[]).map((p) => p.id);
}

avecBase("l'ordre de passage", () => {
  it('la régie renumérote les passages et note que l’ordre est tiré', async () => {
    const { mancheId, passages } = await soiree();
    const voulu = [...passages].reverse().map((p) => p.id);
    const anna = await clientAnimateur('anna@teamup.test');
    const { erreur } = await appeler(anna, 'ordonner_passages', {
      p_manche: mancheId,
      p_passages: voulu,
    });
    expect(erreur).toBeNull();
    expect(await ordreEnBase(mancheId)).toEqual(voulu);
    const { data } = await clientService()
      .from('manches')
      .select('options')
      .eq('id', mancheId)
      .single();
    expect(data!['options']).toEqual({ passages_par_equipe: 2, ordre_tire: true });
  });

  it('refuse une liste incomplète, en double ou étrangère', async () => {
    const { mancheId, passages } = await soiree();
    const autre = await soiree();
    const anna = await clientAnimateur('anna@teamup.test');
    const ids = passages.map((p) => p.id);
    for (const liste of [
      ids.slice(1),
      [ids[0]!, ...ids.slice(0, -1)],
      [...ids.slice(1), autre.passages[0]!.id],
    ]) {
      const { erreur } = await appeler(anna, 'ordonner_passages', {
        p_manche: mancheId,
        p_passages: liste,
      });
      expect(erreur).toMatch(/invalide/);
    }
    expect(await ordreEnBase(mancheId)).toEqual(ids);
  });

  it('refuse une fois la manche commencée', async () => {
    const { mancheId, passages } = await soiree();
    await clientService().from('passages').update({ statut: 'en_cours' }).eq('id', passages[0]!.id);
    const anna = await clientAnimateur('anna@teamup.test');
    const { erreur } = await appeler(anna, 'ordonner_passages', {
      p_manche: mancheId,
      p_passages: [...passages].reverse().map((p) => p.id),
    });
    expect(erreur).toMatch(/commencée/);
  });

  it("un autre animateur ne réordonne pas la soirée d'Anna", async () => {
    const { mancheId, passages } = await soiree();
    const brahim = await clientAnimateur('brahim@teamup.test');
    const { erreur } = await appeler(brahim, 'ordonner_passages', {
      p_manche: mancheId,
      p_passages: [...passages].reverse().map((p) => p.id),
    });
    expect(erreur).toMatch(/introuvable/);
    expect(await ordreEnBase(mancheId)).toEqual(passages.map((p) => p.id));
  });
});
