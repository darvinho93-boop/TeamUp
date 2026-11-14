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

interface Message {
  id: string;
  prenom: string | null;
  regie: boolean;
  equipe: number | null;
  texte: string;
  cree_ms: number;
  retire: boolean;
}
interface Etat {
  messages_ouverts: boolean;
  messages: Message[];
}

let evenement: { id: string; code: string };
const jeton = (nom: string) => `message-${evenement.id}-${nom}`;

async function ajouterJoueur(nom: string) {
  const service = clientService();
  const { data: eq } = await service
    .from('equipes')
    .select('id')
    .eq('evenement_id', evenement.id)
    .eq('numero', 2)
    .single();
  const { error } = await service.from('joueurs').insert({
    evenement_id: evenement.id,
    equipe_id: eq!['id'] as string,
    prenom: nom,
    langue: 'fr',
    jeton_hash: hacher(jeton(nom)),
  });
  if (error) throw new Error(error.message);
}

const envoyer = (nom: string, texte: string) =>
  appeler<{ id: string; evenement_id: string }>(clientService(), 'envoyer_message', {
    p_jeton_hash: hacher(jeton(nom)),
    p_texte: texte,
  });

async function etat(regie: boolean): Promise<Etat> {
  const anna = await clientAnimateur('anna@teamup.test');
  const { data, erreur } = await appeler<Etat>(anna, 'etat_ecran', {
    p_code: evenement.code,
    p_regie: regie,
  });
  if (erreur) throw new Error(erreur);
  return data!;
}

beforeAll(async () => {
  if (!baseDisponible) return;
  evenement = await creerEvenementJetable({ equipes: 3 });
  for (const nom of ['Camille', 'Malo', 'Inès', 'Sacha']) await ajouterJoueur(nom);
});

afterAll(async () => {
  if (baseDisponible) await supprimerEvenements([evenement.id]);
});

