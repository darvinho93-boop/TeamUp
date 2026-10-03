import { describe, expect, it } from 'vitest';
import { BETA_DUELS, SOCLE_GAMES } from './catalogue';
import {
  CARTE_MIN_S,
  carteA,
  dureeExplicationS,
  EXPLICATION_MAX_S,
  EXPLICATION_MIN_S,
  SCRIPTS_EXPLICATION,
  scriptExplication,
  type ScriptExplication,
} from './explications';

const SCRIPTS = Object.keys(SCRIPTS_EXPLICATION) as ScriptExplication[];

describe('scripts des explications', () => {
  it('couvrent les 5 jeux et les 2 duels, rien de plus', () => {
    expect(new Set(SCRIPTS)).toEqual(new Set([...SOCLE_GAMES, ...BETA_DUELS, 'qcm2-telephone']));
  });

  it.each(SCRIPTS)('%s dure entre 20 et 30 s', (script) => {
    const duree = dureeExplicationS(script);
    expect(duree).toBeGreaterThanOrEqual(EXPLICATION_MIN_S);
    expect(duree).toBeLessThanOrEqual(EXPLICATION_MAX_S);
  });

  it.each(SCRIPTS)('%s laisse au moins 4 s pour lire chaque carte', (script) => {
    for (const c of SCRIPTS_EXPLICATION[script])
      expect(c.dureeS).toBeGreaterThanOrEqual(CARTE_MIN_S);
  });

  it.each(SCRIPTS)('%s n’a pas deux cartes de même clé', (script) => {
    const cles = SCRIPTS_EXPLICATION[script].map((c) => c.cle);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it('le Quiz s’explique selon son mode, les autres jeux n’en ont qu’un', () => {
    expect(scriptExplication('qcm2')).toBe('qcm2');
    expect(scriptExplication('qcm2', true)).toBe('qcm2-telephone');
    expect(scriptExplication('mime2', true)).toBe('mime2');
  });
});

describe('carte à un instant', () => {
  // Points communs : quatre cartes de 6 s.
  it('commence sur la première carte', () => {
    expect(carteA('list2', 0)).toEqual({ index: 0, progression: 0, finie: false });
  });

  it('change de carte pile à la fin de la précédente', () => {
    expect(carteA('list2', 5_999).index).toBe(0);
    expect(carteA('list2', 6_000)).toEqual({ index: 1, progression: 0, finie: false });
    expect(carteA('list2', 9_000).progression).toBeCloseTo(0.5);
  });

  it('reste sur la dernière carte une fois le script fini', () => {
    const fin = dureeExplicationS('list2') * 1000;
    expect(carteA('list2', fin - 1)).toMatchObject({ index: 3, finie: false });
    expect(carteA('list2', fin)).toEqual({ index: 3, progression: 1, finie: true });
    expect(carteA('list2', fin + 60_000)).toEqual({ index: 3, progression: 1, finie: true });
  });

  it('un instant négatif (horloges décalées) montre la première carte', () => {
    expect(carteA('cup', -500)).toEqual({ index: 0, progression: 0, finie: false });
  });
});
