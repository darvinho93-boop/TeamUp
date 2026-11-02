import { afterAll, describe, expect, it } from 'vitest';
import {
  appeler,
  baseDisponible,
  clientAnon,
  clientService,
  creerEvenementJetable,
  supprimerEvenements,
} from './base';

const avecBase = describe.skipIf(!baseDisponible);

const crees: string[] = [];
afterAll(() => supprimerEvenements(crees));

/** Le jour en France il y a `heures` heures ; `soirees_du_jour` lit l'heure de Paris. */
const jourIlYA = (heures: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(
    new Date(Date.now() - heures * 3600 * 1000),
  );
const aujourdhui = () => jourIlYA(0);
const hier = () => jourIlYA(24);

async function soiree(reglage: Record<string, unknown>) {
  const evenement = await creerEvenementJetable({ langues: ['fr', 'ta'] });
  crees.push(evenement.id);
  const { error } = await clientService()
    .from('evenements')
    .update({ date_evenement: aujourdhui(), ...reglage })
    .eq('id', evenement.id);
  if (error) throw new Error(error.message);
  return evenement;
}

const lister = async () => {
  const { data, erreur } = await appeler<Record<string, unknown>[]>(
    clientService(),
    'soirees_du_jour',
    {},
  );
  expect(erreur).toBeNull();
  return data ?? [];
};

avecBase('la carte Team Up!', () => {
  it('ne liste que les soirées cochées, titrées, du jour et ouvertes', async () => {
    const visible = await soiree({ carte_visible: true, titre_public: '  Mariage de Léa & Sam ' });
    const nonCochee = await soiree({ carte_visible: false, titre_public: 'Pas cochée' });
    const sansTitre = await soiree({ carte_visible: true, titre_public: null });
    const dHier = await soiree({
      carte_visible: true,
      titre_public: 'Hier',
      date_evenement: hier(),
    });
    const avantHier = await soiree({
      carte_visible: true,
      titre_public: 'Avant-hier',
      date_evenement: jourIlYA(48),
    });
    const close = await soiree({ carte_visible: true, titre_public: 'Close', statut: 'termine' });
    const expiree = await soiree({
      carte_visible: true,
      titre_public: 'Expirée',
      code_expire_le: new Date(Date.now() - 60_000).toISOString(),
    });

    const liste = await lister();
    const codes = liste.map((s) => s['code']);
    expect(codes).toContain(visible.code);
    for (const e of [nonCochee, sansTitre, avantHier, close, expiree]) {
      expect(codes).not.toContain(e.code);
    }
    // La soirée de la veille reste jusqu'à 6 h, heure de Paris (la fête passe minuit), pas après.
    const avantSixHeures = jourIlYA(6) === hier();
    expect(codes.includes(dHier.code)).toBe(avantSixHeures);

    const s = liste.find((x) => x['code'] === visible.code)!;
    // Rien d'autre que ce que la page affiche : ni client, ni lieu, ni animateur.
    expect(Object.keys(s).sort()).toEqual(['code', 'langues', 'programme', 'statut', 'titre']);
    expect(s['titre']).toBe('Mariage de Léa & Sam');
    expect(s['langues']).toEqual(['fr', 'ta']);
    expect(s['programme']).toEqual([]);
  });

  it('donne les jeux du programme, sans les manches annulées', async () => {
    const { id, code } = await soiree({ carte_visible: true, titre_public: 'Avec programme' });
    const { error } = await clientService()
      .from('manches')
      .insert([
        { evenement_id: id, jeu: 'qcm2', ordre: 1, statut: 'a_venir' },
        { evenement_id: id, jeu: 'mime2', ordre: 2, statut: 'annulee' },
        { evenement_id: id, jeu: 'list2', ordre: 3, statut: 'a_venir' },
      ]);
    if (error) throw new Error(error.message);
    const s = (await lister()).find((x) => x['code'] === code)!;
    expect(s['programme']).toEqual(['qcm2', 'list2']);
  });

  it('refuse un titre de plus de 60 caractères', async () => {
    const { id } = await soiree({});
    const { error } = await clientService()
      .from('evenements')
      .update({ titre_public: 'x'.repeat(61) })
      .eq('id', id);
    expect(error?.message).toMatch(/titre_public/);
  });

  it('reste fermée à la clé anon', async () => {
    const { erreur } = await appeler(clientAnon(), 'soirees_du_jour', {});
    expect(erreur).not.toBeNull();
  });
});