avecBase('messages sur le grand écran', () => {
  it('un joueur écrit : le message paraît à l’écran, nettoyé, avec son prénom et son équipe', async () => {
    const { data, erreur } = await envoyer('Camille', '  Vive\nles   mariés ! 🎉  ');
    expect(erreur).toBeNull();
    expect(data!.evenement_id).toBe(evenement.id);

    const { messages, messages_ouverts } = await etat(false);
    expect(messages_ouverts).toBe(true);
    expect(messages).toEqual([
      expect.objectContaining({
        id: data!.id,
        prenom: 'Camille',
        regie: false,
        equipe: 2,
        texte: 'Vive les mariés ! 🎉',
        retire: false,
      }),
    ]);
  });

  it('refuse une session inconnue, un texte vide ou trop long', async () => {
    expect((await envoyer('Personne', 'Coucou')).erreur).toMatch(/session inconnue/);
    expect((await envoyer('Malo', ' \n ')).erreur).toMatch(/message invalide/);
    expect((await envoyer('Malo', 'x'.repeat(101))).erreur).toMatch(/message invalide/);
    expect((await envoyer('Malo', 'x'.repeat(100))).erreur).toBeNull();
  });

  it('un message toutes les 20 s par joueur, le temps restant dans le refus', async () => {
    expect((await envoyer('Inès', 'Premier')).erreur).toBeNull();
    const { erreur } = await envoyer('Inès', 'Second');
    expect(erreur).toMatch(/^trop tôt:(19|20)$/);
    // Un autre joueur n'attend pas.
    expect((await envoyer('Sacha', 'Moi aussi')).erreur).toBeNull();
  });

  it('la régie écrit sous « Team Up! », retire et remet un message', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const { data: id, erreur } = await appeler<string>(anna, 'envoyer_message_regie', {
      p_evenement: evenement.id,
      p_texte: 'Place au Quiz !',
    });
    expect(erreur).toBeNull();

    const ecran = await etat(false);
    const regie = ecran.messages.find((m) => m.id === id)!;
    expect(regie).toMatchObject({ regie: true, prenom: null, equipe: null });

    const camille = ecran.messages.find((m) => m.prenom === 'Camille')!;
    expect(
      (await appeler(anna, 'retirer_message', { p_message: camille.id, p_retire: true })).erreur,
    ).toBeNull();
    // Retiré : plus à l'écran, toujours à la régie, marqué.
    expect((await etat(false)).messages.some((m) => m.id === camille.id)).toBe(false);
    expect((await etat(true)).messages.find((m) => m.id === camille.id)?.retire).toBe(true);

    await appeler(anna, 'retirer_message', { p_message: camille.id, p_retire: false });
    expect((await etat(false)).messages.some((m) => m.id === camille.id)).toBe(true);
  });

  it('envois fermés : le joueur est refusé, la régie écrit toujours, le téléphone le sait', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    await appeler(anna, 'regler_messages', { p_evenement: evenement.id, p_ouverts: false });
    try {
      expect((await envoyer('Malo', 'Fermé ?')).erreur).toMatch(/messages fermés/);
      const { data } = await appeler<{ evenement: { messages_ouverts: boolean } }>(
        clientService(),
        'etat_joueur',
        { p_jeton_hash: hacher(jeton('Malo')) },
      );
      expect(data!.evenement.messages_ouverts).toBe(false);
      expect((await etat(false)).messages_ouverts).toBe(false);
      expect(
        (
          await appeler(anna, 'envoyer_message_regie', {
            p_evenement: evenement.id,
            p_texte: 'Toujours là',
          })
        ).erreur,
      ).toBeNull();
    } finally {
      await appeler(anna, 'regler_messages', { p_evenement: evenement.id, p_ouverts: true });
    }
  });

  it('partie terminée : plus aucun envoi de joueur', async () => {
    const service = clientService();
    await service.from('evenements').update({ statut: 'termine' }).eq('id', evenement.id);
    try {
      expect((await envoyer('Sacha', 'Encore')).erreur).toMatch(/partie terminée/);
    } finally {
      await service.from('evenements').update({ statut: 'en_cours' }).eq('id', evenement.id);
    }
  });

  it('aucune écriture directe ; un autre animateur ne lit, n’écrit ni ne retire rien', async () => {
    const anon = clientAnon();
    const { error: insertion } = await anon
      .from('messages_salle')
      .insert({ evenement_id: evenement.id, prenom: 'Intrus', texte: 'Coucou' });
    expect(insertion).not.toBeNull();
    expect(
      (
        await appeler(anon, 'envoyer_message', {
          p_jeton_hash: hacher(jeton('Malo')),
          p_texte: 'x',
        })
      ).erreur,
    ).not.toBeNull();

    const anna = await clientAnimateur('anna@teamup.test');
    const { error: directe } = await anna
      .from('messages_salle')
      .insert({ evenement_id: evenement.id, regie: true, texte: 'En direct' });
    expect(directe).not.toBeNull();

    const brahim = await clientAnimateur('brahim@teamup.test');
    const { data: lus } = await brahim
      .from('messages_salle')
      .select('id')
      .eq('evenement_id', evenement.id);
    expect(lus).toEqual([]);
    expect(
      (
        await appeler(brahim, 'envoyer_message_regie', {
          p_evenement: evenement.id,
          p_texte: 'Pas chez moi',
        })
      ).erreur,
    ).toMatch(/accès refusé/);
    const un = (await etat(true)).messages[0]!;
    expect((await appeler(brahim, 'retirer_message', { p_message: un.id })).erreur).toMatch(
      /accès refusé/,
    );
  });

  it('un joueur retiré : son message reste, sous son prénom', async () => {
    const service = clientService();
    await service.from('joueurs').delete().eq('evenement_id', evenement.id).eq('prenom', 'Sacha');
    const sacha = (await etat(false)).messages.find((m) => m.prenom === 'Sacha');
    expect(sacha?.texte).toBe('Moi aussi');
  });
});
