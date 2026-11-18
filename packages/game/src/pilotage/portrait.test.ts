import { describe, expect, it } from 'vitest';
import {
  actionsPortrait,
  appliquerPortrait,
  equipesEnLice,
  pointsPortrait,
  repereCarte,
  RESULTAT_PORTRAIT_VIDE,
  resultatPortraitDe,
  resultatPortraitVers,
  totalPortrait,
  type EtatPortrait,
} from './portrait';

const CIBLE = 7;
const NOIRE = 13;

const etat = (partiel: Partial<EtatPortrait> = {}): EtatPortrait => ({
  etape: 'pret',
  tour: 0,
  resultat: RESULTAT_PORTRAIT_VIDE,
  equipes: [1, 2, 3, 4],
  elimineesAvant: [],
  cible: CIBLE,
  noire: NOIRE,
  votes: {},
  derniere: false,
  chronoTourS: 20,
  ...partiel,
});

describe('Portrait mystère : une cible', () => {
  it('un indice ouvre un tour de vote, chrono de la préparation', () => {
    expect(appliquerPortrait(etat(), { type: 'indice' })).toMatchObject({
      etape: 'vote',
      tour: 1,
      chrono: { demarrer: 20 },
    });
  });

  it('fin du tour : 100 au premier tour, la noire élimine, un leurre ne coûte rien', () => {
    const suite = appliquerPortrait(
      etat({ etape: 'vote', tour: 1, votes: { 1: CIBLE, 2: NOIRE, 3: 4 } }),
      { type: 'cloturer' },
    );
    expect(suite).toMatchObject({
      etape: 'tour',
      chrono: 'arreter',
      resultat: { trouvees: { 1: 1 }, eliminees: [2], tours: 1 },
      points: { 1: 100 },
    });
    // Restent en lice : l'équipe 3 (leurre) et la 4 (pas de vote).
    expect(equipesEnLice({ ...etat(), resultat: suite.resultat })).toEqual([3, 4]);
  });

  it('les tours suivants valent 60 puis 30 ; une équipe qui a trouvé ne compte plus', () => {
    let e = etat({
      etape: 'tour',
      tour: 1,
      resultat: { trouvees: { 1: 1 }, eliminees: [], tours: 1 },
    });
    let s = appliquerPortrait(e, { type: 'indice' });
    expect(s).toMatchObject({ etape: 'vote', tour: 2 });
    e = { ...e, etape: 'vote', tour: 2, resultat: s.resultat, votes: { 1: 4, 2: CIBLE } };
    s = appliquerPortrait(e, { type: 'cloturer' });
    // L'équipe 1 a déjà trouvé : son vote du tour 2 ne lui retire rien.
    expect(s.points).toEqual({ 2: 60 });
    expect(s.resultat.trouvees).toEqual({ 1: 1, 2: 2 });
    e = { ...e, etape: 'tour', resultat: s.resultat };
    expect(appliquerPortrait(e, { type: 'indice' }).tour).toBe(3);
    e = { ...e, etape: 'vote', tour: 3, votes: { 3: CIBLE } };
    s = appliquerPortrait(e, { type: 'cloturer' });
    expect(s.points).toEqual({ 3: 30 });
    expect(totalPortrait(s.resultat)).toBe(190);
  });

  it('après le troisième tour, ou personne en lice : seulement révéler', () => {
    expect(
      actionsPortrait(
        etat({ etape: 'tour', tour: 3, resultat: { trouvees: {}, eliminees: [], tours: 3 } }),
      ),
    ).toEqual(['reveler']);
    expect(
      actionsPortrait(
        etat({
          etape: 'tour',
          tour: 1,
          equipes: [1, 2],
          resultat: { trouvees: { 1: 1 }, eliminees: [2], tours: 1 },
        }),
      ),
    ).toEqual(['reveler']);
    expect(
      actionsPortrait(
        etat({ etape: 'tour', tour: 1, resultat: { trouvees: {}, eliminees: [], tours: 1 } }),
      ),
    ).toEqual(['indice', 'reveler']);
  });

  it('une équipe éliminée par une cible précédente ne vote plus', () => {
    const s = appliquerPortrait(
      etat({ etape: 'vote', tour: 1, elimineesAvant: [2], votes: { 2: CIBLE } }),
      { type: 'cloturer' },
    );
    expect(s.points).toEqual({});
  });

  it('la carte noire se montre seulement après la dernière cible', () => {
    expect(actionsPortrait(etat({ etape: 'revele' }))).toEqual([]);
    expect(actionsPortrait(etat({ etape: 'revele', derniere: true }))).toEqual(['noire']);
    expect(
      appliquerPortrait(etat({ etape: 'revele', derniere: true }), { type: 'noire' }).etape,
    ).toBe('noire');
  });

  it('refuse une touche hors de son étape', () => {
    expect(() => appliquerPortrait(etat(), { type: 'cloturer' })).toThrow(/impossible/);
    expect(() => appliquerPortrait(etat({ etape: 'vote', tour: 1 }), { type: 'indice' })).toThrow();
  });
});

describe('Portrait mystère : outils', () => {
  it('points et repères', () => {
    expect([1, 2, 3, 4].map(pointsPortrait)).toEqual([100, 60, 30, 0]);
    expect([0, 4, 5, 13, 24].map(repereCarte)).toEqual(['A1', 'E1', 'A2', 'D3', 'E5']);
  });

  it('le résultat se lit sans confiance et se réécrit à l’identique', () => {
    const r = resultatPortraitDe({ trouvees: { '1': 1, '2': 'x' }, eliminees: [3, 'y'], tours: 2 });
    expect(r).toEqual({ trouvees: { 1: 1 }, eliminees: [3], tours: 2 });
    expect(resultatPortraitDe(resultatPortraitVers(r))).toEqual(r);
    expect(resultatPortraitDe(null)).toEqual(RESULTAT_PORTRAIT_VIDE);
  });
});
