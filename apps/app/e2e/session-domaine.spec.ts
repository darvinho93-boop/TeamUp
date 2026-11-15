import { request as requeteHttp } from 'node:http';
import { expect, test } from '@playwright/test';
import { creerEvenementJetable, supprimerEvenements } from '../tests/base';

/**
 * Lot 15 (2026-11-15) : la session posée à l'arrivée vaut pour tout `teamup-game.fr`. Un invité
 * inscrit en ligne (`app.`) est donc reconnu sur la machine de la salle (`soiree.`). Sur une autre
 * adresse (le poste, le réseau local), elle reste attachée à l'adresse seule.
 */

let evenement: { id: string; code: string };

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
});

test.afterAll(() => supprimerEvenements([evenement.id]));

/** Une arrivée envoyée au serveur sous l'adresse donnée (en-tête `Host`) : son `Set-Cookie`. */
function arriverSous(hote: string, prenom: string, port: number): Promise<string[]> {
  const corps = JSON.stringify({ prenom, langue: 'fr' });
  return new Promise((ok, ko) => {
    const req = requeteHttp(
      {
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: `/api/partie/${evenement.code}/rejoindre`,
        headers: {
          host: hote,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(corps),
        },
      },
      (res) => {
        res.resume();
        if (res.statusCode !== 200) ko(new Error(`statut ${res.statusCode}`));
        else ok(res.headers['set-cookie'] ?? []);
      },
    );
    req.on('error', ko);
    req.end(corps);
  });
}

test('la session est posée pour teamup-game.fr, trente jours ; ailleurs pour l’adresse seule', async ({
  baseURL,
}) => {
  const port = Number(new URL(baseURL!).port);
  const session = (cookies: string[]) =>
    cookies.find((c) => c.startsWith(`tu_j_${evenement.code}=`));

  const machine = session(await arriverSous('soiree.teamup-game.fr', 'Inès', port));
  expect(machine).toBeDefined();
  expect(machine).toMatch(/Domain=teamup-game\.fr/i);
  expect(machine).toMatch(/Max-Age=2592000/i);
  expect(machine).toMatch(/HttpOnly/i);

  const poste = session(await arriverSous(`localhost:${port}`, 'Iris', port));
  expect(poste).toBeDefined();
  expect(poste).not.toMatch(/Domain=/i);
});
