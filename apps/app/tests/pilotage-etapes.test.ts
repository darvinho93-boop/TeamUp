import { describe, expect, it } from 'vitest';
import { calculerEtape, scriptEnCours, type Commande } from '../src/lib/pilotage';
import type { EtatSalle, MancheSalle, PassageSalle } from '../src/lib/salle';

const motifs = {
  pointsCommuns: (equipe: string) => `PC ${equipe}`,
  tenu: 'tenu',
  rate: 'raté',
  quiz: (n: number) => `Quiz ${n}`,
  mime: (equipe: string) => `Mime ${equipe}`,
  photo: (equipe: string) => `Photo ${equipe}`,
  duel: (prenom: string, equipe: string) => `Duel ${prenom} ${equipe}`,
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
      photos_closes: false,
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
      {
        id: 'qz',
        jeu: 'qcm2',
        ordre: 3,
        statut: 'a_venir',
        options: { questions: 2 },
        passages: [passage('q1', 1), passage('q2', 2)],
      },
      {
        id: 'mi',
        jeu: 'mime2',
        ordre: 4,
        statut: 'a_venir',
        options: {},
        passages: [passage('m1', 1, { equipe_id: 'e1' }), passage('m2', 2, { equipe_id: 'e2' })],
      },
      {
        id: 'ph',
        jeu: 'photo2',
        ordre: 5,
        statut: 'a_venir',
        options: { themes: 2 },
        passages: [
          passage('th1', 1, {
            photos: [
              { equipe_id: 'e1', chemin: 'a.jpg', envoyee_ms: 1, gagnante: false },
              { equipe_id: 'e2', chemin: 'b.jpg', envoyee_ms: 2, gagnante: false },
            ],
          }),
          passage('th2', 2, { photos: [] }),
        ],
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

  it('Quiz : le mode se fixe au lancement, la croix par défaut, la question attend « Afficher »', () => {
    const intro = etat({ scene: 'intro', manche_id: 'qz' });
    const croix = etape(intro, { type: 'commencer' });
    expect(croix?.manche).toEqual({ id: 'qz', statut: 'en_cours', options: { mode: 'croix' } });
    expect(croix?.pilotage).toMatchObject({ scene: 'jeu', passage_id: 'q1', etape: 'pret' });
    expect(croix?.passage).toBeNull();
    const tel = etape(intro, { type: 'commencer', mode: 'telephone' });
    expect(tel?.manche?.options).toEqual({ mode: 'telephone' });
  });

  it('Quiz : afficher ouvre la question et lance 30 s ; révéler la termine', () => {
    const pret = etat({ scene: 'jeu', manche_id: 'qz', passage_id: 'q1', etape: 'pret' });
    expect(etape(pret, { type: 'quiz', action: 'afficher' })).toMatchObject({
      pilotage: { etape: 'question', chrono: 'demarrer', chrono_duree_s: 30 },
      passage: { id: 'q1', statut: 'en_cours' },
    });
    const question = etat({ scene: 'jeu', manche_id: 'qz', passage_id: 'q1', etape: 'question' });
    expect(etape(question, { type: 'quiz', action: 'reveler' })).toMatchObject({
      pilotage: { etape: 'reponse', chrono: 'arreter' },
      passage: { id: 'q1', statut: 'termine' },
    });
  });

  it('Quiz : question suivante, puis fin des questions après la dernière', () => {
    const e = etat({ scene: 'jeu', manche_id: 'qz', passage_id: 'q1', etape: 'reponse' });
    e.programme[2]!.passages[0]!.statut = 'termine';
    expect(etape(e, { type: 'quiz', action: 'suivante' })?.pilotage).toMatchObject({
      passage_id: 'q2',
      etape: 'pret',
    });
    expect(etape(e, { type: 'quiz', action: 'fin' })).toBeNull();

    const derniere = etat({ scene: 'jeu', manche_id: 'qz', passage_id: 'q2', etape: 'reponse' });
    for (const p of derniere.programme[2]!.passages) p.statut = 'termine';
    expect(etape(derniere, { type: 'quiz', action: 'fin' })?.pilotage.etape).toBe('survivants');
  });

  it('Quiz : une question annulée ne compte pas et passe à la suivante', () => {
    const e = etat({ scene: 'jeu', manche_id: 'qz', passage_id: 'q1', etape: 'question' });
    expect(etape(e, { type: 'quiz', action: 'annuler' })).toMatchObject({
      pilotage: { etape: 'pret', passage_id: 'q2', chrono: 'arreter' },
      passage: { id: 'q1', statut: 'termine', resultat: { annulee: true } },
    });
  });

  // Critère du lot 7, côté régie : la même saisie de survivants écrit les mêmes points,
  // que la manche se joue à la croix ou au téléphone.
  it('Quiz : les deux modes écrivent les mêmes points pour les mêmes survivants', () => {
    const survivants = { 1: 3, 2: 0, 3: 1 };
    const ecritures = (['croix', 'telephone'] as const).map((mode) => {
      const e = etat({ scene: 'jeu', manche_id: 'qz', passage_id: 'q2', etape: 'survivants' });
      e.programme[2]!.options = { questions: 2, mode };
      return etape(e, { type: 'survivants', survivants });
    });
    expect(ecritures[0]?.scores).toEqual([
      { equipe_id: 'e1', points: 300, motif: 'Quiz 3', manche_id: 'qz' },
      { equipe_id: 'e3', points: 100, motif: 'Quiz 1', manche_id: 'qz' },
    ]);
    expect(ecritures[1]?.scores).toEqual(ecritures[0]?.scores);
    expect(ecritures[0]?.pilotage.etape).toBe('resultat');
    expect(ecritures[0]?.manche).toEqual({
      id: 'qz',
      statut: 'en_cours',
      options: { survivants },
    });
  });

  it('Mime : montrer, lancer 2 min 30, puis trouvé vaut +100 à l’équipe du passage', () => {
    const intro = etat({ scene: 'intro', manche_id: 'mi' });
    expect(etape(intro, { type: 'commencer' })).toMatchObject({
      pilotage: { passage_id: 'm1', etape: 'pret' },
      passage: { id: 'm1', statut: 'en_cours' },
      manche: { id: 'mi', statut: 'en_cours' },
    });
    const pret = etat({ scene: 'jeu', manche_id: 'mi', passage_id: 'm1', etape: 'pret' });
    expect(etape(pret, { type: 'mime', action: 'montrer' })?.pilotage.etape).toBe('secret');
    expect(etape(pret, { type: 'mime', action: 'lancer' })).toBeNull();
    const secret = etat({ scene: 'jeu', manche_id: 'mi', passage_id: 'm1', etape: 'secret' });
    expect(etape(secret, { type: 'mime', action: 'lancer' })?.pilotage).toMatchObject({
      etape: 'lance',
      chrono: 'demarrer',
      chrono_duree_s: 150,
    });
    const lance = etat({ scene: 'jeu', manche_id: 'mi', passage_id: 'm1', etape: 'lance' });
    const trouve = etape(lance, { type: 'mime', action: 'trouve' }, 42_000);
    expect(trouve?.passage).toMatchObject({ id: 'm1', statut: 'termine', points: 100 });
    expect(trouve?.scores).toEqual([
      { equipe_id: 'e1', points: 100, motif: 'Mime Navy', manche_id: 'mi' },
    ]);
    expect(etape(lance, { type: 'mime', action: 'rate' })?.scores).toEqual([]);
  });

  it('Mime : passe à l’équipe suivante après le verdict', () => {
    const e = etat({ scene: 'jeu', manche_id: 'mi', passage_id: 'm1', etape: 'rate' });
    e.programme[3]!.passages[0]!.statut = 'termine';
    expect(etape(e, { type: 'suivant' })).toMatchObject({
      pilotage: { passage_id: 'm2', etape: 'pret' },
      passage: { id: 'm2', statut: 'en_cours' },
    });
  });

  it('Photo : la diffusion commence au premier thème, sans chrono', () => {
    const intro = etat({ scene: 'intro', manche_id: 'ph' });
    expect(etape(intro, { type: 'commencer' })).toMatchObject({
      pilotage: { scene: 'jeu', passage_id: 'th1', etape: 'theme', chrono: 'arreter' },
      passage: { id: 'th1', statut: 'en_cours' },
      manche: { id: 'ph', statut: 'en_cours' },
    });
  });

  it('Photo : la gagnante vaut +100 à son équipe, et seulement une équipe qui a envoyé', () => {
    const theme = etat({ scene: 'jeu', manche_id: 'ph', passage_id: 'th1', etape: 'theme' });
    const gagnante = etape(theme, { type: 'photo', action: { type: 'gagnante', equipe: 2 } });
    expect(gagnante?.pilotage.etape).toBe('gagnante');
    expect(gagnante?.passage).toEqual({
      id: 'th1',
      statut: 'termine',
      resultat: { equipe_gagnante: 2 },
      points: 100,
    });
    expect(gagnante?.scores).toEqual([
      { equipe_id: 'e2', points: 100, motif: 'Photo Corail', manche_id: 'ph' },
    ]);
    expect(etape(theme, { type: 'photo', action: { type: 'gagnante', equipe: 3 } })).toBeNull();
    const aucune = etape(theme, { type: 'photo', action: { type: 'aucune' } });
    expect(aucune?.passage).toMatchObject({ resultat: { equipe_gagnante: null }, points: 0 });
    expect(aucune?.scores).toEqual([]);
  });

  it('Photo : passe au thème suivant une fois la gagnante désignée', () => {
    const e = etat({ scene: 'jeu', manche_id: 'ph', passage_id: 'th1', etape: 'gagnante' });
    e.programme[4]!.passages[0]!.statut = 'termine';
    expect(etape(e, { type: 'suivant' })).toMatchObject({
      pilotage: { passage_id: 'th2', etape: 'theme' },
      passage: { id: 'th2', statut: 'en_cours' },
    });
    const theme = etat({ scene: 'jeu', manche_id: 'ph', passage_id: 'th1', etape: 'theme' });
    expect(etape(theme, { type: 'suivant' })).toBeNull();
  });
});

