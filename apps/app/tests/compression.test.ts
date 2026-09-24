import { describe, expect, it } from 'vitest';
import { COTE_MAX_PX, dimensionsReduites } from '../src/lib/compression';

describe('compression des photos', () => {
  it('ramène le plus grand côté à 1600 px en gardant les proportions', () => {
    expect(COTE_MAX_PX).toBe(1600);
    expect(dimensionsReduites(4032, 3024)).toEqual({ largeur: 1600, hauteur: 1200 });
    expect(dimensionsReduites(3024, 4032)).toEqual({ largeur: 1200, hauteur: 1600 });
  });

  it("n'agrandit jamais une petite image", () => {
    expect(dimensionsReduites(800, 600)).toEqual({ largeur: 800, hauteur: 600 });
  });

  it('garde au moins un pixel sur une image très allongée', () => {
    expect(dimensionsReduites(10_000, 2)).toEqual({ largeur: 1600, hauteur: 1 });
  });

  it('refuse une image sans dimensions', () => {
    expect(() => dimensionsReduites(0, 100)).toThrow(RangeError);
  });
});
