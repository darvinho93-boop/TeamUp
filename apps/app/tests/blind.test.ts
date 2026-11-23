import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  appeler,
  baseDisponible,
  clientAnon,
  clientService,
  creerEvenementJetable,
  hacher,
  supprimerEvenements,
} from './base';

/**
 * Blind test (2026-11-15) : le buzzer du capitaine, tranché par la base. De plusieurs capitaines
 * qui buzzent ensemble, un seul gagne ; ce que voit un téléphone ne contient jamais la réponse.
 */
const avecBase = describe.skipIf(!baseDisponible);

let evenement: { id: string; code: string };
let manche: string;
let titre: string;
const equipes: Record<number, string> = {};
const jeton = (nom: string) => `blind-${evenement.id}-${nom}`;
const CAPITAINES = ['Alice', 'Bruno', 'Chloé'] as const;

async function ajouterJoueur(nom: string, equipe: number, capitaine: boolean) {
  const { error } = await clientService()
    .from('joueurs')
    .insert({
      evenement_id: evenement.id,
      equipe_id: equipes[equipe],
      prenom: nom,
      langue: 'fr',
      capitaine,
      jeton_hash: hacher(jeton(nom)),
    });
  if (error) throw new Error(error.message);
}

/** L'écoute d'un titre en cours, posée directement : la régie l'écrirait par `enregistrer_etape`. */
async function ecoute(resultat: Record<string, unknown> = {}, departIlYAS = 1) {
  const service = clientService();
  await service.from('passages').update({ statut: 'en_cours', resultat }).eq('id', titre);
  const { error } = await service
    .from('pilotage')
    .update({
      scene: 'jeu',
      manche_id: manche,
      passage_id: titre,
      etape: 'ecoute',
      chrono_depart: new Date(Date.now() - departIlYAS * 1000).toISOString(),
      chrono_duree_s: 30,
    })
    .eq('evenement_id', evenement.id);
  if (error) throw new Error(error.message);
}

const buzzer = (nom: string) =>
  appeler<{ equipe: number }>(clientService(), 'buzzer_blind', {
    p_jeton_hash: hacher(jeton(nom)),
  });

