import { describe, expect, it } from 'vitest';
import { jetonsApres, jetonsDeDepart, miseValide, totalMise } from './jetons';
import { scoreQuiz } from './quiz';

describe('les jetons de départ', () => {
  it('valent l’effectif de la plus grande équipe, pour toutes', () => {
    expect(jetonsDeDepart([12, 13, 9])).toBe(13);
    expect(jetonsDeDepart([5])).toBe(5);
  });

  it('valent zéro sans équipe, et ignorent un effectif négatif', () => {
    expect(jetonsDeDepart([])).toBe(0);
    expect(jetonsDeDepart([-2, 3])).toBe(3);
  });
});

describe('une mise', () => {
  it('peut se poser en plusieurs fois, sans dépasser les jetons disponibles', () => {
    expect(miseValide([2, 0, 1, 0], 13, false)).toBe(true);
    expect(miseValide([0, 0, 0, 0], 13, false)).toBe(true);
    expect(miseValide([10, 4, 0, 0], 13, false)).toBe(false);
  });

  it('ne se valide qu’avec tous les jetons posés', () => {
    expect(miseValide([8, 0, 1, 4], 13, true)).toBe(true);
    expect(miseValide([8, 0, 1, 3], 13, true)).toBe(false);
  });

  it('refuse un nombre négatif, décimal, ou une réponse de trop ou de moins', () => {
    expect(miseValide([-1, 14, 0, 0], 13, true)).toBe(false);
    expect(miseValide([1.5, 11.5, 0, 0], 13, true)).toBe(false);
    expect(miseValide([13, 0, 0], 13, true)).toBe(false);
    expect(miseValide([13, 0, 0, 0, 0], 13, true)).toBe(false);
  });

  it('se totalise', () => {
    expect(totalMise([8, 0, 1, 4])).toBe(13);
  });
});

describe('après une question', () => {
  it('l’équipe garde les jetons posés sur la bonne réponse', () => {
    expect(jetonsApres([8, 0, 1, 4], 0)).toBe(8);
    expect(jetonsApres([8, 0, 1, 4], 3)).toBe(4);
    expect(jetonsApres([8, 0, 1, 4], 1)).toBe(0);
  });

  it('les jetons restants se comptent comme des survivants : × 100', () => {
    expect(scoreQuiz({ 1: jetonsApres([8, 0, 1, 4], 0), 2: 0 })).toEqual({ 1: 800, 2: 0 });
  });
});
