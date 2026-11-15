import { describe, expect, it } from 'vitest';
import {
  cheminFond,
  dimensionsFond,
  dimensionsJpeg,
  estCheminFond,
  FOND_PX,
  fondAcceptable,
  fondDeLaScene,
  fondRecadre,
  fondsDuProgramme,
  fondTropPetit,
  recadrage,
  TAILLE_MAX_FOND,
} from '../src/lib/fonds';
import { derniereSoireeExpiree } from '../src/lib/purge';
import type { EtatSalle } from '../src/lib/salle';

/** Un JPEG réduit à ses en-têtes : SOI, un APP0, puis le début d'image (SOF0 ou SOF2). */
function jpeg(largeur: number, hauteur: number, { sof = 0xc0, poids = 64 } = {}): Uint8Array {
  const octets = new Uint8Array(poids);
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const sof0 = [
    0xff,
    sof,
    0x00,
    0x11,
    0x08,
    hauteur >> 8,
    hauteur & 0xff,
    largeur >> 8,
    largeur & 0xff,
    3,
  ];
  octets.set([0xff, 0xd8, ...app0, ...sof0]);
  return octets;
}

const SOIREE = '11111111-1111-4111-8111-111111111111';
const DEPOT = '22222222-2222-4222-8222-222222222222';

describe('recadrage d’une photo de fond', () => {
  it('garde le plus grand 16:9 centré', () => {
    expect(recadrage(1920, 1080)).toEqual({ x: 0, y: 0, largeur: 1920, hauteur: 1080 });
    // Un 4:3 perd le haut et le bas.
    expect(recadrage(4000, 3000)).toEqual({ x: 0, y: 375, largeur: 4000, hauteur: 2250 });
    // Une photo en hauteur ne garde que le milieu.
    expect(recadrage(3000, 4000)).toEqual({ x: 0, y: 1156, largeur: 3000, hauteur: 1688 });
    // Un panorama perd ses côtés.
    expect(recadrage(6000, 1000)).toEqual({ x: 2111, y: 0, largeur: 1778, hauteur: 1000 });
  });

  it('réduit à la taille de la scène, sans jamais agrandir', () => {
    expect(dimensionsFond(recadrage(4000, 3000))).toEqual(FOND_PX);
    expect(dimensionsFond(recadrage(1280, 720))).toEqual({ largeur: 1280, hauteur: 720 });
  });

  it('prévient d’une photo en hauteur et d’une photo trop petite, sans les refuser', () => {
    expect(fondRecadre(4000, 3000)).toBe(false);
    expect(fondRecadre(3000, 4000)).toBe(true);
    expect(fondTropPetit(recadrage(1920, 1080))).toBe(false);
    expect(fondTropPetit(recadrage(800, 600))).toBe(true);
  });

  it('refuse une image sans dimensions', () => {
    expect(() => recadrage(0, 100)).toThrow(RangeError);
  });
});

describe('contrôle du JPEG par le serveur', () => {
  it('lit les dimensions du début d’image, de base ou progressif', () => {
    expect(dimensionsJpeg(jpeg(1920, 1080))).toEqual({ largeur: 1920, hauteur: 1080 });
    expect(dimensionsJpeg(jpeg(1200, 675, { sof: 0xc2 }))).toEqual({ largeur: 1200, hauteur: 675 });
  });

  it('ne prend pas un autre fichier pour un JPEG', () => {
    expect(
      dimensionsJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])),
    ).toBeNull();
    expect(dimensionsJpeg(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
    // Un en-tête de Huffman (C4) n'est pas un début d'image.
    expect(dimensionsJpeg(jpeg(1920, 1080, { sof: 0xc4 }))).toBeNull();
  });

  it('accepte un JPEG dans la taille et le poids de la scène, et rien d’autre', () => {
    expect(fondAcceptable(jpeg(1920, 1080))).toBe(true);
    expect(fondAcceptable(jpeg(1921, 1080))).toBe(false);
    expect(fondAcceptable(jpeg(1920, 1080, { poids: TAILLE_MAX_FOND + 1 }))).toBe(false);
    expect(fondAcceptable(new Uint8Array())).toBe(false);
  });
});

describe('photo de la scène', () => {
  const fond = cheminFond(SOIREE, DEPOT);
  const etat = (scene: string, manche: string | null) =>
    ({
      pilotage: { scene, manche_id: manche },
      programme: [
        { id: 'm1', fond },
        { id: 'm2', fond: null },
        { id: 'm3', fond: '../ailleurs.jpg' },
        { id: 'm4', fond },
      ],
    }) as unknown as EtatSalle;

  it('n’accepte que les chemins de la forme posée par la base', () => {
    expect(fond).toBe(`${SOIREE}/${DEPOT}.jpg`);
    expect(estCheminFond(fond)).toBe(true);
    expect(estCheminFond(`${SOIREE}/${DEPOT}.png`)).toBe(false);
    expect(estCheminFond('../ailleurs.jpg')).toBe(false);
    expect(estCheminFond(null)).toBe(false);
  });

  it('télécharge chaque photo du programme une fois', () => {
    expect(fondsDuProgramme(etat('accueil', null))).toEqual([fond]);
  });

  it('montre la photo du jeu en cours, pendant le jeu seulement', () => {
    expect(fondDeLaScene(etat('jeu', 'm1'))).toBe(fond);
    expect(fondDeLaScene(etat('intro', 'm1'))).toBeNull();
    expect(fondDeLaScene(etat('scores', 'm1'))).toBeNull();
    expect(fondDeLaScene(etat('jeu', 'm2'))).toBeNull();
    expect(fondDeLaScene(etat('jeu', 'm3'))).toBeNull();
    expect(fondDeLaScene(etat('jeu', null))).toBeNull();
  });
});

describe('conservation des photos de fond', () => {
  it('expire le 31e jour après la soirée, comme les photos du Photo challenge', () => {
    expect(derniereSoireeExpiree(new Date('2026-12-15T02:59:00Z'))).toBe('2026-11-14');
    expect(derniereSoireeExpiree(new Date('2026-03-02T23:00:00Z'))).toBe('2026-01-30');
  });
});
