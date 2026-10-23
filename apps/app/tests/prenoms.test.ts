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

const avecBase = describe.skipIf(!baseDisponible);

const crees: string[] = [];
let evenement: { id: string; code: string };
let autre: { id: string; code: string };

const arriver = (code: string, prenom: string) =>
  appeler(clientService(), 'rejoindre_evenement', {
    p_code: code,
    p_prenom: prenom,
    p_langue: 'fr',
    p_jeton_hash: hacher(`prenoms-${code}-${prenom}-${Math.random()}`),
  });

const disponible = (code: string, prenom: string) =>
  appeler<boolean>(clientService(), 'prenom_disponible', { p_code: code, p_prenom: prenom });

beforeAll(async () => {
  if (!baseDisponible) return;
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
  autre = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
  crees.push(evenement.id, autre.id);
  const { erreur } = await arriver(evenement.code, 'Léa');
  if (erreur) throw new Error(erreur);
});

afterAll(() => supprimerEvenements(crees));

avecBase('deux joueurs d’une soirée n’ont jamais le même prénom (2026-10-23)', () => {
  it('refuse le même prénom, sans casse, sans accents ni espaces superflus', async () => {
    for (const prenom of ['Léa', 'lea', '  LÉA ', 'Lea']) {
      expect((await arriver(evenement.code, prenom)).erreur).toMatch(/déjà pris/);
    }
  });

  it('accepte un prénom proche, et le même prénom dans une autre soirée', async () => {
    expect((await arriver(evenement.code, 'Léa M.')).erreur).toBeNull();
    expect((await arriver(evenement.code, 'Léandre')).erreur).toBeNull();
    expect((await arriver(autre.code, 'Léa')).erreur).toBeNull();
  });

  it('le dit au téléphone avant l’arrivée', async () => {
    expect((await disponible(evenement.code, 'LEA')).data).toBe(false);
    expect((await disponible(evenement.code, 'Zoé')).data).toBe(true);
  });

  it('vaut aussi pour un invité ajouté par la régie', async () => {
    const regie = await clientAnimateur('anna@teamup.test');
    const { erreur } = await appeler(regie, 'ajouter_invite_regie', {
      p_evenement: evenement.id,
      p_prenom: 'léandre',
    });
    expect(erreur).toMatch(/déjà pris/);
  });

  it('ne s’ouvre pas aux clés publiques', async () => {
    const regie = await clientAnimateur('anna@teamup.test');
    const { erreur } = await appeler(regie, 'prenom_disponible', {
      p_code: evenement.code,
      p_prenom: 'x',
    });
    expect(erreur).not.toBeNull();
  });
});
