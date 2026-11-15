import { describe, expect, it } from 'vitest';
import {
  actionsBlind,
  appliquerBlind,
  peutBuzzer,
  POINTS_BLIND,
  positionExtraitMs,
  REPONSE_BLIND_S,
  RESULTAT_BLIND_VIDE,
  resultatBlindDe,
  resultatBlindVers,
  type EtatBlind,
} from './blind';

const etat = (extra: Partial<EtatBlind> = {}): EtatBlind => ({
  etape: 'pret',
  resultat: RESULTAT_BLIND_VIDE,
  extraitS: 30,
  equipes: [1, 2, 3],
  ecouleMs: 0,
  ...extra,
});

describe('le blind test, titre par titre', () => {
  it('lance la musique avec le chrono de l’extrait', () => {
    expect(actionsBlind(etat())).toEqual(['lancer']);
    expect(appliquerBlind(etat(), { type: 'lancer' })).toEqual({
      etape: 'ecoute',
      chrono: { demarrer: 30 },
      resultat: RESULTAT_BLIND_VIDE,
    });
  });

  it('un buzz arrête la musique là où elle en est, et donne 7 s à l’équipe', () => {
    const ecoute = etat({ etape: 'ecoute', ecouleMs: 8_400 });
    expect(actionsBlind(ecoute)).toEqual(['buzz', 'reveler']);
    expect(appliquerBlind(ecoute, { type: 'buzz', equipe: 2 })).toEqual({
      etape: 'buzz',
      chrono: { demarrer: REPONSE_BLIND_S },
      resultat: { ...RESULTAT_BLIND_VIDE, ecouteMs: 8_400, buzz: 2 },
    });
    // Une équipe qui n'est pas en jeu ne buzze pas.
    expect(() => appliquerBlind(ecoute, { type: 'buzz', equipe: 9 })).toThrow(/plus la main/);
  });

  it('bonne réponse : +100 à l’équipe, le titre est révélé', () => {
    const buzz = etat({
      etape: 'buzz',
      resultat: { ...RESULTAT_BLIND_VIDE, ecouteMs: 8_400, buzz: 2 },
    });
    expect(actionsBlind(buzz)).toEqual(['bonne', 'mauvaise']);
    expect(appliquerBlind(buzz, { type: 'bonne' })).toEqual({
      etape: 'revele',
      chrono: 'arreter',
      resultat: { ...RESULTAT_BLIND_VIDE, ecouteMs: 8_400, trouvePar: 2 },
      points: { 2: POINTS_BLIND },
    });
    expect(POINTS_BLIND).toBe(100);
  });

  it('mauvaise réponse : l’équipe est bloquée, la musique attend la régie, puis reprend', () => {
    const buzz = etat({
      etape: 'buzz',
      resultat: { ...RESULTAT_BLIND_VIDE, ecouteMs: 8_400, buzz: 2 },
    });
    const pause = appliquerBlind(buzz, { type: 'mauvaise' });
    expect(pause).toEqual({
      etape: 'pause',
      chrono: 'arreter',
      resultat: { ...RESULTAT_BLIND_VIDE, ecouteMs: 8_400, bloquees: [2] },
    });
    const enPause = etat({ etape: 'pause', resultat: pause.resultat });
    expect(peutBuzzer(enPause, 2)).toBe(false);
    expect(peutBuzzer(enPause, 1)).toBe(true);
    expect(actionsBlind(enPause)).toEqual(['relancer', 'reveler']);
    // Le chrono reprend sur ce qui reste de l'extrait : 30 − 8,4 = 21,6, arrondi à 22 s.
    const relance = appliquerBlind(enPause, { type: 'relancer' });
    expect(relance.etape).toBe('ecoute');
    expect(relance.chrono).toEqual({ demarrer: 22 });
    // L'équipe bloquée ne buzze plus, même à l'écoute.
    const ecoute = etat({ etape: 'ecoute', resultat: relance.resultat });
    expect(() => appliquerBlind(ecoute, { type: 'buzz', equipe: 2 })).toThrow(/plus la main/);
  });

  it('toutes les équipes bloquées, ou l’extrait fini : il ne reste qu’à révéler', () => {
    const toutes = { ...RESULTAT_BLIND_VIDE, ecouteMs: 5_000, bloquees: [1, 2, 3] };
    expect(actionsBlind(etat({ etape: 'pause', resultat: toutes }))).toEqual(['reveler']);
    const fini = { ...RESULTAT_BLIND_VIDE, ecouteMs: 30_000, bloquees: [1] };
    expect(actionsBlind(etat({ etape: 'pause', resultat: fini }))).toEqual(['reveler']);
    // À l'écoute, une fois le chrono écoulé, plus de buzz.
    expect(actionsBlind(etat({ etape: 'ecoute', ecouleMs: 31_000 }))).toEqual(['reveler']);
  });

  it('révéler sans gagnant : 0 point, l’écoute faite est gardée', () => {
    const revele = appliquerBlind(etat({ etape: 'ecoute', ecouleMs: 40_000 }), { type: 'reveler' });
    expect(revele).toEqual({
      etape: 'revele',
      chrono: 'arreter',
      resultat: { ...RESULTAT_BLIND_VIDE, ecouteMs: 30_000 },
    });
    expect(revele.points).toBeUndefined();
    expect(actionsBlind(etat({ etape: 'revele' }))).toEqual([]);
    // Pas de révélation pendant qu'une équipe répond : on juge d'abord.
    expect(() =>
      appliquerBlind(etat({ etape: 'buzz', resultat: { ...RESULTAT_BLIND_VIDE, buzz: 1 } }), {
        type: 'reveler',
      }),
    ).toThrow(/impossible/);
  });
});

describe('la position de l’extrait', () => {
  it('part du début choisi, ajoute l’écoute faite et celle en cours', () => {
    expect(positionExtraitMs(45, { ecouteMs: 0 }, 'pret', 0, 30)).toBe(45_000);
    expect(positionExtraitMs(45, { ecouteMs: 8_000 }, 'ecoute', 2_500, 30)).toBe(55_500);
    // En pause, l'horloge ne compte plus.
    expect(positionExtraitMs(45, { ecouteMs: 8_000 }, 'pause', 2_500, 30)).toBe(53_000);
    // Jamais au-delà de l'extrait.
    expect(positionExtraitMs(0, { ecouteMs: 25_000 }, 'ecoute', 60_000, 30)).toBe(30_000);
  });
});

describe('le résultat gardé en base', () => {
  it('se lit sans confiance et se réécrit à l’identique', () => {
    expect(resultatBlindDe(undefined)).toEqual(RESULTAT_BLIND_VIDE);
    expect(resultatBlindDe({ ecoute_ms: 'x', bloquees: [1, 'a', 3], buzz: 2 })).toEqual({
      ecouteMs: 0,
      bloquees: [1, 3],
      buzz: 2,
      trouvePar: null,
    });
    const r = { ecouteMs: 1200, bloquees: [2], buzz: null, trouvePar: 3 };
    expect(resultatBlindDe(resultatBlindVers(r))).toEqual(r);
  });
});
