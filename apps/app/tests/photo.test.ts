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

// Thèmes photo de la démo.
const THEME_1 = 'aaaa0005-0000-4000-8000-000000000005';
const THEME_2 = 'aaaa0006-0000-4000-8000-000000000006';
const THEME_ETRANGER = 'aaaa0003-0000-4000-8000-000000000003';

interface PhotosJoueur {
  closes: boolean;
  themes: { theme_id: string; theme: string; envoyee_le: number | null }[];
}
interface EtatEcran {
  pilotage: { version: string };
  evenement: { photos_closes: boolean };
  programme: {
    id: string;
    jeu: string;
    passages: {
      id: string;
      contenu_id: string;
      photos: { equipe_id: string; chemin: string; gagnante: boolean }[] | null;
    }[];
  }[];
}

let evenement: { id: string; code: string };
let manche: string;
const equipes: Record<number, string> = {};
const jeton = (nom: string) => `photo-${evenement.id}-${nom}`;
const chemin = (equipe: number, envoi: string) => `${evenement.id}/${equipes[equipe]}/${envoi}.jpg`;

async function ajouterJoueur(nom: string, equipe: number, capitaine: boolean, langue = 'fr') {
  const { error } = await clientService()
    .from('joueurs')
    .insert({
      evenement_id: evenement.id,
      equipe_id: equipes[equipe],
      prenom: nom,
      langue,
      capitaine,
      jeton_hash: hacher(jeton(nom)),
    });
  if (error) throw new Error(error.message);
}

const envoyer = (nom: string, theme: string, chemin: string) =>
  appeler<{ ancien: string | null }>(clientService(), 'envoyer_photo', {
    p_jeton_hash: hacher(jeton(nom)),
    p_theme: theme,
    p_chemin: chemin,
  });

async function photosDe(nom: string) {
  const { data } = await appeler<{ photos: PhotosJoueur | null }>(clientService(), 'etat_joueur', {
    p_jeton_hash: hacher(jeton(nom)),
  });
  return data!.photos;
}

async function etatEcran(regie: boolean) {
  const client = await clientAnimateur('anna@teamup.test');
  const { data } = await appeler<EtatEcran>(client, 'etat_ecran', {
    p_code: evenement.code,
    p_regie: regie,
  });
  return data!;
}

beforeAll(async () => {
  if (!baseDisponible) return;
  evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr', 'en'] });
  const service = clientService();
  const { data: eqs } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id);
  for (const e of eqs!) equipes[e['numero'] as number] = e['id'] as string;

  const { data: m } = await service
    .from('manches')
    .insert({ evenement_id: evenement.id, jeu: 'photo2', ordre: 1, options: { themes: 2 } })
    .select('id')
    .single();
  manche = m!['id'] as string;
  const { error } = await service.from('passages').insert([
    { manche_id: manche, evenement_id: evenement.id, ordre: 1, contenu_id: THEME_1 },
    { manche_id: manche, evenement_id: evenement.id, ordre: 2, contenu_id: THEME_2 },
  ]);
  if (error) throw new Error(error.message);

  await ajouterJoueur('Capi', 1, true);
  await ajouterJoueur('Bea', 1, false);
  await ajouterJoueur('Cap2', 2, true, 'en');
});

afterAll(() => (baseDisponible ? supprimerEvenements([evenement.id]) : undefined));