beforeAll(async () => {
  if (!baseDisponible) return;
  evenement = await creerEvenementJetable({ equipes: 3, langues: ['fr'] });
  const service = clientService();
  const { data: eqs } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id);
  for (const eq of eqs!) equipes[eq['numero'] as number] = eq['id'] as string;

  const { data: m, error } = await service
    .from('manches')
    .insert({
      evenement_id: evenement.id,
      jeu: 'blind',
      ordre: 1,
      statut: 'en_cours',
      options: { extrait_s: 30, titres: [{ musique: null, debut_s: 0 }] },
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  manche = m['id'] as string;
  const { data: p } = await service
    .from('passages')
    .insert({ manche_id: manche, evenement_id: evenement.id, ordre: 1 })
    .select('id')
    .single();
  titre = p!['id'] as string;

  for (const [i, nom] of CAPITAINES.entries()) await ajouterJoueur(nom, i + 1, true);
  await ajouterJoueur('David', 1, false);
});

afterAll(() => (baseDisponible ? supprimerEvenements([evenement.id]) : undefined));

avecBase('le buzzer du blind test', () => {
  it('n’est pas ouvert sans compte, ni à un joueur qui n’est pas capitaine', async () => {
    await ecoute();
    const { erreur: anon } = await appeler(clientAnon(), 'buzzer_blind', {
      p_jeton_hash: hacher(jeton('Alice')),
    });
    expect(anon).not.toBeNull();
    expect((await buzzer('David')).erreur).toMatch(/pas capitaine/);
    expect((await buzzer('Inconnu')).erreur).toMatch(/session inconnue/);
  });

  it('de trois capitaines qui buzzent ensemble, un seul gagne ; les autres ont « trop tard »', async () => {
    await ecoute({}, 4);
    const resultats = await Promise.all(CAPITAINES.map((nom) => buzzer(nom)));
    const gagnants = resultats.filter((r) => r.erreur === null);
    expect(gagnants).toHaveLength(1);
    expect(resultats.filter((r) => /trop tard/.test(r.erreur ?? ''))).toHaveLength(2);
    const numero = gagnants[0]!.data!.equipe;

    const service = clientService();
    const { data: pilotage } = await service
      .from('pilotage')
      .select('etape, chrono_duree_s, chrono_depart')
      .eq('evenement_id', evenement.id)
      .single();
    expect(pilotage).toMatchObject({ etape: 'buzz', chrono_duree_s: 7 });
    const { data: passage } = await service
      .from('passages')
      .select('resultat')
      .eq('id', titre)
      .single();
    const resultat = passage!['resultat'] as { buzz: number; ecoute_ms: number };
    expect(resultat.buzz).toBe(numero);
    // L'écoute faite jusqu'au buzz (environ 4 s) est gardée : la musique reprendra de là.
    expect(resultat.ecoute_ms).toBeGreaterThanOrEqual(3500);
    expect(resultat.ecoute_ms).toBeLessThan(10_000);
  });

  it('refuse une équipe bloquée sur ce titre, et tout buzz une fois l’extrait écoulé', async () => {
    await ecoute({ bloquees: [1] });
    expect((await buzzer('Alice')).erreur).toMatch(/bloquée/);
    expect((await buzzer('Bruno')).erreur).toBeNull();

    await ecoute({}, 31);
    expect((await buzzer('Chloé')).erreur).toMatch(/extrait fini/);
  });

  it('montre au téléphone l’étape et qui a la main, jamais la musique ni la réponse', async () => {
    const service = clientService();
    const { data: musique } = await service
      .from('musiques')
      .insert({
        titre: 'Réponse secrète',
        artiste: 'Artiste secret',
        chemin: `${crypto.randomUUID()}.mp3`,
        taille: 10,
        paroles: [{ t_ms: 0, texte: 'Parole secrète' }],
      })
      .select('id')
      .single();
    await service
      .from('manches')
      .update({
        options: { extrait_s: 30, titres: [{ musique: musique!['id'] as string, debut_s: 0 }] },
      })
      .eq('id', manche);
    await ecoute();
    expect((await buzzer('Bruno')).erreur).toBeNull();

    const etat = async (nom: string) =>
      (
        await appeler<{ blind: Record<string, unknown> }>(service, 'etat_joueur', {
          p_jeton_hash: hacher(jeton(nom)),
        })
      ).data!;
    const bruno = await etat('Bruno');
    expect(bruno.blind).toMatchObject({ etape: 'buzz', buzz: 2, equipe: 2, peut_buzzer: false });
    const alice = await etat('Alice');
    expect(alice.blind).toMatchObject({ etape: 'buzz', buzz: 2, equipe: 1, bloquee: false });
    const texte = JSON.stringify([bruno, alice]);
    expect(texte).not.toContain('Réponse secrète');
    expect(texte).not.toContain('Artiste secret');
    expect(texte).not.toContain('.mp3');

    // Au karaoké (2026-11-23), le téléphone sait qui a trouvé, jamais les paroles.
    await service
      .from('passages')
      .update({ statut: 'termine', resultat: { ecoute_ms: 1000, trouve_par: 2 } })
      .eq('id', titre);
    await service
      .from('pilotage')
      .update({ etape: 'karaoke', chrono_depart: new Date().toISOString(), chrono_duree_s: 600 })
      .eq('evenement_id', evenement.id);
    const auKaraoke = await etat('Bruno');
    expect(auKaraoke.blind).toMatchObject({ etape: 'karaoke', trouve_par: 2, peut_buzzer: false });
    expect(JSON.stringify(auKaraoke)).not.toContain('Parole secrète');
    expect((await buzzer('Alice')).erreur).toMatch(/trop tard/);

    await service
      .from('musiques')
      .delete()
      .eq('id', musique!['id'] as string);
  });

  it('garde les paroles fermées sans compte, et refuse des paroles mal formées', async () => {
    const service = clientService();
    const { data: musique } = await service
      .from('musiques')
      .insert({
        titre: 'Paroles contrôlées',
        chemin: `${crypto.randomUUID()}.mp3`,
        taille: 10,
        paroles: [{ t_ms: 0, texte: 'Une ligne' }],
      })
      .select('id')
      .single();
    const id = musique!['id'] as string;

    const { data: anon } = await clientAnon().from('musiques').select('paroles').eq('id', id);
    expect(anon ?? []).toHaveLength(0);

    for (const paroles of [
      [],
      [
        { t_ms: 10, texte: 'même' },
        { t_ms: 10, texte: 'instant' },
      ],
      [{ t_ms: -1, texte: 'négatif' }],
      [{ t_ms: 0, texte: '   ' }],
      [{ t_ms: 0, texte: 'x'.repeat(121) }],
    ]) {
      const { error } = await service.from('musiques').update({ paroles }).eq('id', id);
      expect(error, JSON.stringify(paroles)).not.toBeNull();
    }
    await service.from('musiques').delete().eq('id', id);
  });
});
