import { describe, expect, it } from 'vitest';
import type { Alea } from './duels';
import { dureeElement } from './programme';
import type { Duelliste } from './pilotage/duel';
import { actionsTournoi, appliquerTournoi } from './pilotage/tournoi';
import {
  bornerGobelets,
  classementTournoi,
  dimensionsTableau,
  dureeTournoiS,
  estExempte,
  GOBELETS_DEFAUT,
  GOBELETS_MAX,
  GOBELETS_MIN,
  pointsTournoi,
  prochaineSequence,
  sequenceCourante,
  sequencesDuTournoi,
  SEQUENCE_TOURNOI_S,
  surScene,
  tirerTableau,
  type MatchTournoi,
} from './tournoi';

function graine(n: number): Alea {
  let x = n;
  return () => {
    x = (x * 1103515245 + 12345) % 2 ** 31;
    return x / 2 ** 31;
  };
}

/** `total` joueurs répartis à une unité près entre `equipes` équipes. */
const salle = (total: number, equipes: number): Duelliste[] =>
  Array.from({ length: total }, (_, i) => ({
    joueur_id: `j${i}`,
    prenom: `Joueur ${i}`,
    equipe: (i % equipes) + 1,
  }));

const tableau = (joueurs: Duelliste[], n = 1): MatchTournoi[] => {
  const t = tirerTableau(joueurs, graine(n));
  if (!t) throw new Error('tableau attendu');
  return t;
};

/** Joue la séquence : le gagnant monte au tour suivant, comme le fait la base. */
function jouer(
  matchs: MatchTournoi[],
  gobelets: number,
  choix: (m: MatchTournoi) => 0 | 1 = () => 0,
) {
  const sequence = prochaineSequence(matchs, gobelets);
  if (!sequence) return null;
  sequence.matchs.forEach((m, i) => {
    m.sequence = sequence.numero;
    m.poste = i + 1;
    m.gagnant = choix(m);
    const suivant = matchs.find((s) => s.tour === m.tour + 1 && s.rang === m.rang >> 1);
    if (suivant) suivant[m.rang % 2 === 0 ? 'a' : 'b'] = m.gagnant === 0 ? m.a : m.b;
  });
  return sequence;
}

function jouerTout(matchs: MatchTournoi[], gobelets: number) {
  const sequences = [];
  for (;;) {
    const s = jouer(matchs, gobelets);
    if (!s) return sequences;
    sequences.push(s);
  }
}

describe('dimensions du tableau', () => {
  it.each([
    [2, 2, 0, 1],
    [3, 4, 1, 2],
    [4, 4, 0, 2],
    [13, 16, 3, 4],
    [16, 16, 0, 4],
    [80, 128, 48, 7],
    [100, 128, 28, 7],
    [150, 256, 106, 8],
  ])('%i joueurs : %i places, %i exemptés, %i tours', (joueurs, places, exemptes, tours) => {
    expect(dimensionsTableau(joueurs)).toEqual({ places, exemptes, tours });
  });

  it('refuse moins de deux joueurs', () => {
    expect(() => dimensionsTableau(1)).toThrow(RangeError);
  });

  it('ramène le nombre de gobelets dans ses bornes', () => {
    expect(bornerGobelets(1)).toBe(GOBELETS_MIN);
    expect(bornerGobelets(99)).toBe(GOBELETS_MAX);
    expect(bornerGobelets('x')).toBe(GOBELETS_DEFAUT);
    expect(bornerGobelets(12)).toBe(12);
  });
});

