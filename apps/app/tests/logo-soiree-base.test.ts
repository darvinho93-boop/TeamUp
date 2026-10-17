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
  evenement: { logo: { initiales: string[]; titre: string } | null };
}

async function ecran() {
  const { data } = await appeler<Ecran>(await clientAnimateur('anna@teamup.test'), 'etat_ecran', {
    p_code: evenement.code,
  });
  return data!;
}

const poser = async (
  logo: { logo_initiales: string[] | null; logo_titre: string | null },
  email = 'anna@teamup.test',
) => (await clientAnimateur(email)).from('evenements').update(logo).eq('id', evenement.id);

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

avecBase('le logo de la soirée', () => {
  it('n’existe pas tant que la Salle ne l’a pas saisi', async () => {
    expect((await ecran()).evenement.logo).toBeNull();
  });

  it('se saisit sous la session de l’animateur, et l’écran le reçoit', async () => {
    const { error } = await poser({ logo_initiales: ['V', 'M'], logo_titre: 'Vinoyan & Mélanie' });
    expect(error).toBeNull();
    expect((await ecran()).evenement.logo).toEqual({
      initiales: ['V', 'M'],
      titre: 'Vinoyan & Mélanie',
    });
  });

  it('reste intact pour un animateur d’une autre soirée', async () => {
    await poser({ logo_initiales: ['X'], logo_titre: 'Intrus' }, 'brahim@teamup.test');
    expect((await ecran()).evenement.logo?.titre).toBe('Vinoyan & Mélanie');
  });

  it('refuse un monogramme mal formé ou un logo incomplet', async () => {
    expect(
      (await poser({ logo_initiales: ['V', 'M', 'A', 'B'], logo_titre: 'Trop' })).error?.message,
    ).toMatch(/logo_initiales_forme/);
    expect(
      (await poser({ logo_initiales: ['VMAB'], logo_titre: 'Trop long' })).error?.message,
    ).toMatch(/logo_initiales_forme/);
    expect((await poser({ logo_initiales: [], logo_titre: 'Vide' })).error?.message).toMatch(
      /logo_initiales_forme/,
    );
    expect((await poser({ logo_initiales: ['V'], logo_titre: null })).error?.message).toMatch(
      /logo_complet/,
    );
    expect(
      (await poser({ logo_initiales: ['V'], logo_titre: 'x'.repeat(61) })).error?.message,
    ).toMatch(/logo_titre_forme/);
  });

  it('se retire', async () => {
    expect((await poser({ logo_initiales: null, logo_titre: null })).error).toBeNull();
    expect((await ecran()).evenement.logo).toBeNull();
  });
});
