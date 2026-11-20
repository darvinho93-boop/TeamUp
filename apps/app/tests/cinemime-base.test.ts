import { randomUUID } from 'node:crypto';
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

/**
 * Ciné-mime (2026-11-20) : un contenu porte un titre de film (secret) et une vidéo (bucket privé
 * « extraits ») ; l'écran reçoit la vidéo pour la précharger, le titre seulement au verdict ;
 * aucun téléphone ne reçoit ni l'un ni l'autre ; ses passages se tirent à la formation.
 */
const avecBase = describe.skipIf(!baseDisponible);

/** Un début de MP4 (boîte « ftyp »), suffisant pour le stockage. */
const MP4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
const FILM = 'Le Grand Film de test';
const chemins: string[] = [];
const contenus: string[] = [];
const crees: string[] = [];

const nouveauChemin = () => {
  const chemin = `${randomUUID()}.mp4`;
  chemins.push(chemin);
  return chemin;
};

async function deposer(chemin = nouveauChemin()) {
  const admin = await clientAnimateur('admin@teamup.test');
  const { error } = await admin.storage
    .from('extraits')
    .upload(chemin, MP4, { contentType: 'video/mp4' });
  if (error) throw new Error(error.message);
  return chemin;
}

async function enregistrer(args: {
  id?: string | null;
  jeu?: string;
  film?: string;
  extrait?: { chemin: string; duree_ms: number } | null;
}) {
  const admin = await clientAnimateur('admin@teamup.test');
  const r = await appeler<string>(admin, 'enregistrer_contenu', {
    p_id: args.id ?? null,
    p_jeu: args.jeu ?? 'cinemime',
    p_etiquette: 'tout_public',
    p_langues: {
      fr: {
        public: {},
        secret: args.jeu === 'mime2' ? { mot: 'chat' } : { film: args.film ?? FILM },
      },
      en: {
        public: {},
        secret: args.jeu === 'mime2' ? { mot: 'cat' } : { film: 'The Big Test Movie' },
      },
    },
    ...(args.extrait === undefined ? {} : { p_extrait: args.extrait }),
  });
  if (r.data) contenus.push(r.data);
  return r;
}

async function ligne(id: string) {
  const { data } = await clientService()
    .from('contenus')
    .select('extrait, extrait_duree_ms')
    .eq('id', id)
    .single();
  return data as { extrait: string | null; extrait_duree_ms: number | null };
}

afterAll(async () => {
  if (!baseDisponible) return;
  await supprimerEvenements(crees);
  const service = clientService();
  if (contenus.length) await service.from('contenus').delete().in('id', contenus);
  if (chemins.length) await service.storage.from('extraits').remove(chemins);
});

avecBase('un contenu du Ciné-mime', () => {
  it('s’enregistre avec sa vidéo, et la garde quand on ne la remplace pas', async () => {
    const chemin = await deposer();
    const r = await enregistrer({ extrait: { chemin, duree_ms: 32_400 } });
    expect(r.erreur).toBeNull();
    expect(await ligne(r.data!)).toEqual({ extrait: chemin, extrait_duree_ms: 32_400 });

    const texte = await enregistrer({ id: r.data!, film: 'Titre corrigé' });
    expect(texte.erreur).toBeNull();
    expect(await ligne(r.data!)).toEqual({ extrait: chemin, extrait_duree_ms: 32_400 });

    const autre = await deposer();
    const remplace = await enregistrer({
      id: r.data!,
      extrait: { chemin: autre, duree_ms: 20_000 },
    });
    expect(remplace.erreur).toBeNull();
    expect(await ligne(r.data!)).toEqual({ extrait: autre, extrait_duree_ms: 20_000 });
  });

  it('refuse un Ciné-mime sans vidéo, une vidéo sur un autre jeu, un titre trop long', async () => {
    expect((await enregistrer({})).erreur).toMatch(/vidéo/);
    const chemin = nouveauChemin();
    expect(
      (await enregistrer({ jeu: 'mime2', extrait: { chemin, duree_ms: 10_000 } })).erreur,
    ).toMatch(/inattendu/);
    expect(
      (await enregistrer({ film: 'x'.repeat(81), extrait: { chemin, duree_ms: 10_000 } })).erreur,
    ).toMatch(/mal formé/);
  });

  it('refuse une durée hors de 3 à 90 s, un chemin hors forme, un chemin déjà pris', async () => {
    expect(
      (await enregistrer({ extrait: { chemin: nouveauChemin(), duree_ms: 2_000 } })).erreur,
    ).not.toBeNull();
    expect(
      (await enregistrer({ extrait: { chemin: nouveauChemin(), duree_ms: 91_000 } })).erreur,
    ).not.toBeNull();
    expect(
      (await enregistrer({ extrait: { chemin: 'scene.mp4', duree_ms: 10_000 } })).erreur,
    ).not.toBeNull();
    const chemin = nouveauChemin();
    expect((await enregistrer({ extrait: { chemin, duree_ms: 10_000 } })).erreur).toBeNull();
    expect((await enregistrer({ extrait: { chemin, duree_ms: 10_000 } })).erreur).not.toBeNull();
  });

  it('ne s’enregistre que par un admin', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const r = await appeler(anna, 'enregistrer_contenu', {
      p_id: null,
      p_jeu: 'cinemime',
      p_etiquette: 'tout_public',
      p_langues: { fr: { public: {}, secret: { film: FILM } } },
      p_extrait: { chemin: nouveauChemin(), duree_ms: 10_000 },
    });
    expect(r.erreur).toMatch(/admins/);
  });
});

