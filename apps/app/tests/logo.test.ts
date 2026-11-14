import { describe, expect, it } from 'vitest';
import {
  aUnFond,
  BOITE_LOGO_PX,
  cadreUtile,
  cheminLogo,
  dimensionsLogo,
  dimensionsPng,
  LOGO_MAX_PX,
  logoAcceptable,
  logoTropPetit,
  TAILLE_MAX_LOGO,
  urlLogo,
} from '../src/lib/logo';

/** Une image RGBA transparente, avec un rectangle plein (alpha donné) posé dedans. */
function image(
  largeur: number,
  hauteur: number,
  pleins: { x: number; y: number; l: number; h: number; alpha?: number }[],
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(largeur * hauteur * 4);
  for (const { x, y, l, h, alpha = 255 } of pleins) {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + l; i++) rgba[(j * largeur + i) * 4 + 3] = alpha;
    }
  }
  return rgba;
}

/** L'en-tête d'un PNG de ces dimensions, complété de zéros jusqu'au poids voulu. */
function png(largeur: number, hauteur: number, poids = 64): Uint8Array {
  const octets = new Uint8Array(poids);
  octets.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const vue = new DataView(octets.buffer);
  vue.setUint32(16, largeur);
  vue.setUint32(20, hauteur);
  return octets;
}

const SOIREE = '11111111-2222-4333-8444-555555555555';
const DEPOT = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('rognage du logo', () => {
  it('garde la boîte des pixels visibles, marges vides retirées', () => {
    const rgba = image(20, 10, [{ x: 4, y: 2, l: 10, h: 5 }]);
    expect(cadreUtile(rgba, 20, 10)).toEqual({ x: 4, y: 2, largeur: 10, hauteur: 5 });
  });

  it('englobe des morceaux séparés', () => {
    const rgba = image(20, 10, [
      { x: 1, y: 1, l: 2, h: 2 },
      { x: 15, y: 6, l: 3, h: 3 },
    ]);
    expect(cadreUtile(rgba, 20, 10)).toEqual({ x: 1, y: 1, largeur: 17, hauteur: 8 });
  });

  it("ne compte pas les bavures presque transparentes d'un export", () => {
    const rgba = image(20, 10, [
      { x: 0, y: 0, l: 20, h: 10, alpha: 3 },
      { x: 5, y: 5, l: 4, h: 2 },
    ]);
    expect(cadreUtile(rgba, 20, 10)).toEqual({ x: 5, y: 5, largeur: 4, hauteur: 2 });
  });

  it('garde une image pleine telle quelle', () => {
    const rgba = image(6, 4, [{ x: 0, y: 0, l: 6, h: 4 }]);
    expect(cadreUtile(rgba, 6, 4)).toEqual({ x: 0, y: 0, largeur: 6, hauteur: 4 });
  });

  it('ne trouve rien dans une image entièrement transparente', () => {
    expect(cadreUtile(image(8, 8, []), 8, 8)).toBeNull();
  });
});

describe('fond du logo', () => {
  it('reconnaît un fichier avec fond : ses quatre coins sont pleins', () => {
    const rgba = image(6, 4, [{ x: 0, y: 0, l: 6, h: 4 }]);
    expect(aUnFond(rgba, 6, cadreUtile(rgba, 6, 4)!)).toBe(true);
  });

  it('laisse passer un logo détouré, dont un coin au moins est vide', () => {
    // Un « L » : le coin haut droit de son cadre est transparent.
    const rgba = image(10, 10, [
      { x: 2, y: 2, l: 2, h: 6 },
      { x: 2, y: 6, l: 6, h: 2 },
    ]);
    expect(aUnFond(rgba, 10, cadreUtile(rgba, 10, 10)!)).toBe(false);
  });
});

