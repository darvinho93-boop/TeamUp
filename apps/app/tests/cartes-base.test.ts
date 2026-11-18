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
import { purgerCartesExpirees } from '../src/lib/purge';

const avecBase = describe.skipIf(!baseDisponible);

interface Carte {
  age: number | null;
  metier: string | null;
  anecdote: string | null;
  accord: boolean;
  tiree: boolean;
}
interface EtatJoueur {
  carte: Carte | null;
  equipe: { membres: { prenom: string; capitaine: boolean }[] } | null;
}
interface Connaissance {
  tirage_id: string;
  jeu: string | null;
  equipe: { numero: number };
  points: number;
  carte: {
    prenom: string;
    age: number | null;
    metier: string | null;
    anecdote: string | null;
  } | null;
  membres: { prenom: string }[];
}

let evenement: { id: string; code: string };
let equipes: Record<number, string>;
let manche: string;
const jeton = (nom: string) => `carte-${evenement.id}-${nom}`;

async function ajouterJoueur(nom: string, numero: number, capitaine = false) {
  const { error } = await clientService()
    .from('joueurs')
    .insert({
      evenement_id: evenement.id,
      equipe_id: equipes[numero]!,
      prenom: nom,
      langue: 'fr',
      capitaine,
      jeton_hash: hacher(jeton(nom)),
    });
  if (error) throw new Error(error.message);
}

const enregistrer = (
  nom: string,
  carte: {
    age?: number | null;
    metier?: string | null;
    anecdote?: string | null;
    accord?: boolean;
  },
) =>
  appeler<{ evenement_id: string }>(clientService(), 'enregistrer_carte', {
    p_jeton_hash: hacher(jeton(nom)),
    p_age: carte.age ?? null,
    p_metier: carte.metier ?? null,
    p_anecdote: carte.anecdote ?? null,
    p_accord: carte.accord ?? false,
  });

async function etatJoueur(nom: string): Promise<EtatJoueur> {
  const { data, erreur } = await appeler<EtatJoueur>(clientService(), 'etat_joueur', {
    p_jeton_hash: hacher(jeton(nom)),
  });
  if (erreur) throw new Error(erreur);
  return data!;
}

async function tirer(numero: number, client?: Awaited<ReturnType<typeof clientAnimateur>>) {
  const anna = client ?? (await clientAnimateur('anna@teamup.test'));
  return appeler<{ id: string; joueur_id: string | null }>(anna, 'tirer_carte', {
    p_evenement: evenement.id,
    p_manche: manche,
    p_equipe: equipes[numero]!,
  });
}

async function prenomDe(joueurId: string | null): Promise<string | null> {
  if (!joueurId) return null;
  const { data } = await clientService()
    .from('joueurs')
    .select('prenom')
    .eq('id', joueurId)
    .single();
  return (data as { prenom: string }).prenom;
}

async function connaissance(regie: boolean): Promise<Connaissance | null> {
  const anna = await clientAnimateur('anna@teamup.test');
  const { data, erreur } = await appeler<{ connaissance: Connaissance | null }>(
    anna,
    'etat_ecran',
    {
      p_code: evenement.code,
      p_regie: regie,
    },
  );
  if (erreur) throw new Error(erreur);
  return data!.connaissance;
}

const scene = (valeur: 'accueil' | 'connaissance') =>
  clientService().from('pilotage').update({ scene: valeur }).eq('evenement_id', evenement.id);

beforeAll(async () => {
  if (!baseDisponible) return;
  evenement = await creerEvenementJetable({ equipes: 2 });
  const service = clientService();
  const { data: eqs } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id);
  equipes = Object.fromEntries(
    (eqs as { id: string; numero: number }[]).map((e) => [e.numero, e.id]),
  );
  const { data: m, error } = await service
    .from('manches')
    .insert({ evenement_id: evenement.id, jeu: 'qcm2', ordre: 1, statut: 'terminee' })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  manche = (m as { id: string }).id;
  await service.from('scores').insert([
    {
      evenement_id: evenement.id,
      equipe_id: equipes[1]!,
      manche_id: manche,
      points: 300,
      motif: 'test',
    },
    {
      evenement_id: evenement.id,
      equipe_id: equipes[1]!,
      manche_id: manche,
      points: 100,
      motif: 'test',
    },
    {
      evenement_id: evenement.id,
      equipe_id: equipes[2]!,
      manche_id: manche,
      points: 200,
      motif: 'test',
    },
  ]);
  await ajouterJoueur('Camille', 1, true);
  await ajouterJoueur('Malo', 1);
  await ajouterJoueur('Sacha', 1);
  await ajouterJoueur('Kavin', 2);
});

