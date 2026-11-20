import { describe, expect, it } from 'vitest';
import {
  actionsCinemime,
  appliquerCinemime,
  CHRONO_CINEMIME_DEFAUT_S,
  chronoCinemimeS,
  chronoExtraitS,
  positionCinemime,
  type EtapeCinemime,
} from './cinemime';

const etat = (etape: EtapeCinemime, ecouleMs = 0) => ({
  etape,
  extraitMs: 32_400,
  chronoS: 150,
  ecouleMs,
});

describe('pilotage du Ciné-mime', () => {
  it('montre la scène pour sa durée, la revoit, puis lance la chaîne', () => {
    expect(actionsCinemime('pret')).toEqual(['montrer']);
    expect(appliquerCinemime(etat('pret'), 'montrer')).toEqual({
      etape: 'extrait',
      chrono: { demarrer: 33 },
    });
    expect(appliquerCinemime(etat('extrait', 20_000), 'revoir')).toEqual({
      etape: 'extrait',
      chrono: { demarrer: 33 },
    });
    expect(appliquerCinemime(etat('extrait'), 'lancer')).toEqual({
      etape: 'lance',
      chrono: { demarrer: 150 },
    });
    expect(actionsCinemime('lance')).toEqual(['trouve', 'rate']);
  });

  it('prend le chrono de la chaîne réglé à la préparation', () => {
    expect(appliquerCinemime({ ...etat('extrait'), chronoS: 90 }, 'lancer').chrono).toEqual({
      demarrer: 90,
    });
  });

  it('trouvé vaut 100, raté 0, et arrête le chrono', () => {
    expect(appliquerCinemime(etat('lance', 95_400), 'trouve')).toEqual({
      etape: 'trouve',
      chrono: 'arreter',
      points: 100,
      resultat: { trouve: true, ecoule_ms: 95_400 },
    });
    const rate = appliquerCinemime(etat('lance', 150_000), 'rate');
    expect(rate.points).toBe(0);
    expect(rate.resultat).toEqual({ trouve: false, ecoule_ms: 150_000 });
  });

  it('rejoue la scène après le verdict, autant de fois, sans rien changer aux points', () => {
    for (const etape of ['trouve', 'rate', 'revue'] as const) {
      const suite = appliquerCinemime(etat(etape), 'rejouer');
      expect(suite).toEqual({ etape: 'revue', chrono: { demarrer: 33 } });
      expect(suite.points).toBeUndefined();
    }
  });

  it('refuse ce qui ne vient pas à son tour', () => {
    expect(() => appliquerCinemime(etat('pret'), 'lancer')).toThrow(/impossible/);
    expect(() => appliquerCinemime(etat('extrait'), 'trouve')).toThrow(/impossible/);
    expect(() => appliquerCinemime(etat('lance'), 'rejouer')).toThrow(/impossible/);
    expect(() => appliquerCinemime(etat('trouve'), 'trouve')).toThrow(/impossible/);
  });
});

describe('chronos et position de la scène', () => {
  it('couvre la vidéo à la seconde supérieure', () => {
    expect(chronoExtraitS(32_000)).toBe(32);
    expect(chronoExtraitS(32_001)).toBe(33);
    expect(chronoExtraitS(0)).toBe(1);
  });

  it('ramène le chrono de la chaîne dans ses bornes', () => {
    expect(chronoCinemimeS(undefined)).toBe(CHRONO_CINEMIME_DEFAUT_S);
    expect(chronoCinemimeS('120')).toBe(CHRONO_CINEMIME_DEFAUT_S);
    expect(chronoCinemimeS(10)).toBe(60);
    expect(chronoCinemimeS(999)).toBe(300);
    expect(chronoCinemimeS(121.6)).toBe(122);
  });

  it('suit le chrono de la salle, puis s’arrête au bout', () => {
    expect(positionCinemime(30_000, -400)).toEqual({ positionMs: 0, finie: false });
    expect(positionCinemime(30_000, 12_500)).toEqual({ positionMs: 12_500, finie: false });
    expect(positionCinemime(30_000, 30_000)).toEqual({ positionMs: 30_000, finie: true });
    expect(positionCinemime(30_000, 45_000)).toEqual({ positionMs: 30_000, finie: true });
  });
});
