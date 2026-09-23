import { describe, expect, it } from 'vitest';
import { formatChrono, formatDuree, tempsRestant } from './chrono';

describe('tempsRestant', () => {
  it('vaut la durée entière au départ', () => {
    expect(tempsRestant(130, 0)).toBe(130);
  });

  it("arrondit à la seconde inférieure dès qu'une fraction est écoulée", () => {
    expect(tempsRestant(130, 1)).toBe(129);
    expect(tempsRestant(130, 999)).toBe(129);
    expect(tempsRestant(130, 1000)).toBe(129);
    expect(tempsRestant(130, 1001)).toBe(128);
  });

  it('ne descend jamais sous zéro', () => {
    expect(tempsRestant(130, 130_000)).toBe(0);
    expect(tempsRestant(130, 500_000)).toBe(0);
  });

  it('traite un écoulé négatif (horloges décalées) comme un départ', () => {
    expect(tempsRestant(30, -2000)).toBe(30);
  });
});

describe('formatChrono', () => {
  it.each([
    [130, '2:10'],
    [60, '1:00'],
    [9, '0:09'],
    [0, '0:00'],
    [-3, '0:00'],
  ])('%i s → %s', (s, attendu) => {
    expect(formatChrono(s)).toBe(attendu);
  });
});

describe('formatDuree', () => {
  it.each([
    [130, '2 min 10'],
    [520, '8 min 40'],
    [600, '10 min'],
    [1120, '18 min 40'],
    [45, '45 s'],
    [0, '0 s'],
  ])('%i s → %s', (s, attendu) => {
    expect(formatDuree(s)).toBe(attendu);
  });
});
