import { afterAll, describe, expect, it } from 'vitest';
import {
  appeler,
  baseDisponible,
  clientAnimateur,
  clientService,
  creerEvenementJetable,
  hacher,
  supprimerEvenements,
} from './base';

/**
 * Lot 14 : inscription sans équipe, formation des équipes par la régie (`former_equipes`), et le
 * garde-fou de la panne du 2026-10-31 (une équipe supprimée laissait ses passages sans équipe).
 */

const avecBase = describe.skipIf(!baseDisponible);
const crees: string[] = [];
afterAll(() => supprimerEvenements(crees));

let compteur = 0;

async function soiree(options: { equipes?: number } = {}) {
  const evenement = await creerEvenementJetable({ equipes: options.equipes ?? 0 });
  crees.push(evenement.id);
  const { data, error } = await clientService()
    .from('groupes')
    .insert([
      { evenement_id: evenement.id, ordre: 1, nom: 'Famille' },
      { evenement_id: evenement.id, ordre: 2, nom: 'Amis' },
    ])
    .select('id, nom');
  if (error) throw new Error(error.message);
  const groupes = Object.fromEntries(
    (data as { id: string; nom: string }[]).map((g) => [g.nom, g.id]),
  );
  return { ...evenement, groupes: groupes as Record<'Famille' | 'Amis', string> };
}

function inscrire(
  code: string,
  options: { groupe?: string; volontaire?: boolean; nom?: string; prenom?: string } = {},
) {
  compteur += 1;
  const jeton = hacher(`formation-${code}-${compteur}`);
  return appeler<{ joueur_id: string; equipe: { id: string } | null }>(
    clientService(),
    'rejoindre_evenement',
    {
      p_code: code,
      p_prenom: options.prenom ?? `Inscrit ${compteur}`,
      p_langue: 'fr',
      p_jeton_hash: jeton,
      ...(options.groupe ? { p_groupe: options.groupe } : {}),
      p_volontaire: options.volontaire ?? false,
      ...(options.nom ? { p_nom_propose: options.nom } : {}),
    },
  ).then((r) => ({ ...r, jeton }));
}

async function joueurs(evenementId: string) {
  const { data, error } = await clientService()
    .from('joueurs')
    .select('id, prenom, equipe_id, capitaine, groupe_id, nom_propose, volontaire')
    .eq('evenement_id', evenementId);
  if (error) throw new Error(error.message);
  return data as {
    id: string;
    prenom: string;
    equipe_id: string | null;
    capitaine: boolean;
    groupe_id: string | null;
    nom_propose: string | null;
    volontaire: boolean;
  }[];
}

async function equipes(evenementId: string) {
  const { data } = await clientService()
    .from('equipes')
    .select('id, numero, nom')
    .eq('evenement_id', evenementId)
    .order('numero');
  return data as { id: string; numero: number; nom: string }[];
}

/** Des contenus de Points communs de la démo, pour remplir une réserve. */
async function contenusPointsCommuns(n: number) {
  const { data } = await clientService().from('contenus').select('id').eq('jeu', 'list2').limit(n);
  return (data as { id: string }[]).map((c) => c.id);
}

