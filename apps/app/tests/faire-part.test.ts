import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEPART_MUSIQUE_MS,
  eclatsDesNotes,
  entreeFairePart,
  imagesDuTheme,
  sonsDuTheme,
  themeDe,
} from '../src/lib/faire-part';
import { FINALE } from '../src/lib/ouverture';
import { COUP_FINALE_MS, fondDuTheme } from '../src/lib/sons';

const LIGNE = {
  theme: 'faire-part',
  fichiers: {
    monogramme: 'essai/monogramme.webp',
    prenoms: 'essai/prenoms.webp',
    illustration: 'essai/illustration.svg',
    rinceau: 'essai/rinceau.svg',
    grain: 'essai/grain.svg',
    musique: 'essai/musique.wav',
  },
  reglages: { date: 'Samedi 5 décembre', orchestre_ms: 2215, notes_ms: [50, 370, 9000] },
};

describe('un thème faire-part', () => {
  it('se lit de la ligne de la base', () => {
    const theme = themeDe(LIGNE);
    expect(theme?.fichiers.musique).toBe('essai/musique.wav');
    expect(theme?.fichiers.ambiance).toBeUndefined();
    expect(theme?.reglages).toEqual({
      date: 'Samedi 5 décembre',
      orchestreMs: 2215,
      // Sans temps donné : 64 temps par minute, la musique du 5 décembre.
      tempsMs: 937,
      // Une note après l'entrée de l'orchestre n'a pas d'éclat.
      notesMs: [50, 370],
    });
    expect(
      themeDe({ ...LIGNE, reglages: { ...LIGNE.reglages, temps_ms: 500 } })?.reglages.tempsMs,
    ).toBe(500);
  });

  it('refuse une ligne incomplète ou douteuse : l’écran reste celui de Team Up!', () => {
    expect(themeDe(null)).toBeNull();
    expect(themeDe({ ...LIGNE, theme: 'autre' })).toBeNull();
    expect(themeDe({ ...LIGNE, fichiers: { ...LIGNE.fichiers, prenoms: undefined } })).toBeNull();
    expect(
      themeDe({ ...LIGNE, fichiers: { ...LIGNE.fichiers, grain: '../evenements/x.svg' } }),
    ).toBeNull();
    expect(
      themeDe({ ...LIGNE, fichiers: { ...LIGNE.fichiers, grain: 'https://ailleurs.fr/x.svg' } }),
    ).toBeNull();
    expect(themeDe({ ...LIGNE, reglages: { ...LIGNE.reglages, date: ' ' } })).toBeNull();
    expect(themeDe({ ...LIGNE, reglages: { ...LIGNE.reglages, orchestre_ms: 25_000 } })).toBeNull();
    expect(themeDe({ ...LIGNE, reglages: { ...LIGNE.reglages, temps_ms: 100 } })).toBeNull();
    expect(themeDe({ ...LIGNE, reglages: { ...LIGNE.reglages, temps_ms: 'lent' } })).toBeNull();
  });

  it('sépare les images (pour habiller) des sons (pour l’écran projeté seulement)', () => {
    const theme = themeDe({
      ...LIGNE,
      fichiers: { ...LIGNE.fichiers, ambiance: 'essai/ambiance.wav' },
    })!;
    expect(imagesDuTheme(theme)).not.toContain('essai/musique.wav');
    expect(sonsDuTheme(theme)).toEqual(['essai/musique.wav', 'essai/ambiance.wav']);
  });

  it('laisse le reel s’éteindre : la musique part dans ses 250 dernières ms, sans le couper', () => {
    const octets = readFileSync(new URL('../public/sons/finale.wav', import.meta.url));
    const dureeMs = ((octets.length - 44) / 2 / octets.readUInt32LE(24)) * 1000;
    const finDuReel = FINALE.logo - COUP_FINALE_MS + dureeMs;
    expect(DEPART_MUSIQUE_MS).toBeLessThanOrEqual(finDuReel);
    expect(DEPART_MUSIQUE_MS).toBeGreaterThan(finDuReel - 250);
  });

  it('suit la musique : un élément par mesure avant l’orchestre, puis un par temps', () => {
    // La musique du 5 décembre : l'orchestre à 13,47 s, 937 ms le temps (maquette D v6).
    const entree = entreeFairePart({ orchestreMs: 13_470, tempsMs: 937 });
    expect(entree.notes).toBe(DEPART_MUSIQUE_MS);
    expect(entree.bascule).toBe(DEPART_MUSIQUE_MS + 13_470);
    expect(entree.passages).toEqual([
      entree.bascule - 3 * 3748,
      entree.bascule - 2 * 3748,
      entree.bascule - 3748,
    ]);
    // Les instants de la maquette, à 10 ms près.
    const maquette = [9180, 12_930, 16_670, 20_420, 22_290, 23_230, 24_170, 25_100, 26_040];
    const calcul = [
      ...entree.passages,
      entree.bascule,
      entree.coin,
      entree.encadre,
      entree.qr,
      entree.textes,
      entree.compte,
    ];
    calcul.forEach((instant, i) => expect(Math.abs(instant - maquette[i]!)).toBeLessThan(10));
    expect(entree.fin).toBeGreaterThan(entree.compte);
    expect(eclatsDesNotes({ notesMs: [50, 370] })).toEqual([
      DEPART_MUSIQUE_MS + 50,
      DEPART_MUSIQUE_MS + 370,
    ]);
  });

  it('ne fait rien paraître avant les premières notes, même sur une intro courte', () => {
    const entree = entreeFairePart({ orchestreMs: 1000, tempsMs: 937 });
    expect(entree.passages).toEqual([entree.notes, entree.notes, entree.notes]);
    expect(entree.bascule).toBe(entree.notes + 1000);
  });
});

describe('l’ambiance d’une soirée à thème', () => {
  const accueil = { scene: 'accueil', ambianceTheme: true, entreeEnCours: false };
  it('remplace celle de Team Up! hors de l’ouverture', () => {
    expect(fondDuTheme('ambiance', accueil)).toBe('ambiance-theme');
    expect(fondDuTheme('ambiance', { ...accueil, scene: 'ouverture' })).toBe('ambiance');
  });

  it('attend la fin de l’entrée, et ne touche ni à l’explication ni au silence', () => {
    expect(fondDuTheme('ambiance', { ...accueil, entreeEnCours: true })).toBe('ambiance');
    expect(fondDuTheme('ambiance', { ...accueil, ambianceTheme: false })).toBe('ambiance');
    expect(fondDuTheme('explication', accueil)).toBe('explication');
    expect(fondDuTheme(null, accueil)).toBeNull();
  });
});
