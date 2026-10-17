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

interface Ajout {
  joueur_id: string;
  prenom: string;
  langue: string;
  equipe: { id: string; numero: number } | null;
}

const crees: string[] = [];
let evenement: { id: string; code: string };
const jeton = (nom: string) => `invites-${evenement.id}-${nom}`;

beforeAll(async () => {
  if (!baseDisponible) return;
  evenement = await creerEvenementJetable({ equipes: 3, langues: ['en', 'fr'] });
  crees.push(evenement.id);
  // Paul arrive avec son téléphone, en français ; Rita aussi, sans autorisation.
  for (const nom of ['Paul', 'Rita']) {
    const { erreur } = await appeler(clientService(), 'rejoindre_evenement', {
      p_code: evenement.code,
      p_prenom: nom,
      p_langue: 'fr',
      p_jeton_hash: hacher(jeton(nom)),
    });
    if (erreur) throw new Error(erreur);
  }
});

afterAll(() => supprimerEvenements(crees));

async function autoriser(nom: string, oui = true) {
  const client = await clientAnimateur('anna@teamup.test');
  const { error } = await client
    .from('joueurs')
    .update({ peut_ajouter: oui })
    .eq('evenement_id', evenement.id)
    .eq('prenom', nom);
  if (error) throw new Error(error.message);
}

const ajouterDepuis = (nom: string, prenom: string, groupe?: string) =>
  appeler<Ajout>(clientService(), 'ajouter_invite', {
    p_jeton_parrain: hacher(jeton(nom)),
    p_prenom: prenom,
    ...(groupe ? { p_groupe: groupe } : {}),
  });

async function joueur(id: string) {
  const { data } = await clientService()
    .from('joueurs')
    .select('prenom, jeton_hash, sans_telephone, equipe_id')
    .eq('id', id)
    .single();
  return data as {
    prenom: string;
    jeton_hash: string | null;
    sans_telephone: boolean;
    equipe_id: string | null;
  };
}

avecBase('un joueur ajoute un invité depuis son téléphone', () => {
  it('refuse tant que la régie ne l’a pas autorisé', async () => {
    expect((await ajouterDepuis('Rita', 'Léa')).erreur).toMatch(/non autorisé/);
  });

  it('refuse une session inconnue', async () => {
    expect((await ajouterDepuis('Personne', 'Léa')).erreur).toMatch(/session inconnue/);
  });

  it('une fois autorisé : un invité sans téléphone, dans une équipe, à la langue du parrain', async () => {
    await autoriser('Paul');
    const { data, erreur } = await ajouterDepuis('Paul', '  Léa ');
    expect(erreur).toBeNull();
    expect(data).toMatchObject({ prenom: 'Léa', langue: 'fr' });
    expect(data!.equipe).not.toBeNull();
    expect(await joueur(data!.joueur_id)).toMatchObject({
      jeton_hash: null,
      sans_telephone: true,
    });
  });

  it('tire l’équipe comme à l’arrivée : la moins remplie', async () => {
    // Paul, Rita et Léa occupent les équipes 1, 2 et 3 : le suivant revient en 1.
    const { data } = await ajouterDepuis('Paul', 'Marc');
    expect(data!.equipe?.numero).toBe(1);
  });

  it('le téléphone du parrain sait qu’il peut ajouter', async () => {
    const { data } = await appeler<{ joueur: { peut_ajouter: boolean } }>(
      clientService(),
      'etat_joueur',
      { p_jeton_hash: hacher(jeton('Paul')) },
    );
    expect(data!.joueur.peut_ajouter).toBe(true);
  });

  it('refuse sans le rôle de service', async () => {
    const client = await clientAnimateur('anna@teamup.test');
    const { erreur } = await appeler(client, 'ajouter_invite', {
      p_jeton_parrain: hacher(jeton('Paul')),
      p_prenom: 'Intrus',
    });
    expect(erreur).toMatch(/permission denied/);
  });

  it('refuse à nouveau une fois l’autorisation retirée', async () => {
    await autoriser('Paul', false);
    expect((await ajouterDepuis('Paul', 'Nina')).erreur).toMatch(/non autorisé/);
  });
});

