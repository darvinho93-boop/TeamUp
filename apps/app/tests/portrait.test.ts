import { describe, expect, it } from 'vitest';
import {
  chronoTourPortrait,
  completerGrille,
  elimineesDeLaManche,
  grillePrete,
  melangerGrille,
  nomDeCarte,
  positionsDuPassage,
  statutsDesEquipes,
  votesDuTour,
} from '../src/lib/portrait';
import type { MancheSalle, PassageSalle } from '../src/lib/salle';

const ids = Array.from({ length: 30 }, (_, i) => `c${i}`);

/** Un hasard reproductible (générateur congruentiel). */
function alea(graine = 42) {
  let x = graine;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

const passage = (id: string, partiel: Partial<PassageSalle> = {}): PassageSalle => ({
  id,
  ordre: 1,
  statut: 'en_cours',
  equipe_id: null,
  points: null,
  resultat: {},
  contenu_id: null,
  public: {},
  secret: null,
  ...partiel,
});

describe('la grille', () => {
  it('se complète au hasard jusqu’à 25 cartes, cibles et noire comprises', () => {
    const g = completerGrille({
      cibles: ['c1', 'c2', 'c3'],
      noire: 'c4',
      disponibles: ids,
      alea: alea(),
    })!;
    expect(g.cartes).toHaveLength(25);
    expect(new Set(g.cartes).size).toBe(25);
    expect(g.cartes).toEqual(expect.arrayContaining(['c1', 'c2', 'c3', 'c4']));
    expect(g.cartes[g.noire]).toBe('c4');
  });

  it('refuse sans assez de contenus, ou une noire qui est aussi une cible', () => {
    expect(
      completerGrille({ cibles: ['c1'], noire: 'c2', disponibles: ids.slice(0, 20), alea: alea() }),
    ).toBeNull();
    expect(
      completerGrille({ cibles: ['c1'], noire: 'c1', disponibles: ids, alea: alea() }),
    ).toBeNull();
  });

  it('se mélange en gardant la carte noire', () => {
    const g = completerGrille({ cibles: ['c1'], noire: 'c2', disponibles: ids, alea: alea() })!;
    const m = melangerGrille(g, alea(7));
    expect(m.cartes[m.noire]).toBe('c2');
    expect([...m.cartes].sort()).toEqual([...g.cartes].sort());
  });

  it('est prête quand chaque cible y est et que la noire n’en est pas une', () => {
    const cartes = ids.slice(0, 25);
    const manche: Pick<MancheSalle, 'grille' | 'passages'> = {
      grille: { cartes: [], ids: cartes, noire: 4, retournees: {} },
      passages: [passage('p1', { contenu_id: 'c1' }), passage('p2', { contenu_id: 'c2' })],
    };
    expect(grillePrete(manche)).toBe(true);
    expect(grillePrete({ ...manche, grille: { ...manche.grille!, noire: 1 } })).toBe(false);
    expect(grillePrete({ ...manche, passages: [passage('p3', { contenu_id: 'c29' })] })).toBe(
      false,
    );
    expect(grillePrete({ ...manche, passages: [passage('p4')] })).toBe(false);
    expect(grillePrete({ ...manche, grille: null })).toBe(false);
  });
});

describe('la partie', () => {
  it('positions de la cible et de la noire, pour la régie seulement', () => {
    const grille = { cartes: [], ids: ids.slice(0, 25), noire: 13, retournees: {} };
    expect(positionsDuPassage({ grille }, { contenu_id: 'c7' })).toEqual({ cible: 7, noire: 13 });
    expect(
      positionsDuPassage({ grille: { ...grille, ids: null } }, { contenu_id: 'c7' }),
    ).toBeNull();
  });

  it('éliminées de la manche, votes du tour, statut de chaque équipe', () => {
    const avant = passage('p1', { statut: 'termine', resultat: { eliminees: [2] } });
    const courant = passage('p2', {
      resultat: { trouvees: { 1: 1 }, eliminees: [4] },
      votes: { 3: true, 5: 12 },
    });
    const manche = { passages: [avant, courant] };
    expect(elimineesDeLaManche(manche)).toEqual([2, 4]);
    expect(elimineesDeLaManche(manche, 'p2')).toEqual([2]);
    expect(votesDuTour(courant)).toEqual({ 5: 12 });
    const equipes = [1, 2, 3, 4, 5, 6].map((numero) => ({ numero, joueurs: numero === 6 ? 0 : 3 }));
    expect(statutsDesEquipes(equipes, manche, courant)).toEqual({
      1: { statut: 'trouvee', tour: 1 },
      2: { statut: 'eliminee' },
      3: { statut: 'a-vote' },
      4: { statut: 'eliminee' },
      5: { statut: 'a-vote' },
    });
  });

  it('nom d’une carte et chrono d’un tour', () => {
    const carte = { fr: { nom: 'Édith Piaf' }, en: { nom: '' } };
    expect(nomDeCarte(carte, 'en', ['fr', 'en'])).toBe('Édith Piaf');
    expect(nomDeCarte(undefined, 'fr', ['fr'])).toBe('—');
    expect(chronoTourPortrait({ options: {} })).toBe(20);
    expect(chronoTourPortrait({ options: { chrono_s: 45 } })).toBe(45);
    expect(chronoTourPortrait({ options: { chrono_s: 5 } })).toBe(20);
  });
});
