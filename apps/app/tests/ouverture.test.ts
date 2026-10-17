import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { attenteFinDeBoucle, CYCLE_OUVERTURE_MS, FINALE } from '../src/lib/ouverture';

describe('la fin de la boucle d’ouverture', () => {
  it('attend ce qui reste du cycle en cours', () => {
    expect(attenteFinDeBoucle(1000)).toBe(8000);
    expect(attenteFinDeBoucle(4500)).toBe(4500);
    expect(attenteFinDeBoucle(8999)).toBe(1);
  });

  it('n’attend pas pile à la fin d’un cycle, et compte les cycles déjà passés', () => {
    expect(attenteFinDeBoucle(0)).toBe(0);
    expect(attenteFinDeBoucle(9000)).toBe(0);
    expect(attenteFinDeBoucle(3 * 9000 + 2000)).toBe(7000);
  });

  it('dure autant que le token --tu-dur-ronds-cycle', () => {
    const tokens = readFileSync(
      new URL('../../../packages/ui/src/styles/tokens-layout.css', import.meta.url),
      'utf8',
    );
    expect(tokens).toContain(`--tu-dur-ronds-cycle: ${CYCLE_OUVERTURE_MS}ms;`);
  });
});

describe('la passe finale', () => {
  it('avance étape par étape', () => {
    const etapes = Object.values(FINALE);
    expect([...etapes].sort((a, b) => a - b)).toEqual(etapes);
  });

  it('pose le logo sur la cymbale du roulement, et finit avant un nouveau cycle', () => {
    expect(FINALE.logo).toBe(5000);
    expect(FINALE.fin).toBeLessThanOrEqual(CYCLE_OUVERTURE_MS);
  });
});
