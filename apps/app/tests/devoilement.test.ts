import { describe, expect, it } from 'vitest';
import {
  DEPARTS_DEBUT_MS,
  DUREE_DEVOILEMENT_MS,
  ECHELLE_TOURBILLON,
  TOURBILLON_DEBUT_MS,
  VOL_MS,
  avanceeDuVol,
  departDu,
  etatDuPrenom,
  ordreDesDeparts,
  placesDuTourbillon,
} from '../src/lib/devoilement';

const ellipse = { cx: 960, cy: 540, rx: 600, ry: 300 };

describe('le dévoilement des équipes', () => {
  it('dure le roulement de tambour : la cymbale à 5 s', () => {
    expect(DUREE_DEVOILEMENT_MS).toBe(5000);
  });

  it('fait partir un prénom par équipe à tour de rôle', () => {
    expect(ordreDesDeparts([3, 1, 2])).toEqual([
      { equipe: 0, rang: 0 },
      { equipe: 1, rang: 0 },
      { equipe: 2, rang: 0 },
      { equipe: 0, rang: 1 },
      { equipe: 2, rang: 1 },
      { equipe: 0, rang: 2 },
    ]);
    expect(ordreDesDeparts([])).toEqual([]);
  });

  it.each([1, 2, 30, 150])('pose les %i prénoms avant la cymbale', (total) => {
    const departs = Array.from({ length: total }, (_, k) => departDu(k, total));
    expect(departs[0]).toBe(DEPARTS_DEBUT_MS);
    for (let k = 1; k < total; k++) expect(departs[k]!).toBeGreaterThanOrEqual(departs[k - 1]!);
    expect(Math.max(...departs) + VOL_MS).toBeLessThan(DUREE_DEVOILEMENT_MS);
  });

  it('tire les mêmes places du tourbillon pour la même graine', () => {
    const a = placesDuTourbillon(20, 'ev-1700000000000');
    expect(placesDuTourbillon(20, 'ev-1700000000000')).toEqual(a);
    expect(placesDuTourbillon(20, 'ev-1700000009999')).not.toEqual(a);
    for (const p of a) {
      expect(p.rayon).toBeGreaterThanOrEqual(0.25);
      expect(p.rayon).toBeLessThanOrEqual(1);
    }
  });

  it('un prénom paraît dans le tourbillon, file vers sa carte et s’y pose', () => {
    const [place] = placesDuTourbillon(1, 'graine');
    const arrivee = { x: 200, y: 900 };
    const avant = etatDuPrenom(0, place!, 3000, arrivee, ellipse);
    expect(avant.opacite).toBe(0);
    const tourbillon = etatDuPrenom(2000, place!, 3000, arrivee, ellipse);
    expect(tourbillon).toMatchObject({ opacite: 1, echelle: ECHELLE_TOURBILLON });
    expect(Math.abs(tourbillon.x - ellipse.cx)).toBeLessThanOrEqual(ellipse.rx);
    expect(Math.abs(tourbillon.y - ellipse.cy)).toBeLessThanOrEqual(ellipse.ry);
    const pose = etatDuPrenom(3000 + VOL_MS, place!, 3000, arrivee, ellipse);
    expect(pose).toEqual({ x: 200, y: 900, echelle: 1, opacite: 1 });
    expect(etatDuPrenom(TOURBILLON_DEBUT_MS, place!, 3000, arrivee, ellipse).opacite).toBe(0);
  });

  it('adoucit le vol, sans jamais dépasser l’arrivée', () => {
    expect(avanceeDuVol(0, 100)).toBe(0);
    expect(avanceeDuVol(100 + VOL_MS / 2, 100)).toBeGreaterThan(0.5);
    expect(avanceeDuVol(100 + VOL_MS * 2, 100)).toBe(1);
  });
});
