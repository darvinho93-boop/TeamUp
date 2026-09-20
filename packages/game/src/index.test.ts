import { describe, expect, it } from 'vitest';
import { BETA_DUELS, isGameCode, SOCLE_GAMES } from './index';

describe('catalogue de jeux', () => {
  it('ne contient que les cinq jeux socles de la spec v3', () => {
    expect(SOCLE_GAMES).toEqual(['list2', 'qcm2', 'enchere2', 'mime2', 'photo2']);
  });

  it('ne contient que les deux duels en bêta', () => {
    expect(BETA_DUELS).toEqual(['grab', 'cup']);
  });

  it('rejette un code de jeu absent de la spec', () => {
    expect(isGameCode('list2')).toBe(true);
    expect(isGameCode('blindtest')).toBe(false);
  });
});
