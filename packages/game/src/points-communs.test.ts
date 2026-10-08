import { describe, expect, it } from 'vitest';
import {
  CHRONO_POINTS_COMMUNS_S,
  etatPaliers,
  PALIERS,
  REPRISE_APRES_INDICE_S,
  SCORE_MAX_POINTS_COMMUNS,
  scorePointsCommuns,
  tempsDeJeu,
} from './points-communs';

const s = (secondes: number) => secondes * 1000;

describe('paliers de Points communs', () => {
  it('suivent la spec : 60 / 35 / 35 s, ×3 / ×2 / ×1, 130 s au total', () => {
    expect(PALIERS.map((p) => [p.dureeS, p.multiplicateur])).toEqual([
      [60, 3],
      [35, 2],
      [35, 1],
    ]);
    expect(PALIERS.reduce((t, p) => t + p.dureeS, 0)).toBe(CHRONO_POINTS_COMMUNS_S);
  });

  it('commencent au palier 1, sans indice', () => {
    expect(etatPaliers(0)).toEqual({
      palier: 0,
      multiplicateur: 3,
      resteDansPalierS: 60,
      resteTotalS: 130,
      indices: 0,
      termine: false,
    });
  });

  it('passent au palier 2 après 60 s, avec un indice', () => {
    expect(etatPaliers(s(59)).palier).toBe(0);
    expect(etatPaliers(s(59)).resteDansPalierS).toBe(1);
    expect(etatPaliers(s(60))).toMatchObject({
      palier: 1,
      multiplicateur: 2,
      resteDansPalierS: 35,
      indices: 1,
    });
  });

  it('passent au palier 3 après 95 s, avec deux indices', () => {
    expect(etatPaliers(s(95))).toMatchObject({
      palier: 2,
      multiplicateur: 1,
      resteDansPalierS: 35,
      indices: 2,
      termine: false,
    });
  });

  it('se terminent à 130 s et y restent', () => {
    for (const ecoule of [s(130), s(200)]) {
      expect(etatPaliers(ecoule)).toMatchObject({
        palier: 2,
        resteDansPalierS: 0,
        resteTotalS: 0,
        indices: 2,
        termine: true,
      });
    }
  });
});

describe('barème de Points communs', () => {
  it('vaut 285 au maximum, trouvé au départ', () => {
    expect(SCORE_MAX_POINTS_COMMUNS).toBe(285);
    expect(scorePointsCommuns(0)).toBe(285);
  });

  it('vaut 0 en échec', () => {
    expect(scorePointsCommuns('echec')).toBe(0);
  });

  it.each([
    // écoulé (s), score attendu, calcul
    [10, 50 * 3 + 70 + 35], // palier 1 : reste 50
    [59, 1 * 3 + 70 + 35], // dernière seconde du palier 1
    [60, 35 * 2 + 35], // début du palier 2
    [80, 15 * 2 + 35], // palier 2 : reste 15
    [95, 35], // début du palier 3
    [120, 10], // palier 3 : reste 10
    [129, 1],
    [130, 0], // chrono écoulé
    [300, 0],
  ])('trouvé après %i s → %i points', (ecoule, attendu) => {
    expect(scorePointsCommuns(s(ecoule))).toBe(attendu);
  });

  it('compte la seconde entière restante, arrondie à l’inférieur', () => {
    expect(scorePointsCommuns(1)).toBe(scorePointsCommuns(s(1)));
    expect(scorePointsCommuns(s(10) + 400)).toBe(49 * 3 + 70 + 35);
  });

  it('ne remonte jamais quand le temps avance', () => {
    let precedent = Infinity;
    for (let ms = 0; ms <= s(131); ms += 250) {
      const score = scorePointsCommuns(ms);
      expect(score).toBeLessThanOrEqual(precedent);
      precedent = score;
    }
  });
});

describe('arrêts du chrono de Points communs', () => {
  const R = REPRISE_APRES_INDICE_S;

  it('tourne sans arrêt pendant le premier palier', () => {
    expect(tempsDeJeu(0)).toEqual({ jeuMs: 0, arret: null });
    expect(tempsDeJeu(s(59) + 999)).toEqual({ jeuMs: s(59) + 999, arret: null });
  });

  it('se fige à 60 s et attend l’indice aussi longtemps qu’il faut', () => {
    for (const mur of [s(60), s(75), s(600)]) {
      expect(tempsDeJeu(mur)).toEqual({
        jeuMs: s(60),
        arret: { palier: 1, repriseDansMs: null },
      });
    }
    // Pendant l'arrêt, c'est déjà le palier 2 : il compte en entier.
    expect(etatPaliers(tempsDeJeu(s(75)).jeuMs)).toMatchObject({ palier: 1, resteDansPalierS: 35 });
    expect(scorePointsCommuns(tempsDeJeu(s(75)).jeuMs)).toBe(35 * 2 + 35);
  });

  it('repart seul quelques secondes après l’indice', () => {
    const indices = [s(70)];
    expect(tempsDeJeu(s(70), indices)).toEqual({
      jeuMs: s(60),
      arret: { palier: 1, repriseDansMs: s(R) },
    });
    expect(tempsDeJeu(s(70 + R) - 1, indices).arret).toEqual({ palier: 1, repriseDansMs: 1 });
    expect(tempsDeJeu(s(70 + R), indices)).toEqual({ jeuMs: s(60), arret: null });
    expect(tempsDeJeu(s(70 + R + 20), indices)).toEqual({ jeuMs: s(80), arret: null });
  });

  it('se fige une seconde fois à 95 s de jeu, puis va au bout des 130 s', () => {
    // Premier arrêt de 60 à 70 + R au mur ; le second palier dure 35 s de jeu.
    const second = 70 + R + 35;
    expect(tempsDeJeu(s(second), [s(70)])).toEqual({
      jeuMs: s(95),
      arret: { palier: 2, repriseDansMs: null },
    });
    expect(scorePointsCommuns(tempsDeJeu(s(second + 40), [s(70)]).jeuMs)).toBe(35);

    const indices = [s(70), s(second + 3)];
    const reprise = second + 3 + R;
    expect(tempsDeJeu(s(reprise + 10), indices)).toEqual({ jeuMs: s(105), arret: null });
    expect(tempsDeJeu(s(reprise + 35), indices)).toEqual({ jeuMs: s(130), arret: null });
    expect(tempsDeJeu(s(reprise + 500), indices)).toEqual({ jeuMs: s(130), arret: null });
  });

  it('ne recule jamais et ne dépasse jamais le temps écoulé', () => {
    const indices = [s(64), s(120)];
    let precedent = 0;
    for (let mur = 0; mur <= s(200); mur += 250) {
      const { jeuMs } = tempsDeJeu(mur, indices);
      expect(jeuMs).toBeGreaterThanOrEqual(precedent);
      expect(jeuMs).toBeLessThanOrEqual(mur);
      precedent = jeuMs;
    }
    expect(precedent).toBe(s(130));
  });
});
