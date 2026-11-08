import { describe, expect, it } from 'vitest';
import { cleMot, MODES_SURENCHERE, podiumDesMots, POINTS_PODIUM } from './surenchere';

describe('Surenchère en mode téléphones', () => {
  it('a deux modes, la voix d’abord', () => {
    expect(MODES_SURENCHERE).toEqual(['voix', 'telephones']);
  });

  it('donne 100, 60 et 30 au podium du thème', () => {
    expect(POINTS_PODIUM).toEqual([100, 60, 30]);
    expect(podiumDesMots({ 1: 4, 2: 11, 3: 7, 4: 2 })).toEqual({
      rangs: { 1: 3, 2: 1, 3: 2, 4: 4 },
      points: { 2: 100, 3: 60, 1: 30 },
    });
  });

  it('donne les mêmes points aux ex aequo et saute le rang suivant', () => {
    expect(podiumDesMots({ 1: 12, 2: 12, 3: 9 })).toEqual({
      rangs: { 1: 1, 2: 1, 3: 3 },
      points: { 1: 100, 2: 100, 3: 30 },
    });
    expect(podiumDesMots({ 1: 5, 2: 8, 3: 5, 4: 5 })).toEqual({
      rangs: { 1: 2, 2: 1, 3: 2, 4: 2 },
      points: { 1: 60, 2: 100, 3: 60, 4: 60 },
    });
  });

  it('ne classe pas une équipe sans mot validé', () => {
    expect(podiumDesMots({ 1: 0, 2: 3 })).toEqual({ rangs: { 2: 1 }, points: { 2: 100 } });
    expect(podiumDesMots({})).toEqual({ rangs: {}, points: {} });
  });

  it('compare les mots sans casse, sans accents ni espaces superflus', () => {
    expect(cleMot('  Éléphant  ')).toBe('elephant');
    expect(cleMot('ÉLÉPHANT')).toBe(cleMot('elephant'));
    expect(cleMot('Lion   de  mer')).toBe('lion de mer');
    // Comme en base (`translate`) : œ et æ deviennent une seule lettre.
    expect(cleMot('Cœur')).toBe('cour');
    // Le tamoul n'a pas d'accents latins : il reste tel quel.
    expect(cleMot('யானை')).toBe('யானை');
  });
});