describe('un duel en bêta, touche par touche', () => {
  const duellistes = [
    { joueur_id: 'j1', prenom: 'Zoé', equipe: 1 },
    { joueur_id: 'j2', prenom: 'Malik', equipe: 2 },
  ] as const;
  const programme = (resultat = {}, statut: PassageSalle['statut'] = 'en_cours'): MancheSalle[] => [
    {
      id: 'du',
      jeu: 'cup',
      ordre: 1,
      statut: 'en_cours',
      options: { duels: 2 },
      passages: [passage('d1', 1, { statut, resultat }), passage('d2', 2)],
    },
  ];
  const sur = (etape: string, resultat = {}) =>
    etat({ scene: 'jeu', manche_id: 'du', passage_id: 'd1', etape }, programme(resultat));

  it('commence par le tirage du premier duel', () => {
    const e = etat({ scene: 'intro', manche_id: 'du' }, programme());
    const ecriture = calculerEtape(e, { type: 'commencer' }, 0, motifs)!;
    expect(ecriture.pilotage).toMatchObject({ scene: 'jeu', passage_id: 'd1', etape: 'tirage' });
    expect(ecriture.passage).toEqual({ id: 'd1', statut: 'en_cours' });
  });

  it('garde les duellistes tirés dans le résultat du passage', () => {
    const ecriture = calculerEtape(
      sur('tirage'),
      { type: 'duel', action: { type: 'tirer', duellistes } },
      0,
      motifs,
    )!;
    expect(ecriture.pilotage.etape).toBe('tirage');
    expect(ecriture.passage).toEqual({ id: 'd1', statut: 'en_cours', resultat: { duellistes } });
  });

  it('ne présente pas un duel sans duellistes', () => {
    expect(
      calculerEtape(sur('tirage'), { type: 'duel', action: { type: 'presenter' } }, 0, motifs),
    ).toBeNull();
  });

  it('lance 45 s pour le gobelet, puis donne +50 à l’équipe du vainqueur', () => {
    const lancer = calculerEtape(
      sur('face_a_face', { duellistes }),
      { type: 'duel', action: { type: 'lancer' } },
      0,
      motifs,
    )!;
    expect(lancer.pilotage).toMatchObject({
      etape: 'chrono',
      chrono: 'demarrer',
      chrono_duree_s: 45,
    });

    const verdict = calculerEtape(
      sur('chrono', { duellistes }),
      { type: 'duel', action: { type: 'verdict', gagnant: 1 } },
      12_000,
      motifs,
    )!;
    expect(verdict.passage).toEqual({
      id: 'd1',
      statut: 'termine',
      resultat: { duellistes, gagnant: 1 },
      points: 50,
    });
    expect(verdict.scores).toEqual([
      { equipe_id: 'e2', points: 50, motif: 'Duel Malik Corail', manche_id: 'du' },
    ]);
  });

  it('passe au tirage du duel suivant', () => {
    // Au verdict, la base a terminé le passage.
    const e = etat(
      { scene: 'jeu', manche_id: 'du', passage_id: 'd1', etape: 'gagne' },
      programme({ duellistes, gagnant: 0 }, 'termine'),
    );
    const ecriture = calculerEtape(e, { type: 'suivant' }, 0, motifs)!;
    expect(ecriture.pilotage).toMatchObject({ passage_id: 'd2', etape: 'tirage' });
  });
});

