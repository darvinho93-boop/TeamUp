import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  deploiement,
  ecrireMonogramme,
  lireMonogramme,
  REVELATION,
  REVELATION_MS,
} from '../src/lib/logo-soiree';

describe('le monogramme saisi à la Salle', () => {
  it('se lit en parties séparées par |', () => {
    expect(lireMonogramme('V | M')).toEqual(['V', 'M']);
    expect(lireMonogramme(' V|M ')).toEqual(['V', 'M']);
    expect(lireMonogramme('30')).toEqual(['30']);
    expect(lireMonogramme('A | B | C')).toEqual(['A', 'B', 'C']);
  });

  it('refuse le vide, plus de trois parties, une partie de plus de trois caractères', () => {
    expect(lireMonogramme('')).toBeNull();
    expect(lireMonogramme(' | ')).toBeNull();
    expect(lireMonogramme('A | B | C | D')).toBeNull();
    expect(lireMonogramme('VMAB')).toBeNull();
  });

  it('se réécrit pour remplir le champ', () => {
    expect(ecrireMonogramme(['V', 'M'])).toBe('V | M');
  });
});

describe('le déploiement du monogramme en titre', () => {
  it('rattache chaque initiale à son mot, le liant entre les deux', () => {
    expect(deploiement(['V', 'M'], 'Vinoyan & Mélanie')).toEqual([
      { type: 'mot', initiale: 'V', tete: 'V', reste: 'inoyan' },
      { type: 'texte', texte: ' & ' },
      { type: 'mot', initiale: 'M', tete: 'M', reste: 'élanie' },
    ]);
  });

  it('ne tient compte ni des accents ni de la casse', () => {
    expect(deploiement(['E', 'a'], 'élodie et Arthur')).toEqual([
      { type: 'mot', initiale: 'E', tete: 'é', reste: 'lodie' },
      { type: 'texte', texte: ' et ' },
      { type: 'mot', initiale: 'a', tete: 'A', reste: 'rthur' },
    ]);
  });

  it('garde le texte qui précède et qui suit', () => {
    expect(deploiement(['30'], 'Les 30 ans de Léa')).toEqual([
      { type: 'texte', texte: 'Les ' },
      { type: 'mot', initiale: '30', tete: '30', reste: '' },
      { type: 'texte', texte: ' ans de Léa' },
    ]);
  });

  it('renonce quand une initiale ne trouve pas son mot', () => {
    expect(deploiement(['T', 'U'], 'Séminaire Acme')).toBeNull();
    // Dans le désordre : M prend « Mélanie », V ne trouve plus de mot après lui.
    expect(deploiement(['M', 'V'], 'Vinoyan & Mélanie')).toBeNull();
  });
});

describe('le minutage de la révélation', () => {
  it('avance étape par étape', () => {
    const etapes = Object.values(REVELATION);
    expect([...etapes].sort((a, b) => a - b)).toEqual(etapes);
  });

  it('dure autant que le token --tu-dur-revelation', () => {
    const tokens = readFileSync(
      new URL('../../../packages/ui/src/styles/tokens-layout.css', import.meta.url),
      'utf8',
    );
    expect(tokens).toContain(`--tu-dur-revelation: ${REVELATION_MS}ms;`);
  });
});
