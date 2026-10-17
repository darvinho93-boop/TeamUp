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

let evenement: { id: string; code: string };
let equipe: string;

beforeAll(async () => {
  if (!baseDisponible) return;
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
  const { data } = await clientService()
    .from('equipes')
    .select('id')
    .eq('evenement_id', evenement.id)
    .eq('numero', 1)
    .single();
  equipe = (data as { id: string }).id;
});

afterAll(() => (baseDisponible ? supprimerEvenements([evenement.id]) : undefined));

let compteur = 0;

/** Un joueur avec téléphone dans l'équipe 1, capitaine ou non. */
async function joueur(prenom: string, capitaine = false) {
  compteur += 1;
  const { data, error } = await clientService()
    .from('joueurs')
    .insert({
      evenement_id: evenement.id,
      equipe_id: equipe,
      prenom,
      langue: 'fr',
      capitaine,
      jeton_hash: hacher(`salle-${evenement.id}-${compteur}`),
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

async function pilotage() {
  const { data } = await clientService()
    .from('pilotage')
    .select('membres_mode, maj_le')
    .eq('evenement_id', evenement.id)
    .single();
  return data as { membres_mode: string; maj_le: string };
}

avecBase('la Salle : capitaine et retrait', () => {
  it('destitue un capitaine sans en nommer d’autre', async () => {
    const id = await joueur('Cyril', true);
    const anna = await clientAnimateur('anna@teamup.test');
    const { error } = await anna.from('joueurs').update({ capitaine: false }).eq('id', id);
    expect(error).toBeNull();
    const { data } = await appeler<{ equipes: { numero: number; capitaine: string | null }[] }>(
      anna,
      'etat_ecran',
      { p_code: evenement.code },
    );
    expect(data!.equipes.find((e) => e.numero === 1)?.capitaine).toBeNull();
  });

  it('retire un joueur avec ses réponses au quiz', async () => {
    const id = await joueur('Rémi');
    const service = clientService();
    const { data: manche } = await service
      .from('manches')
      .insert({ evenement_id: evenement.id, jeu: 'qcm2', ordre: 1, options: {} })
      .select('id')
      .single();
    const { data: passage } = await service
      .from('passages')
      .insert({ manche_id: manche!['id'], evenement_id: evenement.id, ordre: 1 })
      .select('id')
      .single();
    const { error: e1 } = await service.from('reponses_quiz').insert({
      passage_id: passage!['id'],
      evenement_id: evenement.id,
      joueur_id: id,
      choix: 1,
    });
    expect(e1).toBeNull();

    const anna = await clientAnimateur('anna@teamup.test');
    const { error } = await anna.from('joueurs').delete().eq('id', id);
    expect(error).toBeNull();
    const { count: joueurs } = await service
      .from('joueurs')
      .select('id', { count: 'exact', head: true })
      .eq('id', id);
    const { count: reponses } = await service
      .from('reponses_quiz')
      .select('joueur_id', { count: 'exact', head: true })
      .eq('joueur_id', id);
    expect([joueurs, reponses]).toEqual([0, 0]);
  });

  it('un animateur d’une autre soirée ne retire personne', async () => {
    const id = await joueur('Sacha');
    const brahim = await clientAnimateur('brahim@teamup.test');
    await brahim.from('joueurs').delete().eq('id', id);
    const { count } = await clientService()
      .from('joueurs')
      .select('id', { count: 'exact', head: true })
      .eq('id', id);
    expect(count).toBe(1);
  });
});

avecBase('le mode des membres à l’écran', () => {
  it('vaut « tous » par défaut, et l’écran le reçoit', async () => {
    expect((await pilotage()).membres_mode).toBe('tous');
    const { data } = await appeler<{ membres_mode: string }>(
      await clientAnimateur('anna@teamup.test'),
      'etat_ecran',
      { p_code: evenement.code },
    );
    expect(data!.membres_mode).toBe('tous');
  });

  it('se règle sans périmer le pilotage', async () => {
    const avant = await pilotage();
    const { erreur } = await appeler(await clientAnimateur('anna@teamup.test'), 'regler_membres', {
      p_evenement: evenement.id,
      p_mode: 'carrousel',
    });
    expect(erreur).toBeNull();
    const apres = await pilotage();
    expect(apres).toEqual({ membres_mode: 'carrousel', maj_le: avant.maj_le });
  });

  it('refuse un mode inconnu', async () => {
    const { erreur } = await appeler(await clientAnimateur('anna@teamup.test'), 'regler_membres', {
      p_evenement: evenement.id,
      p_mode: 'diaporama',
    });
    expect(erreur).toMatch(/membres_mode/);
  });

  it('un animateur d’une autre soirée n’y touche pas', async () => {
    await appeler(await clientAnimateur('brahim@teamup.test'), 'regler_membres', {
      p_evenement: evenement.id,
      p_mode: 'tous',
    });
    expect((await pilotage()).membres_mode).toBe('carrousel');
  });
});
