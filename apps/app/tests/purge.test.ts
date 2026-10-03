import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { purgerPhotosExpirees } from '../src/lib/purge';
import { baseDisponible, clientService, creerEvenementJetable, supprimerEvenements } from './base';

/**
 * Conservation des photos (lot 10, tranché le 2026-10-03) : 30 jours après la soirée, puis la
 * purge retire le fichier du bucket et la ligne de la table.
 */

const avecBase = describe.skipIf(!baseDisponible);
const THEME_1 = 'aaaa0005-0000-4000-8000-000000000005';
const THEME_2 = 'aaaa0006-0000-4000-8000-000000000006';
const JPEG = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });

avecBase('conservation des photos', () => {
  let evenement: { id: string; code: string };
  let equipe: string;

  beforeAll(async () => {
    evenement = await creerEvenementJetable({ equipes: 1, langues: ['fr'] });
    const { data } = await clientService()
      .from('equipes')
      .select('id')
      .eq('evenement_id', evenement.id)
      .single();
    equipe = (data as { id: string }).id;
  });

  afterAll(async () => {
    await clientService()
      .storage.from('photos')
      .remove([`${evenement.id}/${equipe}/a.jpg`, `${evenement.id}/${equipe}/b.jpg`]);
    await supprimerEvenements([evenement.id]);
  });

  async function deposer(nom: string, theme: string) {
    const chemin = `${evenement.id}/${equipe}/${nom}.jpg`;
    const service = clientService();
    const { error: e1 } = await service.storage
      .from('photos')
      .upload(chemin, JPEG, { upsert: true });
    if (e1) throw new Error(e1.message);
    const { data, error } = await service
      .from('photos')
      .insert({ evenement_id: evenement.id, equipe_id: equipe, theme_id: theme, chemin })
      .select('id, expire_le')
      .single();
    if (error) throw new Error(error.message);
    return { ...(data as { id: string; expire_le: string }), chemin };
  }

  it('expire 30 jours pleins après la soirée, puis seule l’expirée part', async () => {
    const ancienne = await deposer('a', THEME_1);
    const recente = await deposer('b', THEME_2);

    // La soirée a lieu aujourd'hui : la photo expire à minuit, 31 jours plus tard.
    const attendu = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    attendu.setUTCDate(attendu.getUTCDate() + 31);
    expect(new Date(recente.expire_le).toISOString()).toBe(attendu.toISOString());

    const service = clientService();
    await service
      .from('photos')
      .update({ expire_le: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', ancienne.id);

    const supprimees = await purgerPhotosExpirees(service as unknown as SupabaseClient);
    expect(supprimees).toBeGreaterThanOrEqual(1);

    const { data: restantes } = await service
      .from('photos')
      .select('id')
      .eq('evenement_id', evenement.id);
    expect(restantes).toEqual([{ id: recente.id }]);

    const { data: fichiers } = await service.storage
      .from('photos')
      .list(`${evenement.id}/${equipe}`);
    expect((fichiers ?? []).map((f) => f.name)).toEqual(['b.jpg']);
  });

  it('suit la date de la soirée quand elle change', async () => {
    const service = clientService();
    await service
      .from('evenements')
      .update({ date_evenement: '2026-01-10' })
      .eq('id', evenement.id);
    const { data } = await service
      .from('photos')
      .select('expire_le')
      .eq('evenement_id', evenement.id)
      .single();
    expect(new Date((data as { expire_le: string }).expire_le).toISOString()).toBe(
      '2026-02-10T00:00:00.000Z',
    );
  });
});
