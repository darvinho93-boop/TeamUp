import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  appeler,
  baseDisponible,
  clientAnimateur,
  clientService,
  creerEvenementJetable,
  hacher,
  supprimerEvenements,
} from './base';

/**
 * Le classement au téléphone (2026-11-23) : rien avant que le grand écran ait fini de dévoiler le
 * podium, puis les rangs de l'écran. Une clôture ne publie rien ; un podium quitté trop tôt non
 * plus ; une fois montré, des points ajoutés ensuite ne sortent pas.
 */
const avecBase = describe.skipIf(!baseDisponible);

const REVELATION_MS = 5200;

interface Ligne {
  rang: number;
  numero: number;
  nom: string;
  points: number;
  ex_aequo: boolean;
}

let evenement: { id: string; code: string };
const equipes: Record<number, string> = {};
const jeton = () => `classement-${evenement.id}`;

const classement = async () => {
  const { data } = await appeler<{ classement: Ligne[] | null }>(clientService(), 'etat_joueur', {
    p_jeton_hash: hacher(jeton()),
  });
  return data!.classement;
};

const scene = async (valeur: string) => {
  const { error } = await clientService()
    .from('pilotage')
    .update({ scene: valeur })
    .eq('evenement_id', evenement.id);
  if (error) throw new Error(error.message);
};

const marquer = async (numero: number, points: number) => {
  const { error } = await clientService()
    .from('scores')
    .insert({ evenement_id: evenement.id, equipe_id: equipes[numero]!, points, motif: 'test' });
  if (error) throw new Error(error.message);
};

const attendre = (ms: number) => new Promise((fin) => setTimeout(fin, ms));

beforeAll(async () => {
  if (!baseDisponible) return;
  evenement = await creerEvenementJetable({ equipes: 3, langues: ['fr'] });
  const service = clientService();
  const { data: eqs } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id);
  for (const eq of eqs!) equipes[eq['numero'] as number] = eq['id'] as string;
  const { error } = await service.from('joueurs').insert({
    evenement_id: evenement.id,
    equipe_id: equipes[2]!,
    prenom: 'Camille',
    langue: 'fr',
    jeton_hash: hacher(jeton()),
  });
  if (error) throw new Error(error.message);
  await marquer(1, 100);
  await marquer(2, 300);
  await marquer(3, 100);
});

afterAll(() => (baseDisponible ? supprimerEvenements([evenement.id]) : undefined));

avecBase('le classement public', () => {
  it('reste vide avant le podium, même partie clôturée', async () => {
    expect(await classement()).toBeNull();
    await clientService().from('evenements').update({ statut: 'termine' }).eq('id', evenement.id);
    expect(await classement()).toBeNull();
    await clientService().from('evenements').update({ statut: 'en_cours' }).eq('id', evenement.id);
  });

  it('ne publie rien pendant la révélation, ni si le podium est quitté trop tôt', async () => {
    await scene('podium');
    expect(await classement()).toBeNull();
    await scene('scores');
    await attendre(REVELATION_MS);
    expect(await classement()).toBeNull();
  });

  it('refuse à la régie d’écrire elle-même la publication', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    await anna
      .from('pilotage')
      .update({ podium_publie: [{ rang: 1, numero: 3, nom: 'Faux', points: 999 }] })
      .eq('evenement_id', evenement.id);
    expect(await classement()).toBeNull();
  });

  it('donne les rangs de l’écran une fois le podium montré, égalités signalées', async () => {
    await scene('podium');
    await attendre(REVELATION_MS);
    expect(await classement()).toEqual([
      { rang: 1, numero: 2, nom: 'Équipe 2', points: 300, ex_aequo: false },
      { rang: 2, numero: 1, nom: 'Équipe 1', points: 100, ex_aequo: true },
      { rang: 3, numero: 3, nom: 'Équipe 3', points: 100, ex_aequo: true },
    ]);
  });

  it('suit une correction tant que le podium est à l’écran', async () => {
    await marquer(3, 50);
    const lignes = await classement();
    expect(lignes!.map((l) => [l.numero, l.points])).toEqual([
      [2, 300],
      [3, 150],
      [1, 100],
    ]);
  });

  it('garde le dernier podium montré, sans les points marqués ensuite', async () => {
    await scene('accueil');
    await marquer(1, 1000);
    const lignes = await classement();
    expect(lignes!.map((l) => [l.rang, l.numero, l.points])).toEqual([
      [1, 2, 300],
      [2, 3, 150],
      [3, 1, 100],
    ]);
  });
});
