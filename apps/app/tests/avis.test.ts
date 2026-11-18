import { describe, expect, it } from 'vitest';
import {
  AVIS_NEGATIF_MAX,
  AVIS_POSITIF_MAX,
  negatifValide,
  nettoyerLigne,
  nettoyerTexte,
  positifsValides,
  restantsNegatif,
  restantsPositif,
  syntheseAvis,
  type AvisLu,
} from '../src/lib/avis';
import { csvAvis } from '../src/lib/export';

const avis = (partiel: Partial<AvisLu> = {}): AvisLu => ({
  id: 'a',
  positifs: ["L'ambiance"],
  negatif: null,
  rien_a_redire: true,
  citable: false,
  prenom: null,
  langue: 'fr',
  modifie_le: '2026-11-18T22:00:00Z',
  ...partiel,
});

describe('nettoyage des textes', () => {
  it('une chose aimée tient sur une ligne', () => {
    expect(nettoyerLigne('  Le  quiz\naux\tjetons\u0007 ')).toBe('Le quiz aux jetons');
  });

  it('ce qui a moins plu garde ses sauts de ligne, deux au plus', () => {
    expect(nettoyerTexte('  Le son\r\n\r\n\r\n\r\ntrop  fort \t\n  ensuite ')).toBe(
      'Le son\n\ntrop fort\nensuite',
    );
  });

  it('compte les caractères comme la base (un émoji en vaut un)', () => {
    expect(restantsPositif('🎉'.repeat(10))).toBe(AVIS_POSITIF_MAX - 10);
    expect(restantsNegatif('a\n\n\nb')).toBe(AVIS_NEGATIF_MAX - 4);
  });
});

describe('positifsValides', () => {
  it('garde les champs remplis, dans l’ordre', () => {
    expect(positifsValides(['', ' Les jeux ', 'Le podium'])).toEqual(['Les jeux', 'Le podium']);
  });

  it('refuse sans aucune chose aimée', () => {
    expect(positifsValides(['', '  ', ''])).toBeNull();
  });

  it('refuse plus de trois choses ou une chose trop longue', () => {
    expect(positifsValides(['a', 'b', 'c', 'd'])).toBeNull();
    expect(positifsValides(['a', 'x'.repeat(AVIS_POSITIF_MAX + 1)])).toBeNull();
    expect(positifsValides(['x'.repeat(AVIS_POSITIF_MAX)])).toHaveLength(1);
  });
});

describe('negatifValide', () => {
  it('vide ou trop long : refusé', () => {
    expect(negatifValide(' \n ')).toBeNull();
    expect(negatifValide('x'.repeat(AVIS_NEGATIF_MAX + 1))).toBeNull();
    expect(negatifValide(' Trop long ')).toBe('Trop long');
  });
});

describe('syntheseAvis', () => {
  it('compte les réponses, les « rien à redire » et les citables', () => {
    const liste = [
      avis(),
      avis({ id: 'b', rien_a_redire: false, negatif: 'Le son', citable: true, prenom: 'Léa' }),
    ];
    expect(syntheseAvis(liste, 8)).toEqual({ recus: 2, taux: 0.25, rienARedire: 1, citables: 1 });
  });

  it('taux borné à 1 (un joueur retiré garde son avis), nul sans joueur', () => {
    expect(syntheseAvis([avis(), avis({ id: 'b' })], 1).taux).toBe(1);
    expect(syntheseAvis([], 0).taux).toBeNull();
  });
});

describe('csvAvis', () => {
  const libelles = {
    heure: 'Heure',
    langue: 'Langue',
    aime: (n: number) => `Aimé ${n}`,
    moinsPlu: 'Moins plu',
    rienARedire: 'Rien à redire',
    citable: 'Citable (prénom)',
  };

  it('une ligne par avis, BOM, point-virgule et CRLF', () => {
    const csv = csvAvis({
      libelles,
      avis: [
        {
          heure: '23:10',
          langue: 'fr',
          positifs: ['Les jeux', 'Le "podium"'],
          negatif: 'Le son;\ntrop fort',
          rienARedire: false,
          prenom: null,
        },
        {
          heure: '23:12',
          langue: 'ta',
          positifs: ['Tout'],
          negatif: null,
          rienARedire: true,
          prenom: 'Léa',
        },
      ],
    });
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.split('\r\n')).toEqual([
      '﻿Heure;Langue;Aimé 1;Aimé 2;Aimé 3;Moins plu;Citable (prénom)',
      '23:10;fr;Les jeux;"Le ""podium""";;"Le son;\ntrop fort";',
      '23:12;ta;Tout;;;Rien à redire;Léa',
      '',
    ]);
  });
});
