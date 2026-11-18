import { describe, expect, it } from 'vitest';
import {
  carteVide,
  equipeParDefaut,
  pointsParEquipe,
  restants,
  saisieCarte,
} from '../src/lib/cartes';

const champs = (age = '', metier = '', anecdote = '', accord = false) => ({
  age,
  metier,
  anecdote,
  accord,
});

describe('saisieCarte', () => {
  it('accepte une carte entière, textes nettoyés', () => {
    expect(saisieCarte(champs('34', '  Infirmière  ', 'Je joue\nde la batterie', true))).toEqual({
      ok: true,
      carte: { age: 34, metier: 'Infirmière', anecdote: 'Je joue de la batterie', accord: true },
    });
  });

  it('rend nuls les champs vides', () => {
    expect(saisieCarte(champs('', '   ', ''))).toEqual({
      ok: true,
      carte: { age: null, metier: null, anecdote: null, accord: false },
    });
  });

  it('refuse un âge hors bornes ou non entier', () => {
    for (const age of ['9', '111', '30.5', 'trente']) {
      expect(saisieCarte(champs(age))).toEqual({ ok: false, erreur: 'age' });
    }
    expect(saisieCarte(champs('10')).ok).toBe(true);
    expect(saisieCarte(champs('110')).ok).toBe(true);
  });

  it('refuse un métier ou une anecdote trop longs, émojis comptés une fois', () => {
    expect(saisieCarte(champs('', 'x'.repeat(61)))).toEqual({ ok: false, erreur: 'metierLong' });
    expect(saisieCarte(champs('', '', 'x'.repeat(121)))).toEqual({
      ok: false,
      erreur: 'anecdoteLong',
    });
    expect(saisieCarte(champs('', '🎸'.repeat(60))).ok).toBe(true);
    expect(restants('🎸🎸', 60)).toBe(58);
  });
});

describe('carteVide', () => {
  it('est vide sans âge, métier ni anecdote', () => {
    expect(carteVide({ age: null, metier: null, anecdote: null })).toBe(true);
    expect(carteVide({ age: 40, metier: null, anecdote: null })).toBe(false);
  });
});

describe('équipe à célébrer', () => {
  const equipes = [
    { id: 'a', numero: 1 },
    { id: 'b', numero: 2 },
    { id: 'c', numero: 3 },
  ];

  it('additionne les points de chaque équipe sur le jeu', () => {
    expect(
      pointsParEquipe(equipes, [
        { equipe_id: 'b', points: 60 },
        { equipe_id: 'b', points: 40 },
        { equipe_id: 'c', points: 20 },
      ]),
    ).toEqual([
      { equipe_id: 'a', numero: 1, points: 0 },
      { equipe_id: 'b', numero: 2, points: 100 },
      { equipe_id: 'c', numero: 3, points: 20 },
    ]);
  });

  it('prend celle qui a le plus marqué', () => {
    expect(
      equipeParDefaut([
        { equipe_id: 'a', numero: 1, points: 30 },
        { equipe_id: 'b', numero: 2, points: 100 },
      ]),
    ).toEqual({ equipeId: 'b', egalite: false });
  });

  it("signale l'égalité et prend la première par numéro", () => {
    expect(
      equipeParDefaut([
        { equipe_id: 'c', numero: 3, points: 100 },
        { equipe_id: 'a', numero: 1, points: 100 },
        { equipe_id: 'b', numero: 2, points: 20 },
      ]),
    ).toEqual({ equipeId: 'a', egalite: true });
  });

  it('rend nul sans équipe', () => {
    expect(equipeParDefaut([])).toBeNull();
  });
});
