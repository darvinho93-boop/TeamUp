import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { appeler, baseDisponible, clientAnon, clientService, hacher } from './base';

const avecBase = describe.skipIf(!baseDisponible);

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ANNA = '22222222-2222-4222-8222-222222222222';
const crees: string[] = [];

function codeAleatoire(): string {
  return Array.from(randomBytes(6), (o) => ALPHABET[o % ALPHABET.length]).join('');
}

/** Un événement jetable, supprimé en fin de fichier (les équipes et joueurs suivent en cascade). */
async function creerEvenement(
  options: { equipes?: number; langues?: string[]; expire?: boolean } = {},
) {
  const service = clientService();
  const code = codeAleatoire();
  const { data, error } = await service
    .from('evenements')
    .insert({
      code,
      animateur_id: ANNA,
      client_nom: 'Test arrivée',
      date_evenement: new Date().toISOString().slice(0, 10),
      creneau_minutes: 40,
      langues: options.langues ?? ['fr', 'en'],
      statut: 'en_cours',
      code_expire_le: options.expire ? new Date(Date.now() - 60_000).toISOString() : null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const id = (data as { id: string }).id;
  crees.push(id);

  const equipes = Array.from({ length: options.equipes ?? 0 }, (_, i) => ({
    evenement_id: id,
    numero: i + 1,
    nom: `Équipe ${i + 1}`,
  }));
  if (equipes.length) {
    const { error: e } = await service.from('equipes').insert(equipes);
    if (e) throw new Error(e.message);
  }
  return { id, code };
}

interface Arrivee {
  prenom: string;
  equipe: { numero: number; nom: string } | null;
}

function rejoindre(code: string, n: number | string, langue = 'fr') {
  return appeler<Arrivee>(clientService(), 'rejoindre_evenement', {
    p_code: code,
    p_prenom: `Joueur ${n}`,
    p_langue: langue,
    p_jeton_hash: hacher(`arrivee-${code}-${n}`),
  });
}

afterAll(async () => {
  if (crees.length) await clientService().from('evenements').delete().in('id', crees);
});

avecBase("l'arrivée d'un joueur", () => {
  it("attribue tour à tour l'équipe la moins remplie", async () => {
    const { code } = await creerEvenement({ equipes: 3 });
    const numeros: number[] = [];
    for (let n = 1; n <= 7; n++) {
      const { data, erreur } = await rejoindre(code, n);
      expect(erreur).toBeNull();
      numeros.push(data!.equipe!.numero);
    }
    expect(numeros).toEqual([1, 2, 3, 1, 2, 3, 1]);
  });

  it("laisse le joueur sans équipe tant que l'événement n'en a pas", async () => {
    const { code } = await creerEvenement();
    const { data, erreur } = await rejoindre(code, 1);
    expect(erreur).toBeNull();
    expect(data?.equipe).toBeNull();
  });

  it('refuse une langue que l’événement ne propose pas', async () => {
    const { code } = await creerEvenement({ equipes: 2, langues: ['fr'] });
    const { erreur } = await rejoindre(code, 1, 'ta');
    expect(erreur).toMatch(/langue/);
  });

  it('refuse un code expiré, et ne le décrit pas', async () => {
    const { code } = await creerEvenement({ equipes: 2, expire: true });
    expect((await rejoindre(code, 1)).erreur).toMatch(/expiré/);
    const { data } = await appeler(clientService(), 'evenement_public', { p_code: code });
    expect(data).toBeNull();
  });

  it('150 arrivées simultanées : 150 joueurs, 25 par équipe, le 151ᵉ refusé', async () => {
    const { id, code } = await creerEvenement({ equipes: 6 });
    const resultats = await Promise.all(
      Array.from({ length: 150 }, (_, i) => rejoindre(code, i + 1)),
    );
    expect(resultats.filter((r) => r.erreur !== null)).toEqual([]);

    const { data: joueurs } = await clientService()
      .from('joueurs')
      .select('equipe_id')
      .eq('evenement_id', id);
    expect(joueurs).toHaveLength(150);
    const parEquipe = new Map<unknown, number>();
    for (const j of joueurs!)
      parEquipe.set(j['equipe_id'], (parEquipe.get(j['equipe_id']) ?? 0) + 1);
    expect([...parEquipe.values()]).toEqual([25, 25, 25, 25, 25, 25]);

    expect((await rejoindre(code, 151)).erreur).toMatch(/complet/);
  });
});

avecBase('avant de rejoindre', () => {
  it('un code ne révèle que son statut et ses langues', async () => {
    const { data } = await appeler(clientService(), 'evenement_public', { p_code: 'fete24' });
    expect(data).toEqual({ code: 'FETE24', langues: ['fr', 'en', 'ta'], statut: 'en_cours' });
  });

  it('un visiteur sans compte ne peut même pas demander', async () => {
    const { erreur } = await appeler(clientAnon(), 'evenement_public', { p_code: 'FETE24' });
    expect(erreur).toBeTruthy();
  });

  it('un code inconnu ne renvoie rien', async () => {
    const { data, erreur } = await appeler(clientService(), 'evenement_public', {
      p_code: 'ZZZZZZ',
    });
    expect(erreur).toBeNull();
    expect(data).toBeNull();
  });
});

avecBase("l'écran d'attente", () => {
  it('connaît le prochain jeu et marque le joueur comme vu', async () => {
    const service = clientService();
    const jeton = hacher('demo-joueur-2');
    const avant = await service.from('joueurs').select('vu_le').eq('jeton_hash', jeton).single();

    const { data } = await appeler<{ prochaine: { jeu: string } | null }>(service, 'pouls_joueur', {
      p_jeton_hash: jeton,
    });
    expect(data?.prochaine).toEqual({ jeu: 'enchere2', ordre: 3 });

    const apres = await service.from('joueurs').select('vu_le').eq('jeton_hash', jeton).single();
    expect(new Date(apres.data!['vu_le'] as string).getTime()).toBeGreaterThan(
      new Date(avant.data!['vu_le'] as string).getTime(),
    );
  });
});