describe('l’explication animée', () => {
  it('démarre le chrono pour la durée du script, sans quitter l’intro', () => {
    const ecriture = etape(etat({ scene: 'intro', manche_id: 'pc' }), { type: 'expliquer' });
    expect(ecriture?.pilotage).toMatchObject({
      scene: 'intro',
      manche_id: 'pc',
      etape: 'explication',
      chrono: 'demarrer',
      chrono_duree_s: 24,
    });
    expect(ecriture?.manche).toBeNull();
    expect(ecriture?.ouvrirLaSoiree).toBe(false);
  });

  it('rejouer repart de zéro', () => {
    const e = etat({ scene: 'intro', manche_id: 'pc', etape: 'explication' });
    expect(etape(e, { type: 'expliquer' })?.pilotage.chrono).toBe('demarrer');
  });

  it('le Quiz s’explique en mode téléphone sur demande, les autres jeux l’ignorent', () => {
    const quiz = etape(etat({ scene: 'intro', manche_id: 'qz' }), {
      type: 'expliquer',
      telephone: true,
    });
    expect(quiz?.pilotage.etape).toBe('explication-telephone');
    const mime = etape(etat({ scene: 'intro', manche_id: 'mi' }), {
      type: 'expliquer',
      telephone: true,
    });
    expect(mime?.pilotage.etape).toBe('explication');
  });

  it('arrêter ramène l’intro fixe', () => {
    const e = etat({ scene: 'intro', manche_id: 'pc', etape: 'explication' });
    expect(etape(e, { type: 'arreterExplication' })?.pilotage).toMatchObject({
      scene: 'intro',
      etape: null,
      chrono: 'arreter',
    });
  });

  it('n’existe qu’en intro', () => {
    const e = etat({ scene: 'jeu', manche_id: 'pc', passage_id: 'p1', etape: 'lance' });
    expect(etape(e, { type: 'expliquer' })).toBeNull();
    expect(etape(e, { type: 'arreterExplication' })).toBeNull();
  });

  it('l’écran sait quel script jouer', () => {
    expect(scriptEnCours('qcm2', 'intro', 'explication')).toBe('qcm2');
    expect(scriptEnCours('qcm2', 'intro', 'explication-telephone')).toBe('qcm2-telephone');
    expect(scriptEnCours('mime2', 'intro', 'explication-telephone')).toBeNull();
    expect(scriptEnCours('mime2', 'intro', null)).toBeNull();
    expect(scriptEnCours('mime2', 'jeu', 'explication')).toBeNull();
  });
});

