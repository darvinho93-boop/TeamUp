import { describe, expect, it } from 'vitest';
import { calculerEtape, type Commande } from '../src/lib/pilotage';
import type { EtatSalle, MancheSalle, PassageSalle } from '../src/lib/salle';

const motifs = {
  pointsCommuns: (equipe: string) => `PC ${equipe}`,
  tenu: 'tenu',
  rate: 'raté',
};

function passage(id: string, ordre: number, extra: Partial<PassageSalle> = {}): PassageSalle {
  return {
    id,
    ordre,
    statut: 'a_venir',
    equipe_id: null,
    points: null,
    resultat: {},
    contenu_id: null,
    public: {},
    secret: null,
    ...extra,
  };
}

function etat(pilotage: Partial<EtatSalle['pilotage']>, programme?: MancheSalle[]): EtatSalle {
  return {
    serveur_ms: 0,
    evenement: {
      id: 'ev',
      code: 'ABCDEF',
      langues: ['fr'],
      statut: 'preparation',
      client_nom: 'Test',
      creneau_minutes: 40,
    },
    pilotage: {
      scene: 'accueil',
      manche_id: null,
      passage_id: null,
      etape: null,
      indices: 0,
      chrono_depart_ms: null,
      chrono_duree_s: null,
      version: 'v1',
      ...pilotage,
    },
    equipes: [
      { id: 'e1', numero: 1, nom: 'Navy', points: 0, joueurs: 2, prenoms: [] },
      { id: 'e2', numero: 2, nom: 'Corail', points: 0, joueurs: 3, prenoms: [] },
      { id: 'e3', numero: 3, nom: 'Sauge', points: 0, joueurs: 0, prenoms: [] },
    ],
    joueurs: 5,
    connectes: 5,
    programme: programme ?? [
      {
        id: 'pc',
        jeu: 'list2',
        ordre: 1,
        statut: 'a_venir',
        options: {},
        passages: [passage('p1', 1, { equipe_id: 'e1' }), passage('p2', 2, { equipe_id: 'e2' })],
      },
      {
        id: 'se',
        jeu: 'enchere2',
        ordre: 2,
        statut: 'a_venir',
        options: { chrono_s: 45 },
        passages: [passage('t1', 1), passage('t2', 2)],
      },
    ],
  };
}

const etape = (e: EtatSalle, c: Commande, ecouleMs = 0) => calculerEtape(e, c, ecouleMs, motifs);

describe('une touche de la régie', () => {
  it('change de scène sans toucher au reste', () => {
    const ecriture = etape(etat({ manche_id: 'pc' }), { type: 'scene', scene: 'equipes' });
    expect(ecriture?.pilotage).toMatchObject({
      scene: 'equipes',
      manche_id: 'pc',
      chrono: 'garder',
    });
    expect(ecriture?.scores).toEqual([]);
  });

  it('lance Points communs sur la première équipe, et ouvre la soirée', () => {
    const ecriture = etape(etat({ scene: 'intro', manche_id: 'pc' }), { type: 'commencer' });
    expect(ecriture?.pilotage).toMatchObject({ scene: 'jeu', passage_id: 'p1', etape: 'pret' });
    expect(ecriture?.passage).toEqual({ id: 'p1', statut: 'en_cours' });
    expect(ecriture?.manche).toEqual({ id: 'pc', statut: 'en_cours' });
    expect(ecriture?.ouvrirLaSoiree).toBe(true);
  });

  it('valider compte le barème au temps de l’appui, pour l’équipe du passage', () => {
    const e = etat({ scene: 'jeu', manche_id: 'pc', passage_id: 'p1', etape: 'lance' });
    const ecriture = etape(e, { type: 'pointsCommuns', action: 'valider' }, 10_000);
    expect(ecriture?.pilotage).toMatchObject({ etape: 'trouve', chrono: 'arreter' });
    expect(ecriture?.passage).toMatchObject({ id: 'p1', statut: 'termine', points: 255 });
    expect(ecriture?.scores).toEqual([
      { equipe_id: 'e1', points: 255, motif: 'PC Navy', manche_id: 'pc' },
    ]);
  });

  it('l’échec termine le passage sans ligne de score', () => {
    const e = etat({ scene: 'jeu', manche_id: 'pc', passage_id: 'p1', etape: 'lance' });
    const ecriture = etape(e, { type: 'pointsCommuns', action: 'echec' }, 130_000);
    expect(ecriture?.passage).toMatchObject({ statut: 'termine', points: 0 });
    expect(ecriture?.scores).toEqual([]);
  });

  it('refuse une touche hors de son étape, ou un indice avant son palier', () => {
    const pret = etat({ scene: 'jeu', manche_id: 'pc', passage_id: 'p1', etape: 'pret' });
    expect(etape(pret, { type: 'pointsCommuns', action: 'masquer' })).toBeNull();
    const lance = etat({ scene: 'jeu', manche_id: 'pc', passage_id: 'p1', etape: 'lance' });
    expect(etape(lance, { type: 'pointsCommuns', action: 'indice' }, 30_000)).toBeNull();
    expect(
      etape(lance, { type: 'pointsCommuns', action: 'indice' }, 61_000)?.pilotage.indices,
    ).toBe(1);
  });

  it('passe à l’équipe suivante une fois le passage joué', () => {
    const e = etat({ scene: 'jeu', manche_id: 'pc', passage_id: 'p1', etape: 'trouve' });
    e.programme[0]!.passages[0]!.statut = 'termine';
    const ecriture = etape(e, { type: 'suivant' });
    expect(ecriture?.pilotage).toMatchObject({ passage_id: 'p2', etape: 'pret', indices: 0 });
  });

  it('Surenchère : le chrono géant prend la durée réglée à la préparation', () => {
    const e = etat({ scene: 'jeu', manche_id: 'se', passage_id: 't1', etape: 'sujet' });
    expect(etape(e, { type: 'adjuger' })?.pilotage).toMatchObject({
      etape: 'chrono',
      chrono: 'demarrer',
      chrono_duree_s: 45,
    });
  });

  it('Surenchère ratée : +20 aux autres équipes qui ont des joueurs', () => {
    const e = etat({ scene: 'jeu', manche_id: 'se', passage_id: 't1', etape: 'chrono' });
    const ecriture = etape(e, { type: 'verdict', tenu: false, equipeChampion: 1 });
    // L'équipe 3 n'a personne : elle ne marque pas.
    expect(ecriture?.scores).toEqual([
      { equipe_id: 'e2', points: 20, motif: 'raté', manche_id: 'se' },
    ]);
    expect(ecriture?.passage).toMatchObject({ id: 't1', statut: 'termine', points: 20 });
  });

  it('Surenchère tenue par une équipe sans téléphone : elle marque quand même', () => {
    const e = etat({ scene: 'jeu', manche_id: 'se', passage_id: 't1', etape: 'chrono' });
    const ecriture = etape(e, { type: 'verdict', tenu: true, equipeChampion: 3 });
    expect(ecriture?.scores).toEqual([
      { equipe_id: 'e3', points: 100, motif: 'tenu', manche_id: 'se' },
    ]);
  });

  it('terminer la manche affiche le classement', () => {
    const ecriture = etape(etat({ scene: 'jeu', manche_id: 'pc', etape: 'trouve' }), {
      type: 'terminer',
    });
    expect(ecriture?.manche).toEqual({ id: 'pc', statut: 'terminee' });
    expect(ecriture?.pilotage).toMatchObject({ scene: 'scores', manche_id: null, etape: null });
  });
});
