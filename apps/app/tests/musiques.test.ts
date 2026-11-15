import { describe, expect, it } from 'vitest';
import {
  cheminMusique,
  estMp3,
  musiquesDe,
  refusMusique,
  TAILLE_MAX_MUSIQUE,
  tailleLisible,
} from '../src/lib/musiques';

const ID3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00]);
const TRAME = new Uint8Array([0xff, 0xfb, 0x90, 0x64]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

describe('un MP3 de la bibliothèque', () => {
  it('se reconnaît à son étiquette ID3 ou à sa première trame', () => {
    expect(estMp3(ID3)).toBe(true);
    expect(estMp3(TRAME)).toBe(true);
    expect(estMp3(PNG)).toBe(false);
    expect(estMp3(new Uint8Array([0xff]))).toBe(false);
    expect(estMp3(new Uint8Array([0xff, 0x1f, 0x00]))).toBe(false);
  });

  it('a un titre de 1 à 80 caractères, et pèse au plus 15 Mo', () => {
    const fichier = { taille: 1000, debut: ID3 };
    expect(refusMusique('Générique', fichier)).toBeNull();
    expect(refusMusique('   ', fichier)).toBe('titre');
    expect(refusMusique('x'.repeat(81), fichier)).toBe('titre');
    expect(refusMusique('Vide', { taille: 0, debut: ID3 })).toBe('vide');
    expect(refusMusique('Lourd', { taille: TAILLE_MAX_MUSIQUE + 1, debut: ID3 })).toBe('taille');
    expect(refusMusique('Renommé', { taille: 1000, debut: PNG })).toBe('format');
  });

  it('se range sous un uuid neuf, et sa taille se lit en Mo', () => {
    expect(cheminMusique('a1b2')).toBe('a1b2.mp3');
    expect(tailleLisible(3.5 * 1024 * 1024, 'fr')).toBe('3,5 Mo');
    expect(tailleLisible(1024 * 1024, 'en')).toBe('1.0 Mo');
    expect(tailleLisible(16_526, 'fr')).toBe('16 Ko');
    expect(tailleLisible(10, 'fr')).toBe('1 Ko');
  });
});

describe('les musiques cochées d’une manche', () => {
  it('se lisent dans les options, sans doublon ni valeur étrangère', () => {
    expect(musiquesDe(undefined)).toEqual([]);
    expect(musiquesDe({})).toEqual([]);
    expect(musiquesDe({ musiques: 'a' })).toEqual([]);
    expect(musiquesDe({ musiques: ['a', 'b', 'a', 3, '', null] })).toEqual(['a', 'b']);
  });
});
