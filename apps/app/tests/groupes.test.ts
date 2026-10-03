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

const avecBase = describe.skipIf(!baseDisponible);

const crees: string[] = [];

afterAll(() => supprimerEvenements(crees));

/** Une soirée jetable avec ses groupes à mélanger, dans l'ordre donné. */
async function soireeAGroupes(equipes: number, noms: string[]) {
  const evenement = await creerEvenementJetable({ equipes });
  crees.push(evenement.id);
  const { data, error } = await clientService()
    .from('groupes')
    .insert(noms.map((nom, i) => ({ evenement_id: evenement.id, ordre: i + 1, nom })))
    .select('id, nom');
  if (error) throw new Error(error.message);
  const groupes = new Map((data as { id: string; nom: string }[]).map((g) => [g.nom, g.id]));
  return { ...evenement, groupes };
}

let compteur = 0;

function rejoindre(code: string, groupe: string | null) {
  compteur += 1;
  return appeler<{ equipe: { id: string; numero: number } | null }>(
    clientService(),
    'rejoindre_evenement',
    {
      p_code: code,
      p_prenom: `Invité ${compteur}`,
      p_langue: 'fr',
      p_jeton_hash: hacher(`groupes-${code}-${compteur}`),
      ...(groupe ? { p_groupe: groupe } : {}),
    },
  );
}

/** Effectif de chaque groupe par équipe, à l'arrivée : equipe → groupe → effectif. */
async function repartition(evenementId: string) {
  const { data, error } = await clientService()
    .from('equipes_groupes')
    .select('equipe_id, groupe_id, effectif')
    .eq('evenement_id', evenementId);
  if (error) throw new Error(error.message);
  return data as { equipe_id: string; groupe_id: string; effectif: number }[];
}

async function totauxParEquipe(evenementId: string) {
  const { data } = await clientService()
    .from('joueurs')
    .select('equipe_id')
    .eq('evenement_id', evenementId);
  const totaux = new Map<string, number>();
  for (const j of data as { equipe_id: string }[])
    totaux.set(j.equipe_id, (totaux.get(j.equipe_id) ?? 0) + 1);
  return [...totaux.values()];
}

function effectifs(lignes: { groupe_id: string; effectif: number }[], groupe: string, n: number) {
  const valeurs = lignes.filter((l) => l.groupe_id === groupe).map((l) => l.effectif);
  return [...valeurs, ...Array<number>(n - valeurs.length).fill(0)].sort();
}

/** Mélange déterministe : le test rejoue toujours le même ordre. */
function melanger<T>(liste: T[]): T[] {
  const copie = [...liste];
  let graine = 42;
  for (let i = copie.length - 1; i > 0; i--) {
    graine = (graine * 1_103_515_245 + 12_345) % 2 ** 31;
    const j = graine % (i + 1);
    [copie[i], copie[j]] = [copie[j]!, copie[i]!];
  }
  return copie;
}

