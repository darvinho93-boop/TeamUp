import { describe, expect, it } from 'vitest';
import { dureeElement, SEQUENCE_TOURNOI_S } from '@teamup/game';
import { calculerEtape, type Commande, type Motifs } from '../src/lib/pilotage';
import { elementDuProgramme } from '../src/lib/programme';
import type { EtatSalle, MancheSalle, TournoiSalle } from '../src/lib/salle';
import {
  estTournoi,
  etapeDeReprise,
  grilleDesPostes,
  matchDepuisLigne,
  matchsDuPrenom,
  nomDuTour,
  vueDuTournoi,
  type MatchSalle,
  type TournoiJoueur,
} from '../src/lib/tournoi';

const motifs = {
  pointsCommuns: () => '',
  tenu: '',
  rate: '',
  podiumMots: () => '',
  quiz: () => '',
  quizJetons: () => '',
  mime: () => '',
  cinemime: () => '',
  photo: () => '',
  duel: () => '',
  tournoi: (equipe: string) => `Tournoi ${equipe}`,
  blind: () => '',
  portrait: () => '',
} satisfies Motifs;

const match = (poste: number, gagnant: 0 | 1 | null): MatchSalle => ({
  id: `m${poste}`,
  tour: 1,
  rang: poste - 1,
  a: { joueur_id: `a${poste}`, prenom: `Élodie${poste}`, equipe: 1 },
  b: { joueur_id: `b${poste}`, prenom: `Zoé${poste}`, equipe: 2 },
  gagnant,
  sequence: 1,
  poste,
});

const tournoi = (extra: Partial<TournoiSalle> = {}): TournoiSalle => ({
  gobelets: 4,
  joueurs: 16,
  tours: 4,
  sequence: 1,
  tour: 1,
  reste: true,
  en_lice: 16,
  matchs: [match(1, null), match(2, null)],
  tableau: [],
  ...extra,
});

function salle(etape: string | null, t: TournoiSalle | null, statut: 'a_venir' | 'en_cours') {
  const manche: MancheSalle = {
    id: 'cup',
    jeu: 'cup',
    ordre: 1,
    statut,
    options: { format: 'tournoi', gobelets: 4 },
    passages: [
      {
        id: 'p1',
        ordre: 1,
        statut: statut === 'a_venir' ? 'a_venir' : 'en_cours',
        equipe_id: null,
        points: null,
        resultat: {},
        contenu_id: null,
        public: {},
        secret: null,
      },
    ],
  };
  return {
    serveur_ms: 0,
    evenement: {
      id: 'ev',
      code: 'ABCDEF',
      langues: ['fr'],
      statut: 'en_cours',
      client_nom: 'Test',
      creneau_minutes: 60,
      photos_closes: false,
    },
    pilotage: {
      scene: etape === null ? 'intro' : 'jeu',
      manche_id: 'cup',
      passage_id: etape === null ? null : 'p1',
      etape,
      indices: 0,
      chrono_depart_ms: null,
      chrono_duree_s: null,
      version: 'v1',
    },
    tournoi: t,
    equipes: [
      { id: 'e1', numero: 1, nom: 'Navy', points: 0, joueurs: 8, prenoms: [] },
      { id: 'e2', numero: 2, nom: 'Sauge', points: 0, joueurs: 8, prenoms: [] },
    ],
    joueurs: 16,
    connectes: 16,
    programme: [manche],
  } satisfies EtatSalle;
}

const appliquer = (etat: EtatSalle, commande: Commande) => calculerEtape(etat, commande, 0, motifs);
const sequence = { manche_id: 'cup', numero: 2, matchs: ['m3'], gobelets: 4 };

