import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  appeler,
  baseDisponible,
  clientAnimateur,
  clientAnon,
  clientService,
  creerEvenementJetable,
  hacher,
  supprimerEvenements,
} from './base';

const avecBase = describe.skipIf(!baseDisponible);

interface AvisDuJoueur {
  positifs: string[];
  negatif: string | null;
  rien_a_redire: boolean;
  citable: boolean;
}
interface EtatJoueur {
  evenement: { avis_ouverts: boolean };
  avis: AvisDuJoueur | null;
}

let evenement: { id: string; code: string };
const jeton = (nom: string) => `avis-${evenement.id}-${nom}`;

async function ajouterJoueur(nom: string, telephone = true) {
  const service = clientService();
  const { data: eq } = await service
    .from('equipes')
    .select('id')
    .eq('evenement_id', evenement.id)
    .eq('numero', 1)
    .single();
  const { error } = await service.from('joueurs').insert({
    evenement_id: evenement.id,
    equipe_id: eq!['id'] as string,
    prenom: nom,
    langue: nom === 'Kavin' ? 'ta' : 'fr',
    jeton_hash: telephone ? hacher(jeton(nom)) : null,
  });
  if (error) throw new Error(error.message);
}

const donner = (
  nom: string,
  avis: { positifs: string[]; negatif?: string | null; rien?: boolean; citable?: boolean },
) =>
  appeler<{ evenement_id: string }>(clientService(), 'donner_avis', {
    p_jeton_hash: hacher(jeton(nom)),
    p_positifs: avis.positifs,
    p_negatif: avis.negatif ?? null,
    p_rien_a_redire: avis.rien ?? false,
    p_citable: avis.citable ?? false,
  });

async function etatJoueur(nom: string): Promise<EtatJoueur> {
  const { data, erreur } = await appeler<EtatJoueur>(clientService(), 'etat_joueur', {
    p_jeton_hash: hacher(jeton(nom)),
  });
  if (erreur) throw new Error(erreur);
  return data!;
}

async function regler(ouverts: boolean) {
  const anna = await clientAnimateur('anna@teamup.test');
  const { erreur } = await appeler(anna, 'regler_avis', {
    p_evenement: evenement.id,
    p_ouverts: ouverts,
  });
  if (erreur) throw new Error(erreur);
}

async function lireAvis() {
  const anna = await clientAnimateur('anna@teamup.test');
  const { data, error } = await anna
    .from('avis_joueurs')
    .select('joueur_id, positifs, negatif, rien_a_redire, citable, prenom, langue')
    .eq('evenement_id', evenement.id)
    .order('cree_le');
  if (error) throw new Error(error.message);
  return data;
}

beforeAll(async () => {
  if (!baseDisponible) return;
  evenement = await creerEvenementJetable({ equipes: 2 });
  for (const nom of ['Camille', 'Malo', 'Kavin', 'Sacha']) await ajouterJoueur(nom);
  await ajouterJoueur('Mamie', false);
});

afterAll(async () => {
  if (baseDisponible) await supprimerEvenements([evenement.id]);
});

