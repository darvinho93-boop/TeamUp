import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  appeler,
  baseDisponible,
  clientAnimateur,
  clientService,
  creerEvenementJetable,
  supprimerEvenements,
} from './base';

const avecBase = describe.skipIf(!baseDisponible);

let evenement: { id: string; code: string };

beforeAll(async () => {
  if (!baseDisponible) return;
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
});

afterAll(() => (baseDisponible ? supprimerEvenements([evenement.id]) : undefined));

interface Ecran {
  pilotage: { scene: string; version: string };
}

async function ecran() {
  const { data } = await appeler<Ecran>(await clientAnimateur('anna@teamup.test'), 'etat_ecran', {
    p_code: evenement.code,
  });
  return data!;
}

avecBase('la scène d’ouverture', () => {
  it('ouvre une soirée neuve', async () => {
    const service = clientService();
    const { data } = await service
      .from('evenements')
      .insert({
        code: `OUV${Math.floor(Math.random() * 900 + 100)}`.replace(/[01IO]/g, '2'),
        animateur_id: '22222222-2222-4222-8222-222222222222',
        client_nom: 'Test ouverture',
        date_evenement: new Date().toISOString().slice(0, 10),
        creneau_minutes: 40,
        langues: ['fr'],
        statut: 'en_cours',
      })
      .select('id')
      .single();
    const id = (data as { id: string }).id;
    try {
      const { data: pilotage } = await service
        .from('pilotage')
        .select('scene')
        .eq('evenement_id', id)
        .single();
      expect(pilotage).toEqual({ scene: 'ouverture' });
    } finally {
      await supprimerEvenements([id]);
    }
  });

  it('se pilote comme les autres scènes', async () => {
    const { pilotage } = await ecran();
    const { erreur } = await appeler(
      await clientAnimateur('anna@teamup.test'),
      'enregistrer_etape',
      {
        p_evenement: evenement.id,
        p_version: pilotage.version,
        p_pilotage: { scene: 'ouverture' },
      },
    );
    expect(erreur).toBeNull();
    expect((await ecran()).pilotage.scene).toBe('ouverture');
  });
});
