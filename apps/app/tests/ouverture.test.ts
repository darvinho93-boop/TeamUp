import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  attenteFinDeBoucle,
  CYCLE_OUVERTURE_MS,
  FINALE,
  PART_REPRISE,
  raccordFinale,
} from '../src/lib/ouverture';

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

describe('le raccord de la passe finale', () => {
  it('prend la boucle au vol tant que le nom n’a pas paru', () => {
    expect(raccordFinale(0)).toEqual({ attenteMs: 0, depuisMs: 0 });
    expect(raccordFinale(3000)).toEqual({ attenteMs: 0, depuisMs: 3000 });
    expect(raccordFinale(2 * 9000 + 5000)).toEqual({ attenteMs: 0, depuisMs: 5000 });
  });

  it('attend la fin du cycle quand la boucle défait déjà le logo', () => {
    expect(raccordFinale(6000)).toEqual({ attenteMs: 3000, depuisMs: 0 });
    expect(raccordFinale(8999)).toEqual({ attenteMs: 1, depuisMs: 0 });
  });

  it('se sépare de la boucle quand le nom paraît, après le logo', () => {
    expect(CYCLE_OUVERTURE_MS * PART_REPRISE).toBeGreaterThan(FINALE.logo);
    expect(CYCLE_OUVERTURE_MS * PART_REPRISE).toBeLessThanOrEqual(FINALE.nom);
  });

  it('ne fait jamais attendre la page du QR plus d’un cycle et d’une passe', () => {
    for (let ecoule = 0; ecoule < CYCLE_OUVERTURE_MS; ecoule += 250) {
      const { attenteMs, depuisMs } = raccordFinale(ecoule);
      expect(attenteMs + FINALE.qr - depuisMs).toBeGreaterThan(0);
      expect(attenteMs + FINALE.qr - depuisMs).toBeLessThanOrEqual(
        CYCLE_OUVERTURE_MS * (1 - PART_REPRISE) + FINALE.qr,
      );
    }
  });
});