describe('dimensions du logo gardé', () => {
  it('fait quatre fois la boîte affichée, celle de la marque Team Up!', () => {
    expect(BOITE_LOGO_PX).toEqual({ largeur: 336, hauteur: 88 });
    expect(LOGO_MAX_PX).toEqual({ largeur: 1344, hauteur: 352 });
  });

  it('borne un logo large par la largeur, un logo haut par la hauteur', () => {
    expect(dimensionsLogo(4000, 500)).toEqual({ largeur: 1344, hauteur: 168 });
    expect(dimensionsLogo(2000, 2000)).toEqual({ largeur: 352, hauteur: 352 });
  });

  it("n'agrandit jamais un petit logo", () => {
    expect(dimensionsLogo(300, 80)).toEqual({ largeur: 300, hauteur: 80 });
  });

  it('refuse une image sans dimensions', () => {
    expect(() => dimensionsLogo(0, 10)).toThrow(RangeError);
  });

  it("signale un logo que l'écran devra agrandir", () => {
    expect(logoTropPetit(120, 40)).toBe(true);
    // Il remplit déjà la boîte dans un sens : affiché tel quel ou réduit.
    expect(logoTropPetit(400, 40)).toBe(false);
    expect(logoTropPetit(90, 90)).toBe(false);
  });
});

describe('contrôle du PNG par le serveur', () => {
  it("lit les dimensions dans l'en-tête", () => {
    expect(dimensionsPng(png(640, 160))).toEqual({ largeur: 640, hauteur: 160 });
  });

  it("refuse ce qui n'est pas un PNG, quel que soit le type annoncé", () => {
    const jpeg = new Uint8Array(64);
    jpeg.set([0xff, 0xd8, 0xff, 0xe0]);
    expect(dimensionsPng(jpeg)).toBeNull();
    expect(
      dimensionsPng(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ).toBeNull();
    expect(dimensionsPng(png(640, 160).slice(0, 20))).toBeNull();
    expect(dimensionsPng(png(0, 160))).toBeNull();
  });

  it('accepte un PNG dans les dimensions et le poids prévus', () => {
    expect(logoAcceptable(png(1344, 352))).toBe(true);
    expect(logoAcceptable(png(640, 160, TAILLE_MAX_LOGO))).toBe(true);
  });

  it('refuse un PNG trop grand, trop lourd ou vide', () => {
    expect(logoAcceptable(png(1345, 100))).toBe(false);
    expect(logoAcceptable(png(100, 353))).toBe(false);
    expect(logoAcceptable(png(640, 160, TAILLE_MAX_LOGO + 1))).toBe(false);
    expect(logoAcceptable(new Uint8Array(0))).toBe(false);
  });
});

describe('adresse du logo', () => {
  const BASE = 'https://exemple.supabase.co';

  it('range chaque dépôt dans le dossier de la soirée', () => {
    expect(cheminLogo(SOIREE, DEPOT)).toBe(`${SOIREE}/${DEPOT}.png`);
  });

  it("donne l'adresse publique du bucket", () => {
    expect(urlLogo(cheminLogo(SOIREE, DEPOT), BASE)).toBe(
      `${BASE}/storage/v1/object/public/logos/${SOIREE}/${DEPOT}.png`,
    );
    expect(urlLogo(cheminLogo(SOIREE, DEPOT), `${BASE}/`)).toBe(
      `${BASE}/storage/v1/object/public/logos/${SOIREE}/${DEPOT}.png`,
    );
  });

  it('ne donne rien sans logo, ni sans la migration', () => {
    expect(urlLogo(null, BASE)).toBeNull();
    expect(urlLogo(undefined, BASE)).toBeNull();
  });

  it("ignore un chemin d'une autre forme", () => {
    expect(urlLogo('../photos/secret.jpg', BASE)).toBeNull();
    expect(urlLogo(`${SOIREE}/logo.png`, BASE)).toBeNull();
    expect(urlLogo(`${SOIREE}/${DEPOT}.png?x=1`, BASE)).toBeNull();
  });
});