avecBase('l’animateur ajoute un invité depuis la régie', () => {
  it('ajoute dans sa soirée, à la première langue', async () => {
    const client = await clientAnimateur('anna@teamup.test');
    const { data, erreur } = await appeler<Ajout>(client, 'ajouter_invite_regie', {
      p_evenement: evenement.id,
      p_prenom: 'Odile',
    });
    expect(erreur).toBeNull();
    expect(data).toMatchObject({ prenom: 'Odile', langue: 'en' });
    expect((await joueur(data!.joueur_id)).sans_telephone).toBe(true);
  });

  it('refuse un animateur d’une autre soirée', async () => {
    const client = await clientAnimateur('brahim@teamup.test');
    const { erreur } = await appeler(client, 'ajouter_invite_regie', {
      p_evenement: evenement.id,
      p_prenom: 'Intrus',
    });
    expect(erreur).toMatch(/inconnu/);
  });

  it('tient compte des groupes de la soirée', async () => {
    const { data: groupes } = await clientService()
      .from('groupes')
      .insert({ evenement_id: evenement.id, ordre: 1, nom: 'Famille' })
      .select('id')
      .single();
    const groupe = (groupes as { id: string }).id;
    const client = await clientAnimateur('anna@teamup.test');
    const { erreur } = await appeler(client, 'ajouter_invite_regie', {
      p_evenement: evenement.id,
      p_prenom: 'Yves',
      p_groupe: groupe,
    });
    expect(erreur).toBeNull();
    const { data: compteurs } = await clientService()
      .from('equipes_groupes')
      .select('effectif')
      .eq('groupe_id', groupe);
    expect(compteurs).toEqual([{ effectif: 1 }]);
  });
});

avecBase('un invité sans téléphone', () => {
  async function unInvite() {
    const { data } = await appeler<Ajout>(
      await clientAnimateur('anna@teamup.test'),
      'ajouter_invite_regie',
      { p_evenement: evenement.id, p_prenom: `Sans ${Math.random()}`.slice(0, 20) },
    );
    return data!.joueur_id;
  }

  it('n’est jamais capitaine ni autorisé à ajouter', async () => {
    const id = await unInvite();
    const client = await clientAnimateur('anna@teamup.test');
    const capitaine = await client.from('joueurs').update({ capitaine: true }).eq('id', id);
    expect(capitaine.error?.message).toMatch(/joueurs_capitaine_avec_telephone/);
    const ajout = await client.from('joueurs').update({ peut_ajouter: true }).eq('id', id);
    expect(ajout.error?.message).toMatch(/joueurs_ajout_avec_telephone/);
  });

  it('regarde le quiz en mode téléphone, sans compter pour ni contre son équipe', async () => {
    const id = await unInvite();
    const { data: manche } = await clientService()
      .from('manches')
      .insert({ evenement_id: evenement.id, jeu: 'qcm2', ordre: 1, options: { questions: 3 } })
      .select('id')
      .single();
    const client = await clientAnimateur('anna@teamup.test');
    const { data } = await appeler<{ joueur_id: string }[]>(client, 'quiz_joueurs', {
      p_manche: (manche as { id: string }).id,
    });
    const ids = data!.map((l) => l.joueur_id);
    expect(ids).not.toContain(id);
    expect(ids.length).toBeGreaterThan(0);
  });

  it('l’arrivée par le QR code exige toujours une session', async () => {
    const { erreur } = await appeler(clientService(), 'rejoindre_evenement', {
      p_code: evenement.code,
      p_prenom: 'Sans jeton',
      p_langue: 'fr',
      p_jeton_hash: null,
    });
    expect(erreur).toMatch(/session obligatoire/);
  });
});

avecBase('la limite de 150', () => {
  it('compte les invités ajoutés', async () => {
    const pleine = await creerEvenementJetable({ equipes: 2 });
    crees.push(pleine.id);
    const { error } = await clientService()
      .from('joueurs')
      .insert(
        Array.from({ length: 150 }, (_, i) => ({
          evenement_id: pleine.id,
          prenom: `J${i}`,
          langue: 'fr',
          jeton_hash: null,
        })),
      );
    expect(error).toBeNull();
    const { erreur } = await appeler(
      await clientAnimateur('anna@teamup.test'),
      'ajouter_invite_regie',
      {
        p_evenement: pleine.id,
        p_prenom: 'De trop',
      },
    );
    expect(erreur).toMatch(/complet/);
  });
});
