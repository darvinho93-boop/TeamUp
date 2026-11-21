import { describe, expect, it } from 'vitest';
import { aleaDepuis, tirerTableau, type Duelliste } from '@teamup/game';
import { dispositionArbre, signaturePrenoms } from '../src/lib/arbre';
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

  it('le trait d’un match part à mi-hauteur de ses deux joueurs', () => {
    const { places, lignes } = dispositionArbre(tableau(16), null);
    const y = (rang: number, cote: number) => places.find((p) => p.cle === `1-${rang}-${cote}`)!.y;
    for (let rang = 0; rang < 8; rang++) {
      const trait = lignes.find((l) => l.cle === `1-${rang}-t`)!;
      const depart = Number(/,([\d.]+)H/.exec(trait.d)![1]) / 1000;
      expect(depart).toBeCloseTo((y(rang, 0) + y(rang, 1)) / 2, 2);
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

  it.each([100, 150])('%i joueurs : tous nommés, en quinconce, sans se toucher', (n) => {
    const { places } = dispositionArbre(tableau(n), null);
    const depart = places.filter((p) => p.tour === 1);
    expect(depart).toHaveLength(n);
    expect(depart.every((p) => !p.pastille && p.joueur)).toBe(true);
    for (const cote of ['g', 'd'] as const) {
      const moitie = depart.filter((p) => p.cote === cote).sort((x, y) => x.y - y.y);
      const rangee = moitie[1]!.y - moitie[0]!.y;
      moitie.forEach((p, i) => {
        // Deux voisins ne sont jamais sur la même colonne, et une colonne saute une rangée.
        if (i > 0) expect(p.x).not.toBeCloseTo(moitie[i - 1]!.x, 6);
        if (i > 1) expect(p.y - moitie[i - 2]!.y).toBeCloseTo(2 * rangee, 6);
      });
      // La hauteur d'un prénom ne dépasse jamais l'écart entre deux prénoms de sa colonne.
      expect(1 / moitie[0]!.rangs).toBeLessThanOrEqual(2 * rangee + 1e-9);
    }
  });

  it('un tour passé, seuls les prénoms du tour à jouer restent écrits', () => {
    const avant = dispositionArbre(tableau(100), null);
    expect(avant.tourVisible).toBe(1);
    expect(avant.places.filter((p) => !p.pastille)).toHaveLength(100);

    const apres = dispositionArbre(jouerJusquA(tableau(100), 3), null);
    expect(apres.tourVisible).toBe(3);
    const ecrits = apres.places.filter((p) => !p.pastille);
    expect(ecrits).toHaveLength(32);
    expect(ecrits.every((p) => p.tour === 3 && p.largeur > 0)).toBe(true);
    // Du tour passé, il ne reste qu'un point par joueur au départ de son chemin.
    expect(apres.places.filter((p) => p.tour === 1 && p.pastille)).toHaveLength(100);
    expect(apres.places.some((p) => p.tour === 2)).toBe(false);
  });

  it('les prénoms du tour à jouer sont à intervalles réguliers', () => {
    const { places } = dispositionArbre(jouerJusquA(tableau(100), 3), null);
    const moitie = places.filter((p) => p.tour === 3 && p.cote === 'g').sort((x, y) => x.y - y.y);
    const ecart = moitie[1]!.y - moitie[0]!.y;
    moitie.forEach((p, i) => {
      if (i > 0) expect(p.y - moitie[i - 1]!.y).toBeCloseTo(ecart, 6);
    });
  });

  it('garde les prénoms du tour tant que la régie n’a pas lancé le suivant', () => {
    const { places, tourVisible } = dispositionArbre(jouerJusquA(tableau(100), 3), 1, 2);
    expect(tourVisible).toBe(2);
    const ecrits = places.filter((p) => !p.pastille);
    expect(ecrits).toHaveLength(64);
    expect(ecrits.every((p) => p.tour === 2)).toBe(true);
    expect(ecrits.filter((p) => p.etat === 'perdu')).toHaveLength(32);
  });

  it('le chemin ne garde la couleur que des joueurs encore en lice', () => {
    const matchs = jouerJusquA(tableau(100), 3);
    const { lignes } = dispositionArbre(matchs, null);
    const enLice = new Set(
      matchs.filter((m) => m.tour === 3).flatMap((m) => [m.a!.joueur_id, m.b!.joueur_id]),
    );
    for (const m of matchs.filter((x) => x.tour === 1)) {
      for (const [joueur, fin] of [
        [m.a, 'a'],
        [m.b, 'b'],
      ] as const) {
        if (!joueur) continue;
        const trait = lignes.find((l) => l.cle === `1-${m.rang}-${fin}`)!;
        expect(trait.passe).toBe(true);
        expect(trait.equipe !== null).toBe(enLice.has(joueur.joueur_id));
      }
    }
  });

  it('un joueur sorti à un tour avancé s’éteint sur sa place de départ', () => {
    const matchs = jouerJusquA(tableau(100), 3);
    const perdant = matchs.find((m) => m.tour === 2 && m.rang === 0)!.b!;
    const { places } = dispositionArbre(matchs, null);
    const depart = places.find((p) => p.tour === 1 && p.joueur?.joueur_id === perdant.joueur_id)!;
    expect(depart.etat).toBe('perdu');
  });

  it('le chemin d’un exempté ne s’allume qu’une fois le premier tour passé', () => {
    const matchs = tableau(100);
    const exempte = matchs.find((m) => m.tour === 1 && !m.b)!;
    const avant = dispositionArbre(matchs, null);
    expect(avant.places.find((p) => p.cle === `1-${exempte.rang}-0`)!.etat).toBe('attente');
    expect(avant.lignes.find((l) => l.cle === `1-${exempte.rang}-a`)!.equipe).toBeNull();

    const apres = dispositionArbre(jouerJusquA(matchs, 2), null);
    expect(apres.tourVisible).toBe(2);
    expect(apres.lignes.find((l) => l.cle === `1-${exempte.rang}-a`)!.equipe).toBe(
      exempte.a!.equipe,
    );
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

  it('un prénom qui passe gagnant, donc en gras, fait réajuster les tailles', () => {
    const matchs = tableau(16);
    const avant = signaturePrenoms(dispositionArbre(matchs, null, 1).places);
    const juges = matchs.map((m) =>
      m.tour === 1 && m.rang === 0 ? { ...m, gagnant: 0 as const } : m,
    );
    expect(signaturePrenoms(dispositionArbre(juges, null, 1).places)).not.toBe(avant);
  });

  it('donne le champion une fois la finale jouée', () => {
    const matchs = jouerJusquA(tableau(4), 2);
    expect(dispositionArbre(matchs, null).champion).toBeNull();
    const finale = matchs.find((m) => m.tour === 2)!;
    finale.gagnant = 1;
    expect(dispositionArbre(matchs, null).champion).toEqual(finale.b);
  });
});
