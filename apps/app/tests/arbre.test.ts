import { describe, expect, it } from 'vitest';
import { aleaDepuis, tirerTableau, type Duelliste } from '@teamup/game';
import { dispositionArbre, MATCHS_MAX_AVEC_NOMS } from '../src/lib/arbre';
import type { MatchSalle } from '../src/lib/tournoi';

const salle = (n: number): Duelliste[] =>
  Array.from({ length: n }, (_, i) => ({
    joueur_id: `j${i}`,
    prenom: `Joueur ${i}`,
    equipe: (i % 8) + 1,
  }));

const tableau = (n: number): MatchSalle[] =>
  tirerTableau(salle(n), aleaDepuis(`arbre-${n}`))!.map((m) => ({
    ...m,
    id: `${m.tour}-${m.rang}`,
  }));

/** Joue tous les tours avant `tour`, `a` gagne toujours. */
function jouerJusquA(matchs: MatchSalle[], tour: number) {
  for (const m of [...matchs].sort((x, y) => x.tour - y.tour || x.rang - y.rang)) {
    if (m.tour >= tour || m.gagnant !== null) continue;
    m.gagnant = 0;
    m.sequence = 1;
    m.poste = 1;
  }
  for (const m of [...matchs].sort((x, y) => x.tour - y.tour)) {
    if (m.gagnant === null) continue;
    const suivant = matchs.find((s) => s.tour === m.tour + 1 && s.rang === m.rang >> 1);
    if (suivant) suivant[m.rang % 2 === 0 ? 'a' : 'b'] = m.gagnant === 0 ? m.a : m.b;
  }
  return matchs;
}

describe('disposition de l’arbre', () => {
  it.each([2, 3, 5, 8, 16, 17, 32, 64, 80, 100, 128, 150])(
    '%i joueurs : tout tient dans la scène, de part et d’autre du centre',
    (n) => {
      const { places, lignes } = dispositionArbre(tableau(n), null);
      for (const p of places) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x + p.largeur).toBeLessThanOrEqual(1.000001);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(1);
        if (p.cote === 'g') expect(p.x + p.largeur).toBeLessThanOrEqual(0.5);
        else expect(p.x).toBeGreaterThanOrEqual(0.5);
      }
      expect(lignes.every((l) => /^M[\d.]+,[\d.]+H[\d.]+(V[\d.]+)?$/.test(l.d))).toBe(true);
    },
  );

  it('chaque joueur du premier tour a sa place, un exempté seul sur sa branche', () => {
    const { places } = dispositionArbre(tableau(100), null);
    const premiers = places.filter((p) => p.tour === 1);
    expect(premiers).toHaveLength(100);
    expect(new Set(premiers.map((p) => p.joueur?.joueur_id)).size).toBe(100);
  });

  it('un match est à mi-hauteur de ses deux joueurs, sur la place du tour suivant', () => {
    const { places } = dispositionArbre(tableau(16), null);
    const y = (tour: number, rang: number, cote: number) =>
      places.find((p) => p.cle === `${tour}-${rang}-${cote}`)!.y;
    for (let rang = 0; rang < 8; rang++) {
      const milieu = (y(1, rang, 0) + y(1, rang, 1)) / 2;
      expect(y(2, rang >> 1, rang % 2)).toBeCloseTo(milieu);
    }
    for (let rang = 0; rang < 2; rang++) {
      const milieu = (y(3, rang, 0) + y(3, rang, 1)) / 2;
      expect(y(4, 0, rang)).toBeCloseTo(milieu);
    }
  });

  it('la moitié gauche et la moitié droite se répondent', () => {
    const { places } = dispositionArbre(tableau(16), null);
    const gauche = places.filter((p) => p.cote === 'g');
    const droite = places.filter((p) => p.cote === 'd');
    expect(gauche).toHaveLength(droite.length);
    for (const g of gauche) {
      expect(
        droite.some(
          (d) =>
            d.tour === g.tour &&
            Math.abs(d.y - g.y) < 1e-6 &&
            Math.abs(d.x + d.largeur - (1 - g.x)) < 1e-6,
        ),
      ).toBe(true);
    }
  });

  it('écrit les prénoms jusqu’à seize matchs par tour, des pastilles au-delà', () => {
    const { places } = dispositionArbre(tableau(100), null);
    const pastilleAu = (tour: number) => places.find((p) => p.tour === tour)!.pastille;
    // 7 tours : 64es, 32es, 16es, 8es, quarts, demies, finale.
    expect(MATCHS_MAX_AVEC_NOMS).toBe(16);
    expect([1, 2, 3, 4].map(pastilleAu)).toEqual([true, true, false, false]);
  });

  it('un tour joué passe en pastilles : la place va aux tours à venir', () => {
    const avant = dispositionArbre(tableau(16), null);
    const apres = dispositionArbre(jouerJusquA(tableau(16), 3), null);
    expect(avant.tourVisible).toBe(1);
    expect(apres.tourVisible).toBe(3);
    expect(apres.places.find((p) => p.tour === 2)!.pastille).toBe(true);
    const largeur = (d: typeof avant) => d.places.find((p) => p.tour === 3)!.largeur;
    expect(largeur(apres)).toBeGreaterThan(largeur(avant));
  });

  it('allume le trait du gagnant à la couleur de son équipe', () => {
    const matchs = tableau(4);
    const m = matchs.find((x) => x.tour === 1 && x.rang === 0)!;
    m.gagnant = 1;
    const { lignes, places } = dispositionArbre(matchs, null);
    const trait = (fin: string) => lignes.find((l) => l.cle === `1-0-${fin}`)!;
    expect(trait('a').equipe).toBeNull();
    expect(trait('b').equipe).toBe(m.b!.equipe);
    expect(trait('t').equipe).toBe(m.b!.equipe);
    expect(places.find((p) => p.cle === '1-0-0')!.etat).toBe('perdu');
    expect(places.find((p) => p.cle === '1-0-1')!.etat).toBe('gagne');
  });

  it('pose le poste des matchs appelés, pas celui des matchs sur scène', () => {
    const matchs = tableau(16);
    const appeles = matchs.filter((m) => m.tour === 1).slice(0, 4);
    appeles.forEach((m, i) => {
      m.sequence = 1;
      m.poste = i + 1;
    });
    const { postes, places } = dispositionArbre(matchs, 1);
    expect(postes.map((p) => p.poste)).toEqual([1, 2, 3, 4]);
    expect(places.filter((p) => p.actif)).toHaveLength(8);

    const fin = jouerJusquA(tableau(16), 4);
    const finale = fin.find((m) => m.tour === 4)!;
    finale.sequence = 7;
    finale.poste = 1;
    expect(dispositionArbre(fin, 7).postes).toEqual([]);
  });

  it('donne le champion une fois la finale jouée', () => {
    const matchs = jouerJusquA(tableau(4), 2);
    expect(dispositionArbre(matchs, null).champion).toBeNull();
    const finale = matchs.find((m) => m.tour === 2)!;
    finale.gagnant = 1;
    expect(dispositionArbre(matchs, null).champion).toEqual(finale.b);
  });
});
