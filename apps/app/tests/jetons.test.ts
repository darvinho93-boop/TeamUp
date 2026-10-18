import { describe, expect, it } from 'vitest';
import {
  capitainesManquants,
  jetonsDeDepartDe,
  misesDesEquipes,
  resteAPoser,
  revelationPrete,
} from '../src/lib/jetons';
import type { EtatSalle, MancheSalle, PassageSalle } from '../src/lib/salle';

const passage: PassageSalle = {
  id: 'q1',
  ordre: 1,
  statut: 'en_cours',
  equipe_id: null,
  points: null,
  resultat: {},
  contenu_id: null,
  public: {},
  secret: null,
  mises: {
    1: { repartition: [1, 3, 0, 1], valide: true, debloquee: false },
    2: { repartition: [2, 0, 0, 0], valide: false, debloquee: false },
  },
};

const manche: MancheSalle = {
  id: 'qz',
  jeu: 'qcm2',
  ordre: 1,
  statut: 'en_cours',
  options: { mode: 'jetons', jetons: 5 },
  jetons: {
    1: { depart: 5, restants: 5 },
    2: { depart: 5, restants: 5 },
    3: { depart: 5, restants: 5 },
    4: { depart: 5, restants: 0 },
  },
  passages: [passage],
};

function etat(): EtatSalle {
  return {
    serveur_ms: 0,
    evenement: {
      id: 'ev',
      code: 'ABCDEF',
      langues: ['fr'],
      statut: 'en_cours',
      client_nom: 'Test',
      creneau_minutes: 40,
      photos_closes: false,
    },
    pilotage: {
      scene: 'jeu',
      manche_id: 'qz',
      passage_id: 'q1',
      etape: 'question',
      indices: 0,
      chrono_depart_ms: 1000,
      chrono_duree_s: 30,
      version: 'v1',
    },
    equipes: [1, 2, 3, 4].map((numero) => ({
      id: `e${numero}`,
      numero,
      nom: `Équipe ${numero}`,
      points: 0,
      joueurs: numero === 3 ? 0 : numero + 2,
      prenoms: [],
      capitaine: numero === 2 ? null : `Cap ${numero}`,
    })),
    joueurs: 15,
    connectes: 15,
    programme: [manche],
  };
}

describe('lancer le mode jetons', () => {
  it('signale les équipes qui ont des joueurs mais pas de capitaine', () => {
    expect(capitainesManquants(etat()).map((e) => e.numero)).toEqual([2]);
  });

  it('donne à toutes l’effectif de la plus grande', () => {
    expect(jetonsDeDepartDe(etat())).toBe(6);
  });
});

describe('pendant une question', () => {
  it('dit où en est chaque équipe', () => {
    const mises = misesDesEquipes(etat(), manche, passage, 10_000);
    expect(mises.map((m) => m.statut)).toEqual(['validee', 'en_cours', 'en_cours', 'sans_jetons']);
    expect(resteAPoser(mises[1]!)).toBe(3);
    expect(revelationPrete(mises)).toBe(false);
  });

  it('fige une équipe au chrono écoulé, une seconde de grâce comprise, sauf débloquée', () => {
    expect(misesDesEquipes(etat(), manche, passage, 31_000)[1]!.statut).toBe('en_cours');
    expect(misesDesEquipes(etat(), manche, passage, 31_001)[1]!.statut).toBe('figee');
    const debloquee: PassageSalle = {
      ...passage,
      mises: { ...passage.mises, 2: { repartition: [2, 0, 0, 0], valide: false, debloquee: true } },
    };
    expect(misesDesEquipes(etat(), manche, debloquee, 40_000)[1]!.statut).toBe('en_cours');
  });

  it('laisse révéler quand chaque équipe qui a des jetons a validé', () => {
    const toutes: PassageSalle = {
      ...passage,
      mises: {
        1: { repartition: [1, 3, 0, 1], valide: true, debloquee: false },
        2: { repartition: [5, 0, 0, 0], valide: true, debloquee: false },
        3: { repartition: [0, 0, 0, 5], valide: true, debloquee: false },
      },
    };
    expect(revelationPrete(misesDesEquipes(etat(), manche, toutes, 10_000))).toBe(true);
  });
});
