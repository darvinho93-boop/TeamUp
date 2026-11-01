import { describe, expect, it } from 'vitest';
import { aleaDepuis } from './duels';
import { formerEquipes, tirerContenus, type Inscrit } from './formation';

function inscrits(
  n: number,
  {
    groupe,
    volontaires = 0,
    sansTelephone = 0,
    prefixe = 'j',
  }: {
    groupe?: string | null;
    volontaires?: number;
    sansTelephone?: number;
    prefixe?: string;
  } = {},
): Inscrit[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefixe}${i + 1}`,
    groupe: groupe ?? null,
    volontaire: i < volontaires,
    nomPropose: i < volontaires ? `Nom ${prefixe}${i + 1}` : null,
    telephone: i >= n - sansTelephone ? false : true,
  }));
}

const ecart = (valeurs: number[]) => Math.max(...valeurs) - Math.min(...valeurs);

describe('formation des équipes', () => {
  it('place chaque inscrit une fois, tailles à un près', () => {
    for (const [n, k] of [
      [36, 5],
      [12, 3],
      [7, 2],
      [150, 8],
      [3, 4],
    ] as const) {
      const liste = inscrits(n, { volontaires: 2 });
      const equipes = formerEquipes({ inscrits: liste, nbEquipes: k, alea: aleaDepuis(`${n}`) });
      expect(equipes).toHaveLength(k);
      const tous = equipes.flatMap((e) => e.membres);
      expect([...tous].sort()).toEqual(liste.map((j) => j.id).sort());
      expect(ecart(equipes.map((e) => e.membres.length))).toBeLessThanOrEqual(1);
    }
  });

  it('répartit chaque groupe à un près', () => {
    const liste = [
      ...inscrits(30, { groupe: 'famille', prefixe: 'f', volontaires: 2 }),
      ...inscrits(15, { groupe: 'amis', prefixe: 'a', volontaires: 1 }),
      ...inscrits(4, { prefixe: 's' }),
    ];
    for (const graine of ['a', 'b', 'c', 'd']) {
      const equipes = formerEquipes({ inscrits: liste, nbEquipes: 3, alea: aleaDepuis(graine) });
      for (const prefixe of ['f', 'a']) {
        expect(
          ecart(equipes.map((e) => e.membres.filter((id) => id.startsWith(prefixe)).length)),
        ).toBeLessThanOrEqual(1);
      }
      expect(ecart(equipes.map((e) => e.membres.length))).toBeLessThanOrEqual(1);
    }
  });

  it('un volontaire capitaine par équipe, avec le nom qu’il a proposé', () => {
    const liste = inscrits(20, { volontaires: 6 });
    const equipes = formerEquipes({ inscrits: liste, nbEquipes: 4, alea: aleaDepuis('v') });
    const volontaires = new Set(liste.filter((j) => j.volontaire).map((j) => j.id));
    for (const e of equipes) {
      expect(e.capitaine && volontaires.has(e.capitaine)).toBe(true);
      expect(e.membres).toContain(e.capitaine);
      expect(e.nom).toBe(`Nom ${e.capitaine}`);
    }
    expect(new Set(equipes.map((e) => e.capitaine)).size).toBe(4);
  });

  it('sans assez de volontaires : capitaine tiré, jamais sans téléphone, nom par défaut', () => {
    const liste = inscrits(12, { volontaires: 1, sansTelephone: 5 });
    const sans = new Set(liste.filter((j) => !j.telephone).map((j) => j.id));
    for (const graine of ['x', 'y', 'z']) {
      const equipes = formerEquipes({ inscrits: liste, nbEquipes: 3, alea: aleaDepuis(graine) });
      expect(equipes.filter((e) => e.nom !== null)).toHaveLength(1);
      for (const e of equipes) {
        if (e.capitaine) {
          expect(sans.has(e.capitaine)).toBe(false);
          expect(e.membres).toContain(e.capitaine);
        } else {
          expect(e.membres.every((id) => sans.has(id))).toBe(true);
        }
      }
    }
  });

  it('un volontaire sans téléphone ne devient jamais capitaine', () => {
    const liste: Inscrit[] = [
      { id: 'x', groupe: null, volontaire: true, nomPropose: 'X', telephone: false },
      ...inscrits(5),
    ];
    const equipes = formerEquipes({ inscrits: liste, nbEquipes: 2, alea: aleaDepuis('t') });
    expect(equipes.some((e) => e.capitaine === 'x')).toBe(false);
  });

  it('un nom proposé vide donne le nom par défaut', () => {
    const liste: Inscrit[] = [
      { id: 'v', groupe: null, volontaire: true, nomPropose: '   ', telephone: true },
      ...inscrits(3),
    ];
    const equipes = formerEquipes({ inscrits: liste, nbEquipes: 2, alea: aleaDepuis('n') });
    expect(equipes.find((e) => e.capitaine === 'v')?.nom).toBeNull();
  });

  it('même hasard, même formation', () => {
    const liste = inscrits(25, { volontaires: 3 });
    expect(formerEquipes({ inscrits: liste, nbEquipes: 4, alea: aleaDepuis('m') })).toEqual(
      formerEquipes({ inscrits: liste, nbEquipes: 4, alea: aleaDepuis('m') }),
    );
  });

  it('refuse un nombre d’équipes hors de 2 à 8', () => {
    for (const n of [1, 9, 2.5]) {
      expect(() =>
        formerEquipes({ inscrits: inscrits(10), nbEquipes: n, alea: Math.random }),
      ).toThrow(RangeError);
    }
  });
});

describe('tirage des contenus', () => {
  const reserve = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'];

  it('un contenu par équipe et par tour, sans remise, tours à la suite', () => {
    const tirage = tirerContenus(reserve, ['e1', 'e2', 'e3'], 2, aleaDepuis('r'));
    expect(tirage).toHaveLength(6);
    expect(new Set(tirage.map((t) => t.contenu)).size).toBe(6);
    expect(tirage.every((t) => reserve.includes(t.contenu))).toBe(true);
    expect(tirage.map((t) => t.equipe)).toEqual(['e1', 'e2', 'e3', 'e1', 'e2', 'e3']);
    expect(tirage.map((t) => t.ordre)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('tire au hasard dans la réserve', () => {
    const vus = new Set<string>();
    const alea = aleaDepuis('h');
    for (let i = 0; i < 200; i++) vus.add(tirerContenus(reserve, ['e1'], 1, alea)[0]!.contenu);
    expect(vus.size).toBe(reserve.length);
  });

  it('refuse une réserve trop petite', () => {
    expect(() => tirerContenus(['c1', 'c2'], ['e1', 'e2', 'e3'], 1, Math.random)).toThrow(
      RangeError,
    );
    expect(() => tirerContenus(['c1', 'c1', 'c2'], ['e1', 'e2', 'e3'], 1, Math.random)).toThrow(
      RangeError,
    );
  });
});