avecBase('avis des joueurs', () => {
  it('fermés par défaut : refusé, et le téléphone le sait', async () => {
    expect((await etatJoueur('Camille')).evenement.avis_ouverts).toBe(false);
    const { erreur } = await donner('Camille', { positifs: ['Tout'], rien: true });
    expect(erreur).toMatch(/avis fermés/);
  });

  it('la régie ouvre sans toucher à la version du pilotage', async () => {
    const service = clientService();
    const lire = async () =>
      (
        await service
          .from('pilotage')
          .select('maj_le, avis_ouverts')
          .eq('evenement_id', evenement.id)
          .single()
      ).data!;
    const avant = await lire();
    await regler(true);
    const apres = await lire();
    expect(apres.avis_ouverts).toBe(true);
    expect(apres.maj_le).toBe(avant.maj_le);
    expect((await etatJoueur('Camille')).evenement.avis_ouverts).toBe(true);
  });

  it('un avis anonyme, nettoyé ; le téléphone ne voit que le sien', async () => {
    const { data, erreur } = await donner('Camille', {
      positifs: ['  Les   jeux ', '', 'Le\npodium'],
      negatif: '  Le son\r\n\r\n\r\ntrop fort  ',
    });
    expect(erreur).toBeNull();
    expect(data!.evenement_id).toBe(evenement.id);

    expect((await etatJoueur('Camille')).avis).toEqual({
      positifs: ['Les jeux', 'Le podium'],
      negatif: 'Le son\n\ntrop fort',
      rien_a_redire: false,
      citable: false,
    });
    expect((await etatJoueur('Malo')).avis).toBeNull();

    const [avis] = await lireAvis();
    expect(avis).toMatchObject({ prenom: null, citable: false, langue: 'fr' });
  });

  it('le dernier envoi remplace le précédent ; citable : le prénom est recopié', async () => {
    expect(
      (await donner('Camille', { positifs: ['Les jeux'], negatif: 'Le son' })).erreur,
    ).toBeNull();
    expect(
      (await donner('Camille', { positifs: ["L'ambiance"], rien: true, citable: true })).erreur,
    ).toBeNull();
    const avis = await lireAvis();
    expect(avis).toHaveLength(1);
    expect(avis[0]).toMatchObject({
      positifs: ["L'ambiance"],
      negatif: null,
      rien_a_redire: true,
      citable: true,
      prenom: 'Camille',
    });

    // Plus citable : le prénom repart.
    await donner('Camille', { positifs: ["L'ambiance"], rien: true, citable: false });
    expect((await lireAvis())[0]).toMatchObject({ citable: false, prenom: null });
  });

  it('refuse les textes invalides', async () => {
    const refus = /avis invalide/;
    expect((await donner('Malo', { positifs: [], rien: true })).erreur).toMatch(refus);
    expect((await donner('Malo', { positifs: [' ', ''], rien: true })).erreur).toMatch(refus);
    expect((await donner('Malo', { positifs: ['a', 'b', 'c', 'd'], rien: true })).erreur).toMatch(
      refus,
    );
    expect((await donner('Malo', { positifs: ['x'.repeat(201)], rien: true })).erreur).toMatch(
      refus,
    );
    // Ni « rien à redire » ni texte : il manque la seconde partie.
    expect((await donner('Malo', { positifs: ['Tout'], negatif: ' ' })).erreur).toMatch(refus);
    expect((await donner('Malo', { positifs: ['Tout'], negatif: 'x'.repeat(501) })).erreur).toMatch(
      refus,
    );
    // « Rien à redire » l'emporte sur un texte envoyé par erreur.
    expect(
      (await donner('Malo', { positifs: ['Tout'], negatif: 'Oups', rien: true })).erreur,
    ).toBeNull();
    expect((await etatJoueur('Malo')).avis).toMatchObject({ negatif: null, rien_a_redire: true });
  });

  it('refuse une session inconnue ; un invité sans téléphone n’a pas de session', async () => {
    expect((await donner('Personne', { positifs: ['Tout'], rien: true })).erreur).toMatch(
      /session inconnue/,
    );
    expect((await donner('Mamie', { positifs: ['Tout'], rien: true })).erreur).toMatch(
      /session inconnue/,
    );
  });

  it('la langue du joueur suit l’avis ; partie terminée : toujours accepté', async () => {
    const service = clientService();
    await service.from('evenements').update({ statut: 'termine' }).eq('id', evenement.id);
    try {
      expect((await donner('Kavin', { positifs: ['எல்லாம்'], rien: true })).erreur).toBeNull();
    } finally {
      await service.from('evenements').update({ statut: 'en_cours' }).eq('id', evenement.id);
    }
    const kavin = (await lireAvis()).find((a) => a.positifs[0] === 'எல்லாம்');
    expect(kavin?.langue).toBe('ta');
  });

  it('l’écran et la régie comptent les avis reçus', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const { data } = await appeler<{ avis: { ouverts: boolean; recus: number } }>(
      anna,
      'etat_ecran',
      { p_code: evenement.code, p_regie: false },
    );
    expect(data!.avis).toEqual({ ouverts: true, recus: 3 });
  });

  it('aucune écriture directe ; un autre animateur et la clé anon ne lisent rien', async () => {
    const anon = clientAnon();
    expect(
      (
        await anon.from('avis_joueurs').insert({
          evenement_id: evenement.id,
          positifs: ['x'],
          rien_a_redire: true,
          langue: 'fr',
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await appeler(anon, 'donner_avis', {
          p_jeton_hash: hacher(jeton('Sacha')),
          p_positifs: ['x'],
          p_negatif: null,
          p_rien_a_redire: true,
          p_citable: false,
        })
      ).erreur,
    ).not.toBeNull();

    const anna = await clientAnimateur('anna@teamup.test');
    expect(
      (
        await anna.from('avis_joueurs').insert({
          evenement_id: evenement.id,
          positifs: ['x'],
          rien_a_redire: true,
          langue: 'fr',
        })
      ).error,
    ).not.toBeNull();

    const brahim = await clientAnimateur('brahim@teamup.test');
    const { data: lus } = await brahim
      .from('avis_joueurs')
      .select('id')
      .eq('evenement_id', evenement.id);
    expect(lus).toEqual([]);
    // La policy du pilotage : Brahim n'ouvre ni ne ferme les avis d'Anna.
    await appeler(brahim, 'regler_avis', { p_evenement: evenement.id, p_ouverts: false });
    expect((await etatJoueur('Sacha')).evenement.avis_ouverts).toBe(true);
  });

  it('un joueur retiré : son avis reste, sans lien vers lui', async () => {
    const service = clientService();
    await service.from('joueurs').delete().eq('evenement_id', evenement.id).eq('prenom', 'Malo');
    const avis = await lireAvis();
    expect(avis).toHaveLength(3);
    expect(avis.filter((a) => a.joueur_id === null)).toHaveLength(1);
  });

  it('fermés de nouveau : refusé, l’avis déjà donné reste lisible', async () => {
    await regler(false);
    expect((await donner('Sacha', { positifs: ['Tout'], rien: true })).erreur).toMatch(
      /avis fermés/,
    );
    expect((await etatJoueur('Camille')).avis).not.toBeNull();
  });
});