avecBase('le bucket des scènes', () => {
  it('se lit par un animateur, pas sans compte', async () => {
    const chemin = await deposer();
    const anna = await clientAnimateur('anna@teamup.test');
    const { data, error } = await anna.storage.from('extraits').createSignedUrl(chemin, 60);
    expect(error).toBeNull();
    expect(data?.signedUrl).toContain(chemin);
    const { error: refus } = await clientAnon()
      .storage.from('extraits')
      .createSignedUrl(chemin, 60);
    expect(refus).not.toBeNull();
  });

  it('ne reçoit qu’un MP4 de l’admin, sous un uuid', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const { error: animateur } = await anna.storage
      .from('extraits')
      .upload(nouveauChemin(), MP4, { contentType: 'video/mp4' });
    expect(animateur).not.toBeNull();
    const admin = await clientAnimateur('admin@teamup.test');
    const { error: type } = await admin.storage
      .from('extraits')
      .upload(nouveauChemin(), MP4, { contentType: 'video/webm' });
    expect(type).not.toBeNull();
    const { error: nom } = await admin.storage
      .from('extraits')
      .upload('dossier/scene.mp4', MP4, { contentType: 'video/mp4' });
    expect(nom).not.toBeNull();
  });
});

avecBase('une partie de Ciné-mime', () => {
  let evenement: { id: string; code: string };
  let manche: string;
  let passage: string;
  let chemin: string;
  const jeton = hacher(`cinemime-${randomUUID()}`);

  beforeAll(async () => {
    evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr', 'en'] });
    crees.push(evenement.id);
    chemin = await deposer();
    const contenu = await enregistrer({ extrait: { chemin, duree_ms: 12_000 } });
    if (contenu.erreur) throw new Error(contenu.erreur);
    const service = clientService();
    const { data: eq } = await service
      .from('equipes')
      .select('id')
      .eq('evenement_id', evenement.id)
      .eq('numero', 1)
      .single();
    const { data: m, error } = await service
      .from('manches')
      .insert({ evenement_id: evenement.id, jeu: 'cinemime', ordre: 1, statut: 'en_cours' })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    manche = (m as { id: string }).id;
    const { data: pa, error: e } = await service
      .from('passages')
      .insert({
        evenement_id: evenement.id,
        manche_id: manche,
        equipe_id: (eq as { id: string }).id,
        ordre: 1,
        contenu_id: contenu.data!,
        statut: 'en_cours',
      })
      .select('id')
      .single();
    if (e) throw new Error(e.message);
    passage = (pa as { id: string }).id;
    await service
      .from('pilotage')
      .update({
        scene: 'jeu',
        manche_id: manche,
        passage_id: passage,
        etape: 'extrait',
        chrono_depart: new Date().toISOString(),
        chrono_duree_s: 12,
      })
      .eq('evenement_id', evenement.id);
    const arrivee = await appeler(service, 'rejoindre_evenement', {
      p_code: evenement.code,
      p_prenom: 'Spectatrice',
      p_langue: 'fr',
      p_jeton_hash: jeton,
      p_volontaire: false,
    });
    if (arrivee.erreur) throw new Error(arrivee.erreur);
  });

  async function passageDeLEcran(regie: boolean) {
    const anna = await clientAnimateur('anna@teamup.test');
    const { data, erreur } = await appeler<{
      programme: {
        id: string;
        passages: { id: string; secret: unknown; extrait: unknown }[];
      }[];
    }>(anna, 'etat_ecran', { p_code: evenement.code, p_regie: regie });
    if (erreur) throw new Error(erreur);
    return data!.programme.find((x) => x.id === manche)!.passages.find((p) => p.id === passage)!;
  }

  it('donne la vidéo à l’écran, le titre à la régie seulement tant que le verdict n’est pas tombé', async () => {
    const ecran = await passageDeLEcran(false);
    expect(ecran.extrait).toEqual({ chemin, duree_ms: 12_000 });
    expect(ecran.secret).toBeNull();
    const regie = await passageDeLEcran(true);
    expect(regie.secret).toMatchObject({ fr: { film: FILM } });
  });

  it('ne donne rien du film ni de la vidéo à un téléphone', async () => {
    const { data, erreur } = await appeler(clientService(), 'etat_joueur', { p_jeton_hash: jeton });
    expect(erreur).toBeNull();
    const texte = JSON.stringify(data);
    expect(texte).not.toContain(FILM);
    expect(texte).not.toContain('Big Test Movie');
    expect(texte).not.toContain(chemin);
  });

  it('montre le titre à l’écran une fois le passage terminé', async () => {
    await clientService()
      .from('passages')
      .update({ statut: 'termine', points: 100, resultat: { trouve: true, ecoule_ms: 50_000 } })
      .eq('id', passage);
    const ecran = await passageDeLEcran(false);
    expect(ecran.secret).toMatchObject({ fr: { film: FILM }, en: { film: 'The Big Test Movie' } });
  });
});

