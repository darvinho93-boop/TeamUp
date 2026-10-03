import { describe, expect, it } from 'vitest';
import { aleaDepuis } from './duels';
import {
  DUREE_TIRAGE_S,
  equipesRangees,
  MELANGE_TIRAGE_MS,
  ordreDesPassages,
  RANGEMENT_TIRAGE_MS,
  tirerOrdre,
} from './ordre';

const equipes = (n: number) => Array.from({ length: n }, (_, i) => `e${i + 1}`);

/** Les passages tels que la préparation les crée : tour par tour, dans l'ordre des numéros. */
function passages(nEquipes: number, tours: number) {
  return Array.from({ length: tours }, () => equipes(nEquipes))
    .flat()
    .map((equipe_id, i) => ({ id: `p${i + 1}`, ordre: i + 1, equipe_id }));
}

describe("tirage de l'ordre", () => {
  it('rend une permutation des équipes', () => {
    const tire = tirerOrdre(equipes(8), aleaDepuis('x'));
    expect([...tire].sort()).toEqual(equipes(8).sort());
  });

  it('même hasard, même ordre', () => {
    expect(tirerOrdre(equipes(6), aleaDepuis('a'))).toEqual(
      tirerOrdre(equipes(6), aleaDepuis('a')),
    );
  });

  it('ne modifie pas la liste reçue', () => {
    const liste = equipes(4);
    tirerOrdre(liste, aleaDepuis('b'));
    expect(liste).toEqual(equipes(4));
  });

  it('chaque équipe arrive première à peu près une fois sur n', () => {
    const premieres = new Map<string, number>();
    const alea = aleaDepuis('equite');
    const n = 4;
    for (let i = 0; i < 10_000; i++) {
      const premiere = tirerOrdre(equipes(n), alea)[0]!;
      premieres.set(premiere, (premieres.get(premiere) ?? 0) + 1);
    }
    for (const compte of premieres.values()) expect(Math.abs(compte - 2500)).toBeLessThan(200);
  });
});

describe('ordre des passages', () => {
  for (const nEquipes of [2, 3, 5, 8]) {
    for (const tours of [1, 2, 3]) {
      it(`${nEquipes} équipes, ${tours} tour(s) : un passage par équipe et par tour, même rang`, () => {
        const ps = passages(nEquipes, tours);
        const ordre = tirerOrdre(equipes(nEquipes), aleaDepuis(`${nEquipes}-${tours}`));
        const ids = ordreDesPassages(ps, ordre);
        expect([...ids].sort()).toEqual(ps.map((p) => p.id).sort());
        const equipeDe = new Map(ps.map((p) => [p.id, p.equipe_id]));
        for (let t = 0; t < tours; t++) {
          expect(ids.slice(t * nEquipes, (t + 1) * nEquipes).map((id) => equipeDe.get(id))).toEqual(
            ordre,
          );
        }
      });
    }
  }

  it("garde l'ordre des tours d'une même équipe", () => {
    const ids = ordreDesPassages(passages(2, 2), ['e2', 'e1']);
    expect(ids).toEqual(['p2', 'p1', 'p4', 'p3']);
  });

  it('refuse un passage sans équipe ou hors du tirage', () => {
    expect(() => ordreDesPassages([{ id: 'q', ordre: 1, equipe_id: null }], ['e1'])).toThrow(
      RangeError,
    );
    expect(() => ordreDesPassages(passages(3, 1), ['e1', 'e2'])).toThrow(RangeError);
  });
});

describe('animation du tirage', () => {
  it('mélange 3 s, puis range une équipe par quart de seconde', () => {
    expect(equipesRangees(0, 5)).toBe(0);
    expect(equipesRangees(MELANGE_TIRAGE_MS - 1, 5)).toBe(0);
    expect(equipesRangees(MELANGE_TIRAGE_MS, 5)).toBe(1);
    expect(equipesRangees(MELANGE_TIRAGE_MS + RANGEMENT_TIRAGE_MS, 5)).toBe(2);
    expect(equipesRangees(60_000, 5)).toBe(5);
  });

  it('a le temps de ranger huit équipes', () => {
    expect(equipesRangees(DUREE_TIRAGE_S * 1000, 8)).toBe(8);
  });
});