async function mancheParEquipe(evenementId: string, reserve: string[]) {
  const { data, error } = await clientService()
    .from('manches')
    .insert({
      evenement_id: evenementId,
      jeu: 'list2',
      ordre: 1,
      options: { passages_par_equipe: 1, reserve },
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

/** La formation telle que la régie l'envoie : équipes 1..n, membres répartis à la main. */
function formation(
  inscrits: { id: string; volontaire: boolean; nom_propose: string | null }[],
  n: number,
) {
  return Array.from({ length: n }, (_, i) => {
    const membres = inscrits.filter((_, k) => k % n === i);
    const capitaine = membres.find((j) => j.volontaire) ?? null;
    return {
      numero: i + 1,
      nom: capitaine?.nom_propose ?? `Équipe ${i + 1}`,
      capitaine: capitaine?.id ?? null,
      membres: membres.map((j) => j.id),
    };
  });
}

avecBase('inscription sans équipe', () => {
  it('une soirée sans équipe garde le groupe et le nom proposé, sans équipe', async () => {
    const s = await soiree();
    const r = await inscrire(s.code, {
      groupe: s.groupes.Famille,
      volontaire: true,
      nom: 'Les As',
    });
    expect(r.erreur).toBeNull();
    expect(r.data?.equipe).toBeNull();
    const [j] = await joueurs(s.id);
    expect(j).toMatchObject({
      equipe_id: null,
      groupe_id: s.groupes.Famille,
      nom_propose: 'Les As',
    });
  });

  it('un non-volontaire ne garde aucun nom proposé', async () => {
    const s = await soiree();
    await inscrire(s.code, { volontaire: false, nom: 'Ignoré' });
    const [j] = await joueurs(s.id);
    expect(j?.nom_propose).toBeNull();
  });

  it('le volontaire change son nom proposé, plus après la formation', async () => {
    const s = await soiree();
    const r = await inscrire(s.code, { volontaire: true, nom: 'Avant' });
    const change = await appeler(clientService(), 'proposer_nom', {
      p_jeton_hash: r.jeton,
      p_nom: 'Après',
    });
    expect(change.erreur).toBeNull();
    expect((await joueurs(s.id))[0]?.nom_propose).toBe('Après');

    for (let i = 0; i < 3; i++) await inscrire(s.code);
    const anna = await clientAnimateur('anna@teamup.test');
    const forme = await appeler(anna, 'former_equipes', {
      p_evenement: s.id,
      p_equipes: formation(await joueurs(s.id), 2),
      p_passages: [],
    });
    expect(forme.erreur).toBeNull();
    const refus = await appeler(clientService(), 'proposer_nom', {
      p_jeton_hash: r.jeton,
      p_nom: 'Trop tard',
    });
    expect(refus.erreur).toMatch(/formées/);
  });

  it('une soirée qui a ses équipes place toujours à l’arrivée (lot 5)', async () => {
    const s = await soiree({ equipes: 3 });
    const r = await inscrire(s.code);
    expect(r.data?.equipe).not.toBeNull();
  });
});

avecBase('formation des équipes', () => {
  it('crée les équipes, capitaines, noms, groupes et passages tirés de la réserve', async () => {
    const s = await soiree();
    await inscrire(s.code, { groupe: s.groupes.Famille, volontaire: true, nom: 'Les Lions' });
    await inscrire(s.code, { groupe: s.groupes.Amis, volontaire: true, nom: 'Les Aigles' });
    for (let i = 0; i < 6; i++) {
      await inscrire(s.code, { groupe: i % 2 ? s.groupes.Amis : s.groupes.Famille });
    }
    const reserve = await contenusPointsCommuns(4);
    const manche = await mancheParEquipe(s.id, reserve);
    const inscrits = (await joueurs(s.id)).sort(
      (a, b) => Number(b.volontaire) - Number(a.volontaire),
    );
    const anna = await clientAnimateur('anna@teamup.test');
    const r = await appeler<number>(anna, 'former_equipes', {
      p_evenement: s.id,
      p_equipes: formation(inscrits, 2),
      p_passages: [
        { manche_id: manche, numero: 1, contenu_id: reserve[2], ordre: 1 },
        { manche_id: manche, numero: 2, contenu_id: reserve[0], ordre: 2 },
      ],
    });
    expect(r.erreur).toBeNull();
    expect(r.data).toBe(2);

    expect((await equipes(s.id)).map((e) => e.nom).sort()).toEqual(['Les Aigles', 'Les Lions']);
    const apres = await joueurs(s.id);
    expect(apres.every((j) => j.equipe_id !== null)).toBe(true);
    expect(apres.filter((j) => j.capitaine)).toHaveLength(2);
    // Gardés jusqu'au premier jeu : la régie peut refaire les équipes.
    expect(apres.some((j) => j.groupe_id !== null)).toBe(true);

    const { data: rep } = await clientService()
      .from('equipes_groupes')
      .select('effectif')
      .eq('evenement_id', s.id);
    expect((rep as { effectif: number }[]).reduce((t, l) => t + l.effectif, 0)).toBe(8);

    const { data: passages } = await clientService()
      .from('passages')
      .select('contenu_id, equipe_id')
      .eq('manche_id', manche);
    expect((passages as { contenu_id: string }[]).map((p) => p.contenu_id).sort()).toEqual(
      [reserve[0], reserve[2]].sort(),
    );
  });

  it('place un inscrit que la régie n’avait pas vu', async () => {
    const s = await soiree();
    for (let i = 0; i < 4; i++) await inscrire(s.code);
    const vus = await joueurs(s.id);
    await inscrire(s.code, { prenom: 'Retardataire' });
    const anna = await clientAnimateur('anna@teamup.test');
    const r = await appeler(anna, 'former_equipes', {
      p_evenement: s.id,
      p_equipes: formation(vus, 2),
      p_passages: [],
    });
    expect(r.erreur).toBeNull();
    const retard = (await joueurs(s.id)).find((j) => j.prenom === 'Retardataire');
    expect(retard?.equipe_id).not.toBeNull();
  });

  it('après la formation, un retardataire va dans la moins remplie', async () => {
    const s = await soiree();
    for (let i = 0; i < 5; i++) await inscrire(s.code);
    const anna = await clientAnimateur('anna@teamup.test');
    const tous = await joueurs(s.id);
    await appeler(anna, 'former_equipes', {
      p_evenement: s.id,
      p_equipes: [
        { numero: 1, nom: 'A', capitaine: null, membres: tous.slice(0, 3).map((j) => j.id) },
        { numero: 2, nom: 'B', capitaine: null, membres: tous.slice(3).map((j) => j.id) },
      ],
      p_passages: [],
    });
    const r = await inscrire(s.code);
    const eqs = await equipes(s.id);
    expect(r.data?.equipe?.id).toBe(eqs.find((e) => e.nom === 'B')?.id);
  });

  it('refait les équipes, puis refuse une fois un jeu commencé, et oublie groupes et noms', async () => {
    const s = await soiree();
    await inscrire(s.code, { groupe: s.groupes.Famille, volontaire: true, nom: 'Nom' });
    for (let i = 0; i < 5; i++) await inscrire(s.code, { groupe: s.groupes.Amis });
    const reserve = await contenusPointsCommuns(3);
    const manche = await mancheParEquipe(s.id, reserve);
    const anna = await clientAnimateur('anna@teamup.test');
    const former = async (n: number) =>
      appeler(anna, 'former_equipes', {
        p_evenement: s.id,
        p_equipes: formation(await joueurs(s.id), n),
        p_passages: Array.from({ length: n }, (_, i) => ({
          manche_id: manche,
          numero: i + 1,
          contenu_id: reserve[i],
          ordre: i + 1,
        })),
      });
    expect((await former(3)).erreur).toBeNull();
    expect((await former(2)).erreur).toBeNull();
    expect(await equipes(s.id)).toHaveLength(2);
    const { count } = await clientService()
      .from('passages')
      .select('*', { count: 'exact', head: true })
      .eq('manche_id', manche);
    expect(count).toBe(2);

    await clientService().from('manches').update({ statut: 'en_cours' }).eq('id', manche);
    const refus = await former(2);
    expect(refus.erreur).toMatch(/commencé/);
    const apres = await joueurs(s.id);
    expect(apres.every((j) => j.groupe_id === null && j.nom_propose === null)).toBe(true);
  });

  it('refuse un contenu hors de la réserve et une équipe sans nom', async () => {
    const s = await soiree();
    for (let i = 0; i < 4; i++) await inscrire(s.code);
    const [a, b, etranger] = await contenusPointsCommuns(3);
    const manche = await mancheParEquipe(s.id, [a!, b!]);
    const anna = await clientAnimateur('anna@teamup.test');
    const inscrits = await joueurs(s.id);
    const horsReserve = await appeler(anna, 'former_equipes', {
      p_evenement: s.id,
      p_equipes: formation(inscrits, 2),
      p_passages: [{ manche_id: manche, numero: 1, contenu_id: etranger, ordre: 1 }],
    });
    expect(horsReserve.erreur).toMatch(/passages invalides/);
    const sansNom = await appeler(anna, 'former_equipes', {
      p_evenement: s.id,
      p_equipes: formation(inscrits, 2).map((e) => ({ ...e, nom: ' ' })),
      p_passages: [],
    });
    expect(sansNom.erreur).toMatch(/équipes invalides/);
    expect(await equipes(s.id)).toHaveLength(0);
  });

  it('refuse un animateur qui n’anime pas la soirée', async () => {
    const s = await soiree();
    await inscrire(s.code);
    const brahim = await clientAnimateur('brahim@teamup.test');
    const r = await appeler(brahim, 'former_equipes', {
      p_evenement: s.id,
      p_equipes: formation(await joueurs(s.id), 2),
      p_passages: [],
    });
    expect(r.erreur).toMatch(/inconnu/);
  });
});

avecBase('panne du 2026-10-31', () => {
  it('supprimer une équipe supprime ses passages à venir de Points communs', async () => {
    const s = await soiree({ equipes: 3 });
    const reserve = await contenusPointsCommuns(3);
    const manche = await mancheParEquipe(s.id, reserve);
    const eqs = await equipes(s.id);
    await clientService()
      .from('passages')
      .insert(
        eqs.map((e, i) => ({
          manche_id: manche,
          evenement_id: s.id,
          equipe_id: e.id,
          ordre: i + 1,
          contenu_id: reserve[i],
        })),
      );
    const anna = await clientAnimateur('anna@teamup.test');
    const { error } = await anna.from('equipes').delete().eq('id', eqs[0]!.id);
    expect(error).toBeNull();
    const { data } = await clientService()
      .from('passages')
      .select('equipe_id')
      .eq('manche_id', manche);
    expect(data).toHaveLength(2);
    expect((data as { equipe_id: string | null }[]).every((p) => p.equipe_id !== null)).toBe(true);
  });
});