avecBase('la formation des équipes', () => {
  it('tire les passages du Ciné-mime dans sa réserve, et les retire avec leur équipe', async () => {
    const evenement = await creerEvenementJetable({ equipes: 0 });
    crees.push(evenement.id);
    const service = clientService();
    for (let i = 0; i < 4; i++) {
      const r = await appeler(service, 'rejoindre_evenement', {
        p_code: evenement.code,
        p_prenom: `Inscrit ${i}`,
        p_langue: 'fr',
        p_jeton_hash: hacher(`cinemime-formation-${evenement.code}-${i}`),
        p_volontaire: false,
      });
      if (r.erreur) throw new Error(r.erreur);
    }
    const reserve: string[] = [];
    for (let i = 0; i < 2; i++) {
      const c = await enregistrer({ extrait: { chemin: await deposer(), duree_ms: 10_000 } });
      reserve.push(c.data!);
    }
    const { data: m } = await service
      .from('manches')
      .insert({
        evenement_id: evenement.id,
        jeu: 'cinemime',
        ordre: 1,
        options: { passages_par_equipe: 1, reserve },
      })
      .select('id')
      .single();
    const mancheId = (m as { id: string }).id;
    const { data: inscrits } = await service
      .from('joueurs')
      .select('id')
      .eq('evenement_id', evenement.id);
    const ids = (inscrits as { id: string }[]).map((j) => j.id);

    const anna = await clientAnimateur('anna@teamup.test');
    const r = await appeler(anna, 'former_equipes', {
      p_evenement: evenement.id,
      p_equipes: [
        { numero: 1, nom: 'Équipe 1', capitaine: null, membres: ids.slice(0, 2) },
        { numero: 2, nom: 'Équipe 2', capitaine: null, membres: ids.slice(2) },
      ],
      p_passages: [
        { manche_id: mancheId, numero: 1, contenu_id: reserve[1], ordre: 1 },
        { manche_id: mancheId, numero: 2, contenu_id: reserve[0], ordre: 2 },
      ],
    });
    expect(r.erreur).toBeNull();
    const { data: passages } = await service
      .from('passages')
      .select('contenu_id, equipe_id, equipes(numero)')
      .eq('manche_id', mancheId)
      .order('ordre');
    expect(passages?.map((p) => p.contenu_id)).toEqual([reserve[1], reserve[0]]);

    const equipe2 = passages![1]!.equipe_id!;
    await service.from('joueurs').update({ equipe_id: null }).eq('equipe_id', equipe2);
    await anna.from('equipes').delete().eq('id', equipe2);
    const { data: restants } = await service
      .from('passages')
      .select('contenu_id')
      .eq('manche_id', mancheId);
    expect(restants?.map((p) => p.contenu_id)).toEqual([reserve[1]]);
  });
});