afterAll(async () => {
  if (baseDisponible) await supprimerEvenements([evenement.id]);
});

avecBase('cartes « Faisons connaissance »', () => {
  it('refuse une session inconnue et une carte invalide', async () => {
    const inconnu = await appeler(clientService(), 'enregistrer_carte', {
      p_jeton_hash: hacher('inconnu'),
      p_age: 30,
      p_metier: null,
      p_anecdote: null,
      p_accord: true,
    });
    expect(inconnu.erreur).toMatch(/session inconnue/);
    expect((await enregistrer('Camille', { age: 9 })).erreur).toMatch(/carte invalide/);
    expect((await enregistrer('Camille', { metier: 'x'.repeat(61) })).erreur).toMatch(
      /carte invalide/,
    );
    expect((await enregistrer('Camille', { anecdote: 'x'.repeat(121) })).erreur).toMatch(
      /carte invalide/,
    );
  });

  it('enregistre une carte nettoyée ; le téléphone ne voit que la sienne et son équipe', async () => {
    const { erreur } = await enregistrer('Camille', {
      age: 34,
      metier: '  Infirmière ',
      anecdote: 'Je joue\nde la batterie',
      accord: true,
    });
    expect(erreur).toBeNull();
    const etat = await etatJoueur('Camille');
    expect(etat.carte).toEqual({
      age: 34,
      metier: 'Infirmière',
      anecdote: 'Je joue de la batterie',
      accord: true,
      tiree: false,
    });
    expect((await etatJoueur('Malo')).carte).toBeNull();
    // Ses coéquipiers seulement, capitaine d'abord.
    expect(etat.equipe!.membres.map((m) => m.prenom)).toEqual(['Camille', 'Malo', 'Sacha']);
    expect(etat.equipe!.membres[0]!.capitaine).toBe(true);
    expect((await etatJoueur('Kavin')).equipe!.membres.map((m) => m.prenom)).toEqual(['Kavin']);
  });

  it('une carte vidée est supprimée', async () => {
    expect((await enregistrer('Sacha', { metier: 'Pilote' })).erreur).toBeNull();
    expect((await etatJoueur('Sacha')).carte).not.toBeNull();
    expect((await enregistrer('Sacha', { metier: '   ' })).erreur).toBeNull();
    expect((await etatJoueur('Sacha')).carte).toBeNull();
  });

  it("les cartes ne se lisent qu'à la régie de la soirée", async () => {
    const { data: anon } = await clientAnon().from('cartes_joueurs').select('joueur_id');
    expect(anon ?? []).toHaveLength(0);
    const brahim = await clientAnimateur('brahim@teamup.test');
    const { data: autre } = await brahim
      .from('cartes_joueurs')
      .select('joueur_id')
      .eq('evenement_id', evenement.id);
    expect(autre ?? []).toHaveLength(0);
    const anna = await clientAnimateur('anna@teamup.test');
    const { data: sienne } = await anna
      .from('cartes_joueurs')
      .select('joueur_id')
      .eq('evenement_id', evenement.id);
    expect(sienne).toHaveLength(1);
    expect((await tirer(1, brahim)).erreur).toMatch(/interdit/);
  });

  it('tire seulement les cartes autorisées, les jamais tirées d’abord', async () => {
    // Malo autorise, Sacha non : Sacha n'est jamais tiré.
    await enregistrer('Malo', { anecdote: 'Champion de belote', accord: true });
    await enregistrer('Sacha', { metier: 'Pilote', accord: false });
    const premier = await prenomDe((await tirer(1)).data!.joueur_id);
    const second = await prenomDe((await tirer(1)).data!.joueur_id);
    expect(new Set([premier, second])).toEqual(new Set(['Camille', 'Malo']));
    // Tous deux déjà tirés : le dernier tiré passe après l'autre.
    expect(await prenomDe((await tirer(1)).data!.joueur_id)).toBe(premier);
    expect((await etatJoueur(premier!)).carte!.tiree).toBe(true);
  });

  it("l'écran ne voit le tirage qu'à la scène connaissance, et toujours le même", async () => {
    const tirage = (await tirer(1)).data!;
    await scene('accueil');
    expect(await connaissance(false)).toBeNull();
    expect((await connaissance(true))!.tirage_id).toBe(tirage.id);

    await scene('connaissance');
    const vue = (await connaissance(false))!;
    expect(vue.tirage_id).toBe(tirage.id);
    expect(vue.jeu).toBe('qcm2');
    expect(vue.points).toBe(400);
    expect(vue.carte!.prenom).toBe(await prenomDe(tirage.joueur_id));
    expect(vue.membres.map((m) => m.prenom)).not.toContain(vue.carte!.prenom);
    // Relire ne retire pas au sort.
    expect((await connaissance(false))!.tirage_id).toBe(tirage.id);
  });

  it("une carte retirée ou écartée n'est plus montrée, ni tirée", async () => {
    const tirage = (await tirer(1)).data!;
    const prenom = await prenomDe(tirage.joueur_id);
    await enregistrer(prenom!, { anecdote: 'Ma carte', accord: false });
    expect((await connaissance(false))!.carte).toBeNull();

    const anna = await clientAnimateur('anna@teamup.test');
    const restant = prenom === 'Camille' ? 'Malo' : 'Camille';
    const { data: j } = await clientService()
      .from('joueurs')
      .select('id')
      .eq('evenement_id', evenement.id)
      .eq('prenom', restant)
      .single();
    expect((await appeler(anna, 'ecarter_carte', { p_joueur: j!.id })).erreur).toBeNull();
    // Plus aucune carte autorisée dans l'équipe 1 : l'équipe est célébrée seule.
    expect((await tirer(1)).data!.joueur_id).toBeNull();
    expect((await connaissance(false))!.carte).toBeNull();
  });

  it('sans carte dans une équipe, le tirage célèbre l’équipe seule', async () => {
    const { data } = await tirer(2);
    expect(data!.joueur_id).toBeNull();
    const vue = (await connaissance(false))!;
    expect(vue.equipe.numero).toBe(2);
    expect(vue.points).toBe(200);
    expect(vue.carte).toBeNull();
    expect(vue.membres.map((m) => m.prenom)).toEqual(['Kavin']);
  });

  it('refuse une carte une fois la partie terminée', async () => {
    await clientService().from('evenements').update({ statut: 'termine' }).eq('id', evenement.id);
    expect((await enregistrer('Kavin', { age: 40, accord: true })).erreur).toMatch(
      /partie terminée/,
    );
  });

  it('efface cartes et tirages le lendemain de la soirée', async () => {
    const service = clientService();
    const compter = async (table: 'cartes_joueurs' | 'tirages_cartes') =>
      (
        await service
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq('evenement_id', evenement.id)
      ).count ?? 0;
    expect(await compter('cartes_joueurs')).toBeGreaterThan(0);
    expect(await compter('tirages_cartes')).toBeGreaterThan(0);
    // Le jour même, rien ne part.
    await purgerCartesExpirees(service);
    expect(await compter('cartes_joueurs')).toBeGreaterThan(0);

    const avantHier = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    await service.from('evenements').update({ date_evenement: avantHier }).eq('id', evenement.id);
    expect(await purgerCartesExpirees(service)).toBeGreaterThan(0);
    expect(await compter('cartes_joueurs')).toBe(0);
    expect(await compter('tirages_cartes')).toBe(0);
  });
});
