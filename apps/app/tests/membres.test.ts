import { describe, expect, it } from 'vitest';
import {
  correspond,
  DUREE_PAGE_MS,
  grilleDesEquipes,
  membresTries,
  pageA,
  pagesDe,
} from '../src/lib/membres';

describe('les membres d’une équipe', () => {
  it('se rangent par ordre alphabétique, sans tenir compte des accents ni de la casse', () => {
    expect(membresTries(['Zoé', 'élodie', 'Adam', 'Émile']).map((m) => m.prenom)).toEqual([
      'Adam',
      'élodie',
      'Émile',
      'Zoé',
    ]);
  });

  it('mettent le capitaine en tête', () => {
    expect(membresTries(['Zoé', 'Adam', 'Mila'], 'Mila')).toEqual([
      { prenom: 'Mila', capitaine: true },
      { prenom: 'Adam', capitaine: false },
      { prenom: 'Zoé', capitaine: false },
    ]);
  });

  it('gardent l’homonyme du capitaine dans la liste', () => {
    expect(membresTries(['Léa', 'Adam', 'Léa'], 'Léa').map((m) => m.prenom)).toEqual([
      'Léa',
      'Adam',
      'Léa',
    ]);
  });

  it('s’affichent sans capitaine quand la base ne le donne pas', () => {
    for (const capitaine of [undefined, null, 'Absent']) {
      expect(membresTries(['Zoé', 'Adam'], capitaine)).toEqual([
        { prenom: 'Adam', capitaine: false },
        { prenom: 'Zoé', capitaine: false },
      ]);
    }
  });
});

describe('les pages de prénoms à l’écran', () => {
  it('découpent sans rien perdre', () => {
    const prenoms = Array.from({ length: 25 }, (_, i) => `P${i}`);
    const pages = pagesDe(prenoms, 8);
    // Quatre pages de taille voisine, plutôt que trois pleines et un prénom tout seul.
    expect(pages.map((p) => p.length)).toEqual([7, 7, 7, 4]);
    expect(pagesDe(prenoms, 12).map((p) => p.length)).toEqual([9, 9, 7]);
    expect(pagesDe(prenoms.slice(0, 12), 12)).toHaveLength(1);
    expect(pages.flat()).toEqual(prenoms);
    expect(pagesDe([], 8)).toEqual([]);
  });

  it('laissent plus de place par carte quand il y a peu d’équipes', () => {
    expect(grilleDesEquipes(2)).toEqual({ colonnes: 2, parPage: 26 });
    expect(grilleDesEquipes(3)).toEqual({ colonnes: 3, parPage: 26 });
    expect(grilleDesEquipes(4)).toEqual({ colonnes: 2, parPage: 10 });
    expect(grilleDesEquipes(6)).toEqual({ colonnes: 3, parPage: 10 });
  });

  it('ne tournent pas quand tout tient sur une page', () => {
    expect(pageA(123_456, 1)).toBe(0);
    expect(pageA(123_456, 0)).toBe(0);
  });

  it('tournent toutes ensemble, d’après l’heure : deux écrans montrent la même page', () => {
    const t = 40 * DUREE_PAGE_MS;
    expect(pageA(t, 3)).toBe(40 % 3);
    expect(pageA(t + DUREE_PAGE_MS - 1, 3)).toBe(40 % 3);
    expect(pageA(t + DUREE_PAGE_MS, 3)).toBe(41 % 3);
    // Chaque page passe, dans l'ordre.
    expect([0, 1, 2, 3].map((n) => pageA(n * DUREE_PAGE_MS, 3))).toEqual([0, 1, 2, 0]);
  });
});

describe('la recherche d’un invité', () => {
  it('ignore les accents, la casse et les espaces autour', () => {
    expect(correspond('Élodie', ' elo ')).toBe(true);
    expect(correspond('Zoé', 'ZOE')).toBe(true);
    expect(correspond('Adam', 'eve')).toBe(false);
    expect(correspond('Adam', '')).toBe(true);
  });
});