describe('lire le tableau', () => {
  it('reconnaît un tournoi, pas un gobelet en duels simples', () => {
    expect(estTournoi({ jeu: 'cup', options: { format: 'tournoi' } })).toBe(true);
    expect(estTournoi({ jeu: 'cup', options: { duels: 3 } })).toBe(false);
    expect(estTournoi({ jeu: 'grab', options: { format: 'tournoi' } })).toBe(false);
    expect(estTournoi(null)).toBe(false);
  });

  it('traduit une ligne de la base, joueur retiré compris', () => {
    const m = matchDepuisLigne({
      id: 'x',
      tour: 2,
      rang: 3,
      joueur_a: null,
      prenom_a: 'Camille',
      equipe_a: 4,
      joueur_b: null,
      prenom_b: null,
      equipe_b: null,
      gagnant: null,
      sequence: null,
      poste: null,
    });
    expect(m.a).toEqual({ joueur_id: '', prenom: 'Camille', equipe: 4 });
    expect(m.b).toBeNull();
  });

  it.each([
    [8, 8, 'finale'],
    [7, 8, 'demi'],
    [6, 8, 'quart'],
    [5, 8, 'huitieme'],
    [4, 8, 'seizieme'],
    [3, 8, 't32'],
    [2, 8, 't64'],
    [1, 8, 't128'],
    [1, 7, 't64'],
    [1, 4, 'huitieme'],
  ])('tour %i sur %i : %s', (tour, tours, attendu) => {
    expect(nomDuTour(tour, tours)).toBe(attendu);
  });

  it('retrouve un match par prénom, sans accents ni casse', () => {
    const matchs = [match(1, null), match(2, null)];
    expect(matchsDuPrenom(matchs, 'elodie2')).toEqual([matchs[1]]);
    expect(matchsDuPrenom(matchs, 'ZOE1')).toEqual([matchs[0]]);
    expect(matchsDuPrenom(matchs, '  ')).toEqual(matchs);
    expect(matchsDuPrenom(matchs, 'personne')).toEqual([]);
  });
});

describe('grille des postes', () => {
  it.each([
    [1, 1, 1],
    [2, 2, 1],
    [4, 2, 2],
    [5, 3, 2],
    [9, 3, 3],
    [12, 4, 3],
    [16, 4, 4],
    [32, 4, 8],
  ])('%i postes : %i colonnes, %i rangées', (n, colonnes, rangees) => {
    expect(grilleDesPostes(n)).toEqual({ colonnes, rangees });
  });
});

describe('ce que dit le téléphone', () => {
  const zoe = { joueur_id: 'z', prenom: 'Zoé', equipe: 2 };
  const base: TournoiJoueur = {
    etape: 'appel',
    tire: true,
    tours: 4,
    sequence: 2,
    exempte: false,
    match: { tour: 1, sequence: 2, poste: 7, adversaire: zoe, gagne: null },
  };

  it('avant le tirage, et pour qui est arrivé après', () => {
    expect(vueDuTournoi({ ...base, tire: false, match: null }).cas).toBe('prepare');
    expect(vueDuTournoi({ ...base, match: null }).cas).toBe('spectateur');
  });

  it.each(['appel', 'jeu', 'resultats'])('à l’étape %s, son poste et son adversaire', (etape) => {
    expect(vueDuTournoi({ ...base, etape })).toEqual({
      cas: 'appele',
      poste: 7,
      adversaire: zoe,
      etape,
    });
  });

  it('un match d’une autre séquence attend', () => {
    expect(
      vueDuTournoi({ ...base, match: { ...base.match!, sequence: null, poste: null } }),
    ).toEqual({ cas: 'attente', passe: null, adversaire: zoe });
  });

  it('distingue un exempté d’un joueur qualifié', () => {
    const suivant = { tour: 2, sequence: null, poste: null, adversaire: null, gagne: null };
    expect(vueDuTournoi({ ...base, exempte: true, match: suivant })).toEqual({
      cas: 'attente',
      passe: 'exempte',
      adversaire: null,
    });
    expect(vueDuTournoi({ ...base, match: suivant })).toEqual({
      cas: 'attente',
      passe: 'qualifie',
      adversaire: null,
    });
    // Un exempté qui a gagné son deuxième tour est un qualifié comme un autre.
    expect(vueDuTournoi({ ...base, exempte: true, match: { ...suivant, tour: 3 } })).toMatchObject({
      passe: 'qualifie',
    });
  });

  it('hors jeu après une défaite, champion après la finale', () => {
    expect(vueDuTournoi({ ...base, match: { ...base.match!, gagne: false } }).cas).toBe('elimine');
    expect(
      vueDuTournoi({ ...base, etape: 'vainqueur', match: { ...base.match!, tour: 4, gagne: true } })
        .cas,
    ).toBe('champion');
  });
});

