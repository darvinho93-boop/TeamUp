import { describe, expect, it } from 'vitest';
import { DUREE_COMPTEUR_MS, valeurA } from '../src/lib/compteur';
import { rangsDExtinction, SUSPENSE_MS } from '../src/lib/suspense';
import { CHANGEMENT_DE_PLACE_MS, rangs, totauxAvant, type LigneScore } from '../src/lib/classement';
import { INTERLUDE_MS } from '../src/lib/sons';

/** Plateau (2026-11-19, audit « jeu télé ») : compteur, suspense du quiz, classement qui monte. */

describe('les points qui défilent', () => {
  it('partent de la valeur de départ et finissent sur la cible', () => {
    expect(valeurA(0, 120, -50)).toBe(0);
    expect(valeurA(0, 120, 0)).toBe(0);
    expect(valeurA(0, 120, DUREE_COMPTEUR_MS)).toBe(120);
    expect(valeurA(0, 120, DUREE_COMPTEUR_MS * 3)).toBe(120);
    expect(valeurA(300, 610, 1300, 1300)).toBe(610);
  });

  it('montent sans jamais redescendre, vite puis lentement', () => {
    const valeurs = Array.from({ length: 10 }, (_, i) => valeurA(0, 100, i * 100));
    for (let i = 1; i < valeurs.length; i += 1)
      expect(valeurs[i]).toBeGreaterThanOrEqual(valeurs[i - 1]!);
    // La moitié du chemin est faite bien avant la moitié du temps.
    expect(valeurA(0, 100, DUREE_COMPTEUR_MS / 3)).toBeGreaterThan(50);
    expect(Number.isInteger(valeurA(0, 7, 123))).toBe(true);
  });
});

describe('le suspense du quiz', () => {
  it('dure le roulement court de l’interlude', () => {
    expect(SUSPENSE_MS).toBe(INTERLUDE_MS);
  });

  it('éteint chaque mauvaise case une fois, jamais la bonne', () => {
    for (const bonne of [0, 1, 2, 3]) {
      const r = rangsDExtinction(`passage-${bonne}`, bonne);
      expect(r[bonne]).toBeNull();
      expect(r.filter((x) => x !== null).sort()).toEqual([0, 1, 2]);
    }
  });

  it('tire le même ordre pour la même question, sur tous les écrans', () => {
    expect(rangsDExtinction('abc', 2)).toEqual(rangsDExtinction('abc', 2));
    const ordres = new Set(
      Array.from({ length: 20 }, (_, i) => rangsDExtinction(`q-${i}`, 0).join()),
    );
    expect(ordres.size).toBeGreaterThan(1);
  });
});

describe('le classement qui monte', () => {
  const equipes = [
    { id: 'a', numero: 1, points: 320 },
    { id: 'b', numero: 2, points: 450 },
    { id: 'c', numero: 3, points: 610 },
  ];
  const ligne = (equipe_id: string, manche_id: string | null, points: number, cree_le: string) =>
    ({ equipe_id, manche_id, points, cree_le }) satisfies LigneScore;

  it('retire les points du dernier jeu, celui de la ligne la plus récente', () => {
    const lignes = [
      ligne('a', 'quiz', 320, '2026-11-19T20:00:00Z'),
      ligne('b', 'quiz', 450, '2026-11-19T20:00:00Z'),
      ligne('c', 'quiz', 210, '2026-11-19T20:00:00Z'),
      ligne('c', 'surenchere', 400, '2026-11-19T20:30:00Z'),
    ];
    expect(totauxAvant(lignes, equipes)).toEqual(
      new Map([
        ['a', 320],
        ['b', 450],
        ['c', 210],
      ]),
    );
  });

  it('garde une correction hors jeu dans « avant », même plus récente', () => {
    const lignes = [
      ligne('a', 'mime', 120, '2026-11-19T20:00:00Z'),
      ligne('a', null, 200, '2026-11-19T21:00:00Z'),
    ];
    expect(totauxAvant(lignes, [{ id: 'a', numero: 1, points: 320 }]).get('a')).toBe(200);
  });

  it('part de 0 quand aucun jeu n’a encore marqué', () => {
    expect(totauxAvant([], equipes)).toEqual(
      new Map([
        ['a', 0],
        ['b', 0],
        ['c', 0],
      ]),
    );
  });

  it('range par total, à égalité par numéro d’équipe', () => {
    const totaux = new Map([
      ['a', 320],
      ['b', 450],
      ['c', 210],
    ]);
    expect(rangs(equipes, totaux)).toEqual(
      new Map([
        ['b', 0],
        ['a', 1],
        ['c', 2],
      ]),
    );
    expect(
      rangs(
        equipes,
        new Map([
          ['a', 0],
          ['b', 0],
          ['c', 0],
        ]),
      ).get('a'),
    ).toBe(0);
  });

  it('change les places quand le roulement court se termine', () => {
    expect(CHANGEMENT_DE_PLACE_MS).toBe(INTERLUDE_MS);
  });
});