avecBase('les groupes à mélanger', () => {
  for (const ordre of ['en bloc', 'mélangé'] as const) {
    it(`3 équipes, 30 du côté A et 15 du côté B arrivés ${ordre} : 10 et 5 par équipe`, async () => {
      const { id, code, groupes } = await soireeAGroupes(3, ['Côté A', 'Côté B']);
      const a = groupes.get('Côté A')!;
      const b = groupes.get('Côté B')!;
      const arrivees = [...Array<string>(30).fill(a), ...Array<string>(15).fill(b)];

      for (const groupe of ordre === 'en bloc' ? arrivees : melanger(arrivees)) {
        const { erreur } = await rejoindre(code, groupe);
        expect(erreur).toBeNull();
      }

      const lignes = await repartition(id);
      expect(effectifs(lignes, a, 3)).toEqual([10, 10, 10]);
      expect(effectifs(lignes, b, 3)).toEqual([5, 5, 5]);
      expect(await totauxParEquipe(id)).toEqual([15, 15, 15]);
    });
  }

  it('à chaque arrivée, un groupe reste à un près dans toutes les équipes', async () => {
    const { id, code, groupes } = await soireeAGroupes(4, ['Mariée', 'Marié', 'Amis']);
    const ids = [...groupes.values()];
    const arrivees = melanger(Array.from({ length: 37 }, (_, i) => ids[i % 3]!));
    for (const groupe of arrivees) {
      await rejoindre(code, groupe);
      const lignes = await repartition(id);
      for (const g of ids) {
        const e = effectifs(lignes, g, 4);
        expect(Math.max(...e) - Math.min(...e)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('les arrivées simultanées ne cassent pas l’équilibre', async () => {
    const { id, code, groupes } = await soireeAGroupes(3, ['Côté A', 'Côté B']);
    const a = groupes.get('Côté A')!;
    const b = groupes.get('Côté B')!;
    const resultats = await Promise.all(
      [...Array<string>(30).fill(a), ...Array<string>(15).fill(b)].map((g) => rejoindre(code, g)),
    );
    expect(resultats.filter((r) => r.erreur !== null)).toEqual([]);
    const lignes = await repartition(id);
    expect(effectifs(lignes, a, 3)).toEqual([10, 10, 10]);
    expect(effectifs(lignes, b, 3)).toEqual([5, 5, 5]);
  });

  it('sans réponse, l’invité va dans la moins remplie, sans rien compter', async () => {
    const { id, code, groupes } = await soireeAGroupes(3, ['Côté A']);
    await rejoindre(code, groupes.get('Côté A')!);
    await rejoindre(code, groupes.get('Côté A')!);
    const { data } = await rejoindre(code, null);
    expect(data?.equipe?.numero).toBe(3);
    const lignes = await repartition(id);
    expect(lignes.reduce((s, l) => s + l.effectif, 0)).toBe(2);
  });

  it('refuse un groupe d’une autre soirée', async () => {
    const autre = await soireeAGroupes(2, ['Ailleurs']);
    const ici = await soireeAGroupes(2, ['Ici']);
    const { erreur } = await rejoindre(ici.code, autre.groupes.get('Ailleurs')!);
    expect(erreur).toMatch(/groupe inconnu/);
  });

  it('la soirée décrit ses groupes dans l’ordre, sans rien d’autre', async () => {
    const { code, groupes } = await soireeAGroupes(2, ['Côté mariée', 'Côté marié']);
    const { data } = await appeler<{ groupes: unknown }>(clientService(), 'evenement_public', {
      p_code: code,
    });
    expect(data?.groupes).toEqual([
      { id: groupes.get('Côté mariée'), nom: 'Côté mariée' },
      { id: groupes.get('Côté marié'), nom: 'Côté marié' },
    ]);
  });

  it('aucun joueur ne porte de groupe', async () => {
    const { id, code, groupes } = await soireeAGroupes(2, ['Côté A']);
    await rejoindre(code, groupes.get('Côté A')!);
    const { data } = await clientService()
      .from('joueurs')
      .select('*')
      .eq('evenement_id', id)
      .single();
    expect(Object.keys(data!).filter((cle) => /groupe/i.test(cle))).toEqual([]);
    expect(Object.values(data!)).not.toContain(groupes.get('Côté A'));
  });

  it("l'animateur lit la répartition mais ne l'écrit pas ; un autre ne voit rien", async () => {
    const { id, code, groupes } = await soireeAGroupes(2, ['Côté A']);
    await rejoindre(code, groupes.get('Côté A')!);

    const anna = await clientAnimateur('anna@teamup.test');
    const { data } = await anna.from('equipes_groupes').select('effectif').eq('evenement_id', id);
    expect(data).toEqual([{ effectif: 1 }]);
    await anna.from('equipes_groupes').update({ effectif: 99 }).eq('evenement_id', id);
    expect((await repartition(id))[0]?.effectif).toBe(1);

    const brahim = await clientAnimateur('brahim@teamup.test');
    for (const table of ['groupes', 'equipes_groupes']) {
      const { data: vu } = await brahim.from(table).select('*').eq('evenement_id', id);
      expect(vu).toEqual([]);
    }
  });
});
