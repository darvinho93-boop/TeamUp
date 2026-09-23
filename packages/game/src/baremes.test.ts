import { describe, expect, it } from 'vitest';
import { roleMaillon, scoreMime } from './mime';
import { scorePhoto } from './photo';
import { scoreQuiz } from './quiz';
import { scoreSurenchere } from './surenchere';

describe('barème du quiz', () => {
  it('donne survivants × 100 à chaque équipe', () => {
    expect(scoreQuiz({ 1: 3, 2: 0, 3: 7 })).toEqual({ 1: 300, 2: 0, 3: 700 });
  });

  it('donne le même score en mode croix et en mode téléphone', () => {
    // Croix : la régie saisit les survivants. Téléphone : l'app les compte, joueur par joueur.
    const saisieRegie = { 1: 2, 2: 1 };
    const joueursEncoreEnJeu = [{ equipe: 1 }, { equipe: 2 }, { equipe: 1 }];
    const comptes: Record<number, number> = { 1: 0, 2: 0 };
    for (const j of joueursEncoreEnJeu) comptes[j.equipe] = (comptes[j.equipe] ?? 0) + 1;
    expect(scoreQuiz(comptes)).toEqual(scoreQuiz(saisieRegie));
  });

  it('refuse un nombre de survivants négatif ou fractionnaire', () => {
    expect(() => scoreQuiz({ 1: -1 })).toThrow(RangeError);
    expect(() => scoreQuiz({ 1: 1.5 })).toThrow(RangeError);
  });
});

describe('barème de la surenchère', () => {
  const equipesAvecJoueurs = [1, 2, 3, 4];

  it('donne +100 au champion quand il tient', () => {
    expect(scoreSurenchere({ equipeChampion: 2, tenu: true, equipesAvecJoueurs })).toEqual({
      2: 100,
    });
  });

  it('donne +20 à chacune des autres équipes quand il rate', () => {
    expect(scoreSurenchere({ equipeChampion: 2, tenu: false, equipesAvecJoueurs })).toEqual({
      1: 20,
      3: 20,
      4: 20,
    });
  });

  it('oublie les équipes sans joueurs quand il rate', () => {
    expect(scoreSurenchere({ equipeChampion: 1, tenu: false, equipesAvecJoueurs: [1, 3] })).toEqual(
      { 3: 20 },
    );
  });

  it('refuse un champion dont l’équipe n’a aucun joueur', () => {
    expect(() => scoreSurenchere({ equipeChampion: 5, tenu: true, equipesAvecJoueurs })).toThrow(
      RangeError,
    );
  });
});

describe('barème du mime', () => {
  it('donne 100 pour un mot trouvé, 0 sinon', () => {
    expect(scoreMime(true)).toBe(100);
    expect(scoreMime(false)).toBe(0);
  });
});

describe('chaîne alternée du mime', () => {
  const file = (n: number) => Array.from({ length: n }, (_, i) => roleMaillon(i + 1, n));

  it('alterne mime et oreille, le dernier annonce', () => {
    expect(file(5)).toEqual(['mime', 'oreille', 'mime', 'oreille', 'annonce']);
    expect(file(4)).toEqual(['mime', 'oreille', 'mime', 'annonce']);
    expect(file(1)).toEqual(['annonce']);
  });

  it('refuse un rang hors de la file', () => {
    expect(() => roleMaillon(0, 4)).toThrow(RangeError);
    expect(() => roleMaillon(5, 4)).toThrow(RangeError);
  });
});

describe('barème du photo challenge', () => {
  it('donne 100 par thème gagné et cumule les thèmes', () => {
    expect(scorePhoto({ plage: 1, danse: 3, selfie: 1 })).toEqual({ 1: 200, 3: 100 });
  });

  it('ne donne rien pour un thème sans gagnante', () => {
    expect(scorePhoto({ plage: null, danse: 2 })).toEqual({ 2: 100 });
    expect(scorePhoto({})).toEqual({});
  });
});