describe("le tirage de l'ordre de passage", () => {
  const intro = (manche: string, extra: Partial<EtatSalle['pilotage']> = {}) =>
    etat({ scene: 'intro', manche_id: manche, ...extra });

  it('anime le tirage et emporte le nouvel ordre', () => {
    const ecriture = etape(intro('pc'), { type: 'tirerOrdre', passages: ['p2', 'p1'] });
    expect(ecriture?.pilotage).toMatchObject({
      scene: 'intro',
      etape: 'tirage-ordre',
      chrono: 'demarrer',
      chrono_duree_s: 5,
    });
    expect(ecriture?.ordre).toEqual({ manche_id: 'pc', passages: ['p2', 'p1'] });
    expect(ecriture?.passage).toBeNull();
  });

  it('seulement pour les jeux joués une équipe à la fois', () => {
    expect(etape(intro('mi'), { type: 'tirerOrdre', passages: ['m2', 'm1'] })).not.toBeNull();
    expect(etape(intro('qz'), { type: 'tirerOrdre', passages: ['q2', 'q1'] })).toBeNull();
  });

  it('refuse une liste qui n’est pas exactement celle des passages', () => {
    for (const passages of [['p1'], ['p1', 'p1'], ['p1', 'x'], ['p1', 'p2', 'p2']]) {
      expect(etape(intro('pc'), { type: 'tirerOrdre', passages })).toBeNull();
    }
  });

  it('refuse hors de l’intro, ou une fois la manche commencée', () => {
    const e = etat({ scene: 'jeu', manche_id: 'pc', passage_id: 'p1', etape: 'pret' });
    expect(etape(e, { type: 'tirerOrdre', passages: ['p2', 'p1'] })).toBeNull();
    const commencee = intro('pc');
    commencee.programme[0] = { ...commencee.programme[0]!, statut: 'en_cours' };
    expect(etape(commencee, { type: 'tirerOrdre', passages: ['p2', 'p1'] })).toBeNull();
  });

  it('les autres touches n’emportent aucun ordre', () => {
    expect(etape(intro('pc'), { type: 'expliquer' })?.ordre).toBeNull();
  });
});
