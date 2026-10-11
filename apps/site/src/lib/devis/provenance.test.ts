import { describe, expect, it } from 'vitest';
import { libelleProvenance, provenanceDepuis } from './provenance';

describe('provenanceDepuis', () => {
  it("lit le lien partagé et la page d'origine dans une adresse", () => {
    const adresse = new URLSearchParams('via=whatsapp&depuis=particuliers&type=particulier');
    expect(provenanceDepuis(adresse)).toEqual({ via: 'whatsapp', depuis: 'particuliers' });
  });

  it('lit les mêmes champs dans un formulaire', () => {
    const formulaire = new FormData();
    formulaire.set('via', 'instagram');
    expect(provenanceDepuis(formulaire)).toEqual({ via: 'instagram', depuis: undefined });
  });

  it("écarte tout ce qui n'est pas une étiquette courte", () => {
    for (const valeur of ['', 'WhatsApp', 'a b', '<script>', 'x'.repeat(25), 'été']) {
      const adresse = new URLSearchParams({ via: valeur, depuis: valeur });
      expect(provenanceDepuis(adresse)).toEqual({ via: undefined, depuis: undefined });
    }
  });
});

describe('libelleProvenance', () => {
  it('ne dit rien quand on ne sait rien', () => {
    expect(libelleProvenance({})).toBeUndefined();
  });

  it('nomme le lien partagé et la page', () => {
    expect(libelleProvenance({ via: 'whatsapp', depuis: 'les-jeux' })).toBe(
      'lien partagé sur WhatsApp ; formulaire ouvert depuis la page « les-jeux »',
    );
  });

  it("garde telle quelle une étiquette qu'il ne connaît pas", () => {
    expect(libelleProvenance({ via: 'flyer-salon' })).toBe('flyer-salon');
  });
});
