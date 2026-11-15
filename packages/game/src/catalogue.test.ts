import { describe, expect, it } from 'vitest';
import { BETA_DUELS, FICHES, isGameCode, SOCLE_GAMES } from './catalogue';

describe('catalogue de jeux', () => {
  it('contient les cinq jeux socles de la spec v3, puis le Blind test (2026-11-15)', () => {
    expect(SOCLE_GAMES).toEqual(['list2', 'qcm2', 'enchere2', 'mime2', 'photo2', 'blind']);
  });

  it('ne contient que les deux duels en bêta', () => {
    expect(BETA_DUELS).toEqual(['grab', 'cup']);
  });

  it('rejette un code de jeu absent de la spec', () => {
    expect(isGameCode('list2')).toBe(true);
    expect(isGameCode('blind')).toBe(true);
    expect(isGameCode('karaoke')).toBe(false);
  });

  it('reprend les fiches de la table public.jeux', () => {
    const lignes = Object.entries(FICHES).map(([code, f]) => [
      code,
      f.sequentiel,
      f.chronoPassageS,
      f.beta,
    ]);
    expect(lignes).toEqual([
      ['list2', true, 130, false],
      ['qcm2', false, 30, false],
      ['enchere2', false, 120, false],
      ['mime2', true, 150, false],
      ['photo2', false, 300, false],
      ['blind', false, 60, false],
      ['grab', false, 30, true],
      ['cup', false, 45, true],
    ]);
  });
});
