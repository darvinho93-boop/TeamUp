import { describe, expect, it } from 'vitest';
import { formatDuree } from './chrono';
import { dureeElement, dureeProgramme, type ElementProgramme } from './programme';

/** Le programme complet de la spec : quiz 4 questions, surenchère 3 thèmes, diffusion photo. */
function programmeComplet(equipes: number): ElementProgramme[] {
  return [
    { jeu: 'list2', passages: equipes },
    { jeu: 'qcm2', questions: 4 },
    { jeu: 'enchere2', themes: 3 },
    { jeu: 'mime2', passages: equipes },
    { jeu: 'photo2' },
  ];
}

describe('budget de minutes de la spec v3', () => {
  // équipes, Points communs, Mime, total séquentiel, total avec transitions (≈ min)
  it.each([
    [4, '8 min 40', '10 min', '18 min 40', 36],
    [5, '10 min 50', '12 min 30', '23 min 20', 42],
    [6, '13 min', '15 min', '28 min', 47],
    [8, '17 min 20', '20 min', '37 min 20', 58],
  ])(
    '%i équipes : Points communs %s, Mime %s, séquentiel %s, ≈ %i min',
    (equipes, list2, mime2, sequentiel, totalMin) => {
      expect(formatDuree(dureeElement({ jeu: 'list2', passages: equipes }))).toBe(list2);
      expect(formatDuree(dureeElement({ jeu: 'mime2', passages: equipes }))).toBe(mime2);

      const duree = dureeProgramme(programmeComplet(equipes));
      expect(formatDuree(duree.sequentielS)).toBe(sequentiel);
      expect(duree.totalMin).toBe(totalMin);
    },
  );

  it('compte 13 minutes de socle non séquentiel, quel que soit le nombre d’équipes', () => {
    expect(dureeElement({ jeu: 'qcm2', questions: 4 })).toBe(2 * 60);
    expect(dureeElement({ jeu: 'enchere2', themes: 3 })).toBe(6 * 60);
    expect(dureeElement({ jeu: 'photo2' })).toBe(5 * 60);
    for (const equipes of [4, 5, 6, 8]) {
      expect(dureeProgramme(programmeComplet(equipes)).nonSequentielS).toBe(13 * 60);
    }
  });

  it('ajoute 15 % de transitions aux chronos', () => {
    const duree = dureeProgramme(programmeComplet(4));
    expect(duree.chronosS).toBe(1900); // 18 min 40 + 13 min
    expect(duree.transitionsS).toBe(285);
    expect(duree.totalS).toBe(2185);
  });
});

describe('créneau de 40 minutes (spec, 15/08)', () => {
  it('tient à 4 équipes', () => {
    expect(dureeProgramme(programmeComplet(4), { creneauMin: 40 }).depassement).toBeUndefined();
  });

  it.each([
    [5, 2],
    [6, 8],
    [8, 18],
  ])('déborde à %i équipes, de %i min', (equipes, ecartMin) => {
    expect(dureeProgramme(programmeComplet(equipes), { creneauMin: 40 }).depassement).toEqual({
      creneauMin: 40,
      ecartMin,
    });
  });

  it('tient à 5 équipes en retirant un thème de surenchère', () => {
    const allege = programmeComplet(5).map((e) => (e.jeu === 'enchere2' ? { ...e, themes: 2 } : e));
    expect(dureeProgramme(allege, { creneauMin: 40 }).depassement).toBeUndefined();
  });

  it('tient à 6 équipes sans un des deux jeux séquentiels', () => {
    const sansMime = programmeComplet(6).filter((e) => e.jeu !== 'mime2');
    expect(dureeProgramme(sansMime, { creneauMin: 40 }).depassement).toBeUndefined();
  });

  it('accepte moins de passages que d’équipes', () => {
    expect(dureeElement({ jeu: 'mime2', passages: 2 })).toBe(300);
  });
});

describe('duels en bêta', () => {
  it('comptent 30 s par duel pour Attrape l’objet et 45 s pour le gobelet', () => {
    expect(dureeElement({ jeu: 'grab', duels: 4 })).toBe(120);
    expect(dureeElement({ jeu: 'cup', duels: 4 })).toBe(180);
    expect(dureeProgramme([{ jeu: 'cup', duels: 2 }]).nonSequentielS).toBe(90);
  });
});

describe('garde-fous', () => {
  it('refuse un nombre négatif ou fractionnaire', () => {
    expect(() => dureeElement({ jeu: 'qcm2', questions: -1 })).toThrow(RangeError);
    expect(() => dureeElement({ jeu: 'list2', passages: 2.5 })).toThrow(RangeError);
  });

  it('vaut zéro pour un programme vide', () => {
    expect(dureeProgramme([]).totalS).toBe(0);
  });
});
