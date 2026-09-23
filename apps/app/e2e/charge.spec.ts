import { expect, request, test } from '@playwright/test';
import { clientService, creerEvenementJetable, supprimerEvenements } from '../tests/base';

const JOUEURS = 150;

let evenement: { id: string; code: string };

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 6 });
});

test.afterAll(() => supprimerEvenements([evenement.id]));

test(`${JOUEURS} joueurs simulés rejoignent le même événement`, async ({ baseURL }) => {
  test.setTimeout(180_000);

  // 150 téléphones : un contexte de requêtes chacun, donc un cookie de session chacun.
  const telephones = await Promise.all(
    Array.from({ length: JOUEURS + 1 }, () => request.newContext({ baseURL: baseURL! })),
  );
  const arrivee = (i: number) =>
    telephones[i]!.post(`/api/partie/${evenement.code}/rejoindre`, {
      data: { prenom: `Invité ${i + 1}`, langue: i % 2 ? 'en' : 'fr' },
    });

  try {
    const debut = Date.now();
    const reponses = await Promise.all(telephones.slice(0, JOUEURS).map((_, i) => arrivee(i)));
    const duree = Date.now() - debut;
    const statuts = reponses.map((r) => r.status());
    expect(
      statuts.filter((s) => s !== 200),
      `statuts : ${statuts.join(',')}`,
    ).toEqual([]);
    test
      .info()
      .annotations.push({ type: 'durée', description: `${JOUEURS} arrivées en ${duree} ms` });

    // En base : 150 joueurs, 25 par équipe.
    const { data: joueurs } = await clientService()
      .from('joueurs')
      .select('equipe_id')
      .eq('evenement_id', evenement.id);
    expect(joueurs).toHaveLength(JOUEURS);
    const parEquipe = new Map<unknown, number>();
    for (const j of joueurs!) {
      parEquipe.set(j['equipe_id'], (parEquipe.get(j['equipe_id']) ?? 0) + 1);
    }
    expect([...parEquipe.values()]).toEqual(Array(6).fill(JOUEURS / 6));

    // Le 151ᵉ trouve la partie complète.
    expect((await arrivee(JOUEURS)).status()).toBe(409);

    // Chacun retrouve sa session avec son seul cookie, et personne celle d'un autre.
    const etats = await Promise.all(
      telephones.slice(0, JOUEURS).map(async (t) => {
        const r = await t.get(`/api/partie/${evenement.code}/etat`);
        expect(r.status()).toBe(200);
        return ((await r.json()) as { joueur: { prenom: string } }).joueur.prenom;
      }),
    );
    expect(etats).toEqual(Array.from({ length: JOUEURS }, (_, i) => `Invité ${i + 1}`));
  } finally {
    await Promise.all(telephones.map((t) => t.dispose()));
  }
});