describe('tirage du tableau', () => {
  it('refuse une salle sans deux équipes', () => {
    expect(tirerTableau(salle(1, 1), graine(1))).toBeNull();
    expect(tirerTableau(salle(6, 1), graine(1))).toBeNull();
  });

  it('pour 2 à 150 joueurs et 2 à 8 équipes : chacun placé une fois, N − 1 vrais matchs', () => {
    for (let equipes = 2; equipes <= 8; equipes++) {
      for (let total = Math.max(2, equipes); total <= 150; total++) {
        const matchs = tableau(salle(total, equipes), total * equipes);
        const premier = matchs.filter((m) => m.tour === 1);
        const places = premier.flatMap((m) => [m.a, m.b]).flatMap((j) => j?.joueur_id ?? []);
        expect(new Set(places).size).toBe(total);
        expect(places).toHaveLength(total);
        expect(premier.every((m) => m.a !== null)).toBe(true);
        jouerTout(matchs, 16);
        expect(matchs.filter((m) => !estExempte(m))).toHaveLength(total - 1);
        expect(matchs.every((m) => m.gagnant !== null)).toBe(true);
      }
    }
  });

  it('aucun coéquipier au premier tour, exemptés équitables entre équipes', () => {
    for (let equipes = 2; equipes <= 8; equipes++) {
      for (let total = Math.max(2, equipes); total <= 150; total++) {
        const { places } = dimensionsTableau(total);
        if (Math.ceil(total / equipes) > places / 2) continue;
        const premier = tableau(salle(total, equipes), total + equipes).filter((m) => m.tour === 1);
        for (const m of premier) if (m.b) expect(m.a!.equipe).not.toBe(m.b.equipe);

        const exemptes = new Map<number, number>();
        for (let e = 1; e <= equipes; e++) exemptes.set(e, 0);
        for (const m of premier) {
          if (estExempte(m)) exemptes.set(m.a!.equipe, exemptes.get(m.a!.equipe)! + 1);
        }
        const comptes = [...exemptes.values()];
        expect(Math.max(...comptes) - Math.min(...comptes)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('4 équipes de 4 : des coéquipiers ne se croisent pas avant les demi-finales', () => {
    for (let n = 1; n <= 200; n++) {
      const premier = tableau(salle(16, 4), n)
        .filter((m) => m.tour === 1)
        .sort((x, y) => x.rang - y.rang);
      for (let quart = 0; quart < 4; quart++) {
        const equipes = premier
          .slice(quart * 2, quart * 2 + 2)
          .flatMap((m) => [m.a!.equipe, m.b!.equipe]);
        expect(new Set(equipes).size).toBe(4);
      }
    }
  });

  it('monte les exemptés au deuxième tour', () => {
    const matchs = tableau(salle(13, 4));
    const exemptes = matchs.filter(estExempte);
    expect(exemptes).toHaveLength(3);
    for (const m of exemptes) {
      expect(m.gagnant).toBe(0);
      const suivant = matchs.find((s) => s.tour === 2 && s.rang === m.rang >> 1)!;
      expect(suivant[m.rang % 2 === 0 ? 'a' : 'b']).toEqual(m.a);
    }
  });

  it('est reproductible à graine égale', () => {
    expect(tableau(salle(37, 5), 9)).toEqual(tableau(salle(37, 5), 9));
  });
});

describe('séquences', () => {
  it('ne dépasse jamais le nombre de gobelets, et appelle les postes à partir de 1', () => {
    const matchs = tableau(salle(100, 8));
    for (const s of jouerTout(matchs, 12)) {
      expect(s.matchs.length).toBeLessThanOrEqual(12);
      expect(s.matchs.every((m, i) => m.poste === i + 1)).toBe(true);
    }
  });

  it('demi-finales et finale passent une à une, sur scène', () => {
    const matchs = tableau(salle(16, 4));
    const sequences = jouerTout(matchs, 16);
    expect(sequences.map((s) => s.matchs.length)).toEqual([8, 4, 1, 1, 1]);
    expect(sequences.map((s) => s.surScene)).toEqual([false, false, true, true, true]);
    expect(surScene(2, 4)).toBe(false);
    expect(surScene(3, 4)).toBe(true);
  });

  it('n’appelle rien tant qu’une séquence attend ses résultats', () => {
    const matchs = tableau(salle(16, 4));
    const s = prochaineSequence(matchs, 4)!;
    s.matchs.forEach((m, i) => {
      m.sequence = s.numero;
      m.poste = i + 1;
    });
    expect(prochaineSequence(matchs, 4)).toBeNull();
    expect(sequenceCourante(matchs)).toHaveLength(4);
  });

  it('accepte un nombre de gobelets qui change entre deux séquences', () => {
    const matchs = tableau(salle(32, 4));
    expect(jouer(matchs, 4)!.matchs).toHaveLength(4);
    expect(jouer(matchs, 10)!.matchs).toHaveLength(10);
    expect(jouer(matchs, 10)!.matchs).toHaveLength(2);
  });

  it.each([
    [8, 13, 16],
    [12, 12, 13],
    [16, 9, 11],
    [24, 9, 10],
    [32, 8, 9],
  ])('%i gobelets : %i séquences à 80 joueurs, %i à 100', (gobelets, a80, a100) => {
    expect(sequencesDuTournoi(80, gobelets)).toBe(a80);
    expect(sequencesDuTournoi(100, gobelets)).toBe(a100);
    expect(jouerTout(tableau(salle(80, 8)), gobelets)).toHaveLength(a80);
    expect(jouerTout(tableau(salle(100, 8)), gobelets)).toHaveLength(a100);
  });

  it('chiffre le tournoi au budget de minutes', () => {
    expect(dureeTournoiS(100, 16)).toBe(11 * SEQUENCE_TOURNOI_S);
    expect(dureeElement({ jeu: 'cup', joueurs: 100, gobelets: 16 })).toBe(11 * SEQUENCE_TOURNOI_S);
    expect(dureeElement({ jeu: 'cup', duels: 3 })).toBe(135);
  });
});

describe('points et classement', () => {
  const joueur = (id: string, equipe: number): Duelliste => ({
    joueur_id: id,
    prenom: id,
    equipe,
  });
  const match = (
    tour: number,
    rang: number,
    a: Duelliste,
    b: Duelliste | null,
    gagnant: 0 | 1 | null,
  ): MatchTournoi => ({ tour, rang, a, b, gagnant, sequence: 1, poste: 1 });

  it('+100 au vainqueur, +60 au finaliste, +30 à chaque demi-finaliste', () => {
    const [a, b, c, d] = [joueur('a', 1), joueur('b', 2), joueur('c', 3), joueur('d', 4)];
    const matchs = [match(1, 0, a, b, 0), match(1, 1, c, d, 1), match(2, 0, a, d, 1)];
    expect(classementTournoi(matchs)).toEqual({ vainqueur: d, finaliste: a, demis: [b, c] });
    expect(pointsTournoi(matchs)).toEqual({ 4: 100, 1: 60, 2: 30, 3: 30 });
  });

  it('cumule les points de coéquipiers', () => {
    const [a, b, c, d] = [joueur('a', 1), joueur('b', 2), joueur('c', 1), joueur('d', 2)];
    const matchs = [match(1, 0, a, b, 0), match(1, 1, c, d, 0), match(2, 0, a, c, 0)];
    expect(pointsTournoi(matchs)).toEqual({ 1: 160, 2: 60 });
  });

  it('un exempté en demi-finale ne compte pas de perdant', () => {
    const [a, b, c] = [joueur('a', 1), joueur('b', 2), joueur('c', 3)];
    const matchs = [match(1, 0, a, b, 0), match(1, 1, c, null, 0), match(2, 0, a, c, 1)];
    expect(classementTournoi(matchs)?.demis).toEqual([b]);
    expect(pointsTournoi(matchs)).toEqual({ 3: 100, 1: 60, 2: 30 });
  });

  it('à deux joueurs, la finale seule', () => {
    const [a, b] = [joueur('a', 1), joueur('b', 2)];
    expect(pointsTournoi([match(1, 0, a, b, 1)])).toEqual({ 2: 100, 1: 60 });
  });

  it('rien tant que la finale n’est pas jouée', () => {
    const [a, b] = [joueur('a', 1), joueur('b', 2)];
    expect(classementTournoi([match(1, 0, a, b, null)])).toBeNull();
    expect(pointsTournoi([match(1, 0, a, b, null)])).toBeNull();
  });
});

describe('machine du tournoi', () => {
  const pret = { sequenceJugee: true, resteAJouer: true };

  it('enchaîne appel, séquence, résultats', () => {
    expect(appliquerTournoi('tirage', 'appeler', pret)).toEqual({
      etape: 'appel',
      chrono: 'arreter',
    });
    expect(appliquerTournoi('appel', 'lancer', pret)).toEqual({
      etape: 'jeu',
      chrono: { demarrer: 45 },
    });
    expect(appliquerTournoi('jeu', 'fin', pret)).toEqual({
      etape: 'resultats',
      chrono: 'arreter',
    });
    expect(appliquerTournoi('resultats', 'appeler', pret).etape).toBe('appel');
  });

  it('ne passe à la suite qu’une fois chaque match jugé', () => {
    expect(() =>
      appliquerTournoi('resultats', 'appeler', { sequenceJugee: false, resteAJouer: true }),
    ).toThrow(/résultat/);
  });

  it('ne conclut qu’après la finale', () => {
    expect(() => appliquerTournoi('resultats', 'conclure', pret)).toThrow(/finale/);
    expect(
      appliquerTournoi('resultats', 'conclure', { sequenceJugee: true, resteAJouer: false }).etape,
    ).toBe('vainqueur');
  });

  it('refuse une touche hors de son étape', () => {
    expect(() => appliquerTournoi('tirage', 'lancer', pret)).toThrow(/impossible/);
    expect(actionsTournoi('vainqueur')).toEqual([]);
  });
});
