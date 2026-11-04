import { describe, expect, it } from 'vitest';
import {
  arretDe,
  bandeDuRouleau,
  chuteDe,
  compteA,
  DUREE_DEVOILEMENT_MS,
  pasDeCascade,
  PREMIER_ARRET_MS,
} from '../src/lib/devoilement';

describe('le dévoilement des équipes, en machine à sous', () => {
  it('dure le roulement de tambour : la cymbale à 5 s', () => {
    expect(DUREE_DEVOILEMENT_MS).toBe(5000);
  });

  it('arrête les cartes l’une après l’autre, dans l’ordre de la grille', () => {
    const arrets = Array.from({ length: 8 }, (_, k) => arretDe(k, 8));
    expect(arrets[0]).toBe(PREMIER_ARRET_MS);
    for (let k = 1; k < 8; k++) expect(arrets[k]!).toBeGreaterThan(arrets[k - 1]!);
    expect(arretDe(0, 1)).toBeGreaterThan(PREMIER_ARRET_MS);
  });

  it.each([1, 2, 4, 8])('pose tous les prénoms de %i équipes avant la cymbale', (equipes) => {
    for (const n of [1, 6, 19, 40]) {
      const derniere = arretDe(equipes - 1, equipes);
      expect(chuteDe(derniere, n - 1, n)).toBeLessThan(DUREE_DEVOILEMENT_MS);
    }
  });

  it('fait tomber les prénoms un à un, plus vite pour une grande équipe', () => {
    expect(pasDeCascade(6)).toBeGreaterThan(pasDeCascade(19));
    expect(chuteDe(2000, 0, 6)).toBe(2000);
    expect(chuteDe(2000, 2, 6)).toBe(2000 + 2 * pasDeCascade(6));
  });

  it('fait monter le compteur de 0 à l’effectif, au rythme des prénoms', () => {
    expect(compteA(1999, 2000, 6, 6)).toBe(0);
    expect(compteA(2000, 2000, 6, 6)).toBe(1);
    expect(compteA(2000 + 2 * pasDeCascade(6), 2000, 6, 6)).toBe(3);
    expect(compteA(5000, 2000, 6, 6)).toBe(6);
    // Une page de 10 prénoms sur 19 : le compteur arrive quand même à 19.
    expect(compteA(5000, 2000, 10, 19)).toBe(19);
    let avant = 0;
    for (let t = 1900; t <= 3000; t += 10) {
      const n = compteA(t, 2000, 10, 19);
      expect(n).toBeGreaterThanOrEqual(avant);
      avant = n;
    }
  });

  it('tire la même bande de rouleau pour la même graine', () => {
    const salle = ['Léa', 'Sam', 'Ana', 'Tom', 'Zoé'];
    const bande = bandeDuRouleau(salle, 'ev-1700000000000-2-0', 12);
    expect(bande).toHaveLength(12);
    expect(bandeDuRouleau(salle, 'ev-1700000000000-2-0', 12)).toEqual(bande);
    expect(bandeDuRouleau(salle, 'ev-1700000000000-2-1', 12)).not.toEqual(bande);
    for (const p of bande) expect(salle).toContain(p);
    expect(bandeDuRouleau([], 'graine', 12)).toEqual([]);
  });
});