describe('reprise d’un tournoi quitté', () => {
  it('revient au tirage, à l’appel ou aux résultats', () => {
    expect(etapeDeReprise(null)).toBe('tirage');
    expect(etapeDeReprise(tournoi({ sequence: null, matchs: [] }))).toBe('tirage');
    expect(etapeDeReprise(tournoi())).toBe('appel');
    expect(etapeDeReprise(tournoi({ matchs: [match(1, 0), match(2, null)] }))).toBe('resultats');
  });

  it('« Commencer » ouvre le tirage, une reprise retombe sur les résultats', () => {
    const neuf = { ...salle(null, null, 'a_venir') };
    expect(appliquer(neuf, { type: 'commencer' })?.pilotage).toMatchObject({
      scene: 'jeu',
      passage_id: 'p1',
      etape: 'tirage',
    });
    const repris = salle(null, tournoi({ matchs: [match(1, 0), match(2, null)] }), 'en_cours');
    expect(appliquer(repris, { type: 'commencer' })?.pilotage.etape).toBe('resultats');
  });
});

describe('touches du tournoi', () => {
  it('appeler écrit la séquence avec l’étape', () => {
    const e = appliquer(salle('tirage', tournoi({ sequence: null, matchs: [] }), 'en_cours'), {
      type: 'tournoi',
      action: 'appeler',
      sequence,
    });
    expect(e?.pilotage.etape).toBe('appel');
    expect(e?.sequence).toEqual(sequence);
  });

  it('n’appelle pas sans séquence, ni tant qu’un résultat manque', () => {
    expect(
      appliquer(salle('tirage', tournoi({ sequence: null, matchs: [] }), 'en_cours'), {
        type: 'tournoi',
        action: 'appeler',
      }),
    ).toBeNull();
    expect(
      appliquer(salle('resultats', tournoi(), 'en_cours'), {
        type: 'tournoi',
        action: 'appeler',
        sequence,
      }),
    ).toBeNull();
  });

  it('lancer démarre le chrono de 45 s, la fin l’arrête', () => {
    const lance = appliquer(salle('appel', tournoi(), 'en_cours'), {
      type: 'tournoi',
      action: 'lancer',
    });
    expect(lance?.pilotage).toMatchObject({ etape: 'jeu', chrono: 'demarrer', chrono_duree_s: 45 });
    const fin = appliquer(salle('jeu', tournoi(), 'en_cours'), { type: 'tournoi', action: 'fin' });
    expect(fin?.pilotage).toMatchObject({ etape: 'resultats', chrono: 'arreter' });
  });

  it('conclure donne les points aux équipes et termine le passage', () => {
    const finale = tournoi({ reste: false, matchs: [match(1, 0)] });
    const e = appliquer(salle('resultats', finale, 'en_cours'), {
      type: 'tournoi',
      action: 'conclure',
      points: { 1: 130, 2: 90 },
    });
    expect(e?.pilotage.etape).toBe('vainqueur');
    expect(e?.passage).toEqual({ id: 'p1', statut: 'termine', points: 220 });
    expect(e?.scores).toEqual([
      { equipe_id: 'e1', points: 130, motif: 'Tournoi Navy', manche_id: 'cup' },
      { equipe_id: 'e2', points: 90, motif: 'Tournoi Sauge', manche_id: 'cup' },
    ]);
  });

  it('ne conclut pas avant la finale', () => {
    expect(
      appliquer(salle('resultats', tournoi({ matchs: [match(1, 0)] }), 'en_cours'), {
        type: 'tournoi',
        action: 'conclure',
        points: { 1: 100 },
      }),
    ).toBeNull();
  });

  it('refuse les touches du tournoi sur un gobelet en duels simples', () => {
    const e = salle('tirage', tournoi(), 'en_cours');
    e.programme[0]!.options = { duels: 3 };
    expect(appliquer(e, { type: 'tournoi', action: 'appeler', sequence })).toBeNull();
  });
});

describe('budget de minutes', () => {
  const chiffrer = (options: Record<string, unknown>, joueursPrevus?: number) =>
    dureeElement(
      elementDuProgramme({
        jeu: 'cup',
        options,
        passages: 1,
        ...(joueursPrevus === undefined ? {} : { joueursPrevus }),
      }),
    );

  it('compte les joueurs tirés, sinon ceux attendus, sinon seize', () => {
    const f = { format: 'tournoi', gobelets: 16 };
    expect(chiffrer({ ...f, joueurs: 100 }, 20)).toBe(11 * SEQUENCE_TOURNOI_S);
    expect(chiffrer(f, 100)).toBe(11 * SEQUENCE_TOURNOI_S);
    expect(chiffrer(f, 0)).toBe(5 * SEQUENCE_TOURNOI_S);
    expect(chiffrer(f)).toBe(5 * SEQUENCE_TOURNOI_S);
  });

  it('laisse les duels simples comme avant', () => {
    expect(chiffrer({ duels: 3 })).toBe(135);
  });
});
