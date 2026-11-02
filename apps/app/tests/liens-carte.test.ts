import { describe, expect, it } from 'vitest';
import { estAdresseCarte } from '../src/carte/liens';

describe("l'adresse de la carte tapée à la main", () => {
  it('reconnaît les fautes courantes : accent, majuscule, sans « s »', () => {
    for (const segment of ['Soirees', 'soirées', 'Soirée', 'soiree', 'SOIREES', 'soir%C3%A9es']) {
      expect(estAdresseCarte(segment)).toBe(true);
    }
  });

  it('laisse passer les codes de salle et le reste', () => {
    for (const segment of ['K7P2M9', 'SOIRE', 'soirees2', 'jeux', '%E0%A4%A']) {
      expect(estAdresseCarte(segment)).toBe(false);
    }
  });
});
