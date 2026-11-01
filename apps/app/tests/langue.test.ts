import { afterAll, describe, expect, it } from 'vitest';
import {
  appeler,
  baseDisponible,
  clientAnon,
  clientService,
  creerEvenementJetable,
  hacher,
  supprimerEvenements,
} from './base';

const avecBase = describe.skipIf(!baseDisponible);

const crees: string[] = [];
afterAll(() => supprimerEvenements(crees));

const changer = (jeton: string, langue: string, client = clientService()) =>
  appeler<{ langue: string }>(client, 'changer_langue', {
    p_jeton_hash: hacher(jeton),
    p_langue: langue,
  });

async function langueDe(jeton: string) {
  const { data } = await clientService()
    .from('joueurs')
    .select('langue')
    .eq('jeton_hash', hacher(jeton))
    .single();
  return (data as { langue: string }).langue;
}

avecBase('le changement de langue en cours de soirée', () => {
  it('passe le joueur dans une autre langue de la soirée, pas dans une autre', async () => {
    const { id, code } = await creerEvenementJetable({ equipes: 1, langues: ['fr', 'ta'] });
    crees.push(id);
    const jeton = `langue-${code}`;
    const { erreur } = await appeler(clientService(), 'rejoindre_evenement', {
      p_code: code,
      p_prenom: 'Kavya',
      p_langue: 'fr',
      p_jeton_hash: hacher(jeton),
    });
    expect(erreur).toBeNull();

    expect((await changer(jeton, 'ta')).erreur).toBeNull();
    expect(await langueDe(jeton)).toBe('ta');

    expect((await changer(jeton, 'en')).erreur).toMatch(/non proposée/);
    expect(await langueDe(jeton)).toBe('ta');
  });

  it('refuse une session inconnue et la clé anon', async () => {
    expect((await changer('personne', 'fr')).erreur).toMatch(/session/);
    expect((await changer('personne', 'fr', clientAnon())).erreur).not.toBeNull();
  });
});