avecBase('photo challenge : envois du capitaine', () => {
  it('chaque joueur voit les thèmes dans sa langue, sans photo envoyée', async () => {
    const fr = await photosDe('Bea');
    expect(fr).toEqual({
      closes: false,
      themes: [
        { theme_id: THEME_1, theme: 'La photo la plus mal cadrée', envoyee_le: null },
        { theme_id: THEME_2, theme: "Toute l'équipe dans le cadre", envoyee_le: null },
      ],
    });
    expect((await photosDe('Cap2'))!.themes[0]!.theme).toBe('The worst framed photo');
  });

  it("refuse un joueur qui n'est pas capitaine", async () => {
    const { erreur } = await envoyer('Bea', THEME_1, chemin(1, 'x1'));
    expect(erreur).toMatch(/pas capitaine/);
  });

  it("refuse un thème étranger à la manche photo et un chemin hors du dossier de l'équipe", async () => {
    expect((await envoyer('Capi', THEME_ETRANGER, chemin(1, 'x2'))).erreur).toMatch(/thème/);
    expect((await envoyer('Capi', THEME_1, chemin(2, 'x3'))).erreur).toMatch(/chemin/);
  });

  it('pose la photo, que toute l’équipe voit envoyée, puis la remplace', async () => {
    const premier = await envoyer('Capi', THEME_1, chemin(1, 'a'));
    expect(premier).toEqual({ data: { ancien: null }, erreur: null });
    const vue = await photosDe('Bea');
    expect(vue!.themes[0]!.envoyee_le).toEqual(expect.any(Number));
    expect(vue!.themes[1]!.envoyee_le).toBeNull();

    // Un renvoi du même fichier (file d'attente qui réessaie) ne change rien.
    expect((await envoyer('Capi', THEME_1, chemin(1, 'a'))).data).toEqual({ ancien: null });

    const remplace = await envoyer('Capi', THEME_1, chemin(1, 'b'));
    expect(remplace.data).toEqual({ ancien: chemin(1, 'a') });
    const { count } = await clientService()
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .eq('evenement_id', evenement.id);
    expect(count).toBe(1);
  });

  it("l'écran ne reçoit les photos qu'une fois la diffusion lancée ; la régie toujours", async () => {
    const ecran = await etatEcran(false);
    expect(ecran.programme[0]!.passages[0]!.photos).toBeNull();
    const regie = await etatEcran(true);
    expect(regie.programme[0]!.passages[0]!.photos).toEqual([
      expect.objectContaining({ equipe_id: equipes[1], chemin: chemin(1, 'b'), gagnante: false }),
    ]);
  });

  it('personne sans compte ne lit les photos, ni la table ni le bucket', async () => {
    const anon = clientAnon();
    const { data } = await anon.from('photos').select('*');
    expect(data ?? []).toEqual([]);
    const { data: fichiers } = await anon.storage.from('photos').list(evenement.id);
    expect(fichiers ?? []).toEqual([]);
  });

  it('le lancement de la diffusion clôt les envois, et la gagnante est reportée sur sa photo', async () => {
    await envoyer('Cap2', THEME_1, chemin(2, 'c'));
    const anna = await clientAnimateur('anna@teamup.test');
    const { pilotage } = await etatEcran(true);
    const [passage] = (await etatEcran(true)).programme[0]!.passages;

    const lancer = await appeler<string>(anna, 'enregistrer_etape', {
      p_evenement: evenement.id,
      p_version: pilotage.version,
      p_pilotage: { scene: 'jeu', manche_id: manche, passage_id: passage!.id, etape: 'theme' },
      p_passage: { id: passage!.id, statut: 'en_cours' },
      p_manche: { id: manche, statut: 'en_cours' },
    });
    expect(lancer.erreur).toBeNull();

    expect((await etatEcran(false)).evenement.photos_closes).toBe(true);
    expect((await photosDe('Capi'))!.closes).toBe(true);
    expect((await envoyer('Capi', THEME_2, chemin(1, 'd'))).erreur).toMatch(/clos/);
    // L'écran reçoit maintenant les photos de chaque thème.
    expect((await etatEcran(false)).programme[0]!.passages[0]!.photos).toHaveLength(2);

    const version = (await etatEcran(true)).pilotage.version;
    const verdict = await appeler<string>(anna, 'enregistrer_etape', {
      p_evenement: evenement.id,
      p_version: version,
      p_pilotage: { scene: 'jeu', manche_id: manche, passage_id: passage!.id, etape: 'gagnante' },
      p_passage: {
        id: passage!.id,
        statut: 'termine',
        resultat: { equipe_gagnante: 2 },
        points: 100,
      },
    });
    expect(verdict.erreur).toBeNull();
    const photos = (await etatEcran(false)).programme[0]!.passages[0]!.photos!;
    expect(photos.find((p) => p.gagnante)?.equipe_id).toBe(equipes[2]);
    expect(photos.filter((p) => p.gagnante)).toHaveLength(1);
  });
});
