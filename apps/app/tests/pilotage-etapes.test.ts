import { describe, expect, it } from 'vitest';
import { KARAOKE_MAX_S } from '@teamup/game';
import {
  calculerEtape,
  mancheATerminer,
  quizEnSuspens,
  scriptEnCours,
  survivantsComptes,
  type Commande,
} from '../src/lib/pilotage';
import type { EtatSalle, MancheSalle, PassageSalle } from '../src/lib/salle';

const motifs = {
  pointsCommuns: (equipe: string) => `PC ${equipe}`,
  tenu: 'tenu',
  rate: 'raté',
  quiz: (n: number) => `Quiz ${n}`,
  quizJetons: (n: number) => `Jetons ${n}`,
  podiumMots: (rang: number, mots: number) => `Podium ${rang} ${mots}`,
  mime: (equipe: string) => `Mime ${equipe}`,
  cinemime: (equipe: string) => `Ciné ${equipe}`,
  photo: (equipe: string) => `Photo ${equipe}`,
  duel: (prenom: string, equipe: string) => `Duel ${prenom} ${equipe}`,
  tournoi: (equipe: string) => `Tournoi ${equipe}`,
  blind: (n: number) => `Blind ${n}`,
  portrait: (cible: number, tour: number) => `Portrait ${cible} (${tour})`,
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

  it('relancer un passage efface les indices d’un premier essai', () => {
    const masque = etat({
      scene: 'jeu',
      manche_id: 'pc',
      passage_id: 'p1',
      etape: 'masque',
      indices: 1,
    });
    masque.programme[0]!.passages[0]!.resultat = { indices_ms: [62_000] };
    const lancement = etape(masque, { type: 'pointsCommuns', action: 'lancer' });
    expect(lancement?.pilotage).toMatchObject({ etape: 'lance', indices: 0, chrono: 'demarrer' });
    expect(lancement?.passage).toEqual({ id: 'p1', statut: 'en_cours', resultat: {} });
  });

  it('l’indice se donne chrono arrêté et garde son instant dans le passage en cours', () => {
    const lance = etat({ scene: 'jeu', manche_id: 'pc', passage_id: 'p1', etape: 'lance' });
    const indice = etape(lance, { type: 'pointsCommuns', action: 'indice' }, 68_000);
    expect(indice?.pilotage).toMatchObject({ etape: 'lance', indices: 1, chrono: 'garder' });
    expect(indice?.passage).toEqual({
      id: 'p1',
      statut: 'en_cours',
      resultat: { indices_ms: [68_000] },
    });

    // L'indice donné, le chrono repart 5 s plus tard : 93 s au mur, 80 s de jeu.
    const apres = etat({
      scene: 'jeu',
      manche_id: 'pc',
      passage_id: 'p1',
      etape: 'lance',
      indices: 1,
    });
    apres.programme[0]!.passages[0]!.resultat = { indices_ms: [68_000] };
    expect(etape(apres, { type: 'pointsCommuns', action: 'indice' }, 80_000)).toBeNull();
    const trouve = etape(apres, { type: 'pointsCommuns', action: 'valider' }, 93_000);
    expect(trouve?.passage).toMatchObject({
      statut: 'termine',
      points: 15 * 2 + 35,
      resultat: { ecoule_ms: 80_000, indices_ms: [68_000] },
    });
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

  it('Surenchère à la voix : l’équipe du champion part avec le chrono (2026-11-27)', () => {
    const e = etat({ scene: 'jeu', manche_id: 'se', passage_id: 't1', etape: 'sujet' });
    const ecriture = etape(e, { type: 'adjuger', equipeChampion: 2 });
    expect(ecriture?.pilotage).toMatchObject({ etape: 'chrono', chrono: 'demarrer' });
    expect(ecriture?.passage).toEqual({
      id: 't1',
      statut: 'en_cours',
      resultat: { equipe_champion: 2 },
    });
    // Une équipe qui n'existe pas : la touche ne part pas.
    expect(etape(e, { type: 'adjuger', equipeChampion: 9 })).toBeNull();
  });

  it('Surenchère à la voix : l’équipe se corrige pendant le chrono, sans toucher au chrono', () => {
    const e = etat({ scene: 'jeu', manche_id: 'se', passage_id: 't1', etape: 'chrono' });
    const ecriture = etape(e, { type: 'champion', equipeChampion: 3 });
    expect(ecriture?.pilotage).toMatchObject({ etape: 'chrono', chrono: 'garder' });
    expect(ecriture?.passage).toEqual({
      id: 't1',
      statut: 'en_cours',
      resultat: { equipe_champion: 3 },
    });
    expect(ecriture?.scores).toEqual([]);
    // Hors du chrono, rien à corriger.
    const avant = etat({ scene: 'jeu', manche_id: 'se', passage_id: 't1', etape: 'sujet' });
    expect(etape(avant, { type: 'champion', equipeChampion: 3 })).toBeNull();
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

  describe('Surenchère en mode téléphones', () => {
    const avecCapitaines = (e: EtatSalle) => {
      e.equipes = e.equipes.map((q) => ({
        ...q,
        capitaine: q.joueurs > 0 ? `Cap ${q.nom}` : null,
      }));
      return e;
    };
    const enJeu = (pilotage: Partial<EtatSalle['pilotage']>) => {
      const e = avecCapitaines(etat({ scene: 'jeu', manche_id: 'se', ...pilotage }));
      const manche = e.programme[1]!;
      manche.statut = 'en_cours';
      manche.options = { ...manche.options, mode: 'telephones', chrono_telephones_s: 75 };
      return e;
    };

    it('se lance seulement quand chaque équipe qui a des joueurs a son capitaine', () => {
      const sans = etat({ scene: 'intro', manche_id: 'se' });
      expect(etape(sans, { type: 'commencer', mode: 'telephones' })).toBeNull();
      const ecriture = etape(avecCapitaines(etat({ scene: 'intro', manche_id: 'se' })), {
        type: 'commencer',
        mode: 'telephones',
      });
      expect(ecriture?.manche).toEqual({
        id: 'se',
        statut: 'en_cours',
        options: { mode: 'telephones' },
      });
      expect(ecriture?.pilotage).toMatchObject({ scene: 'jeu', etape: 'themes' });
    });

    it('à la voix par défaut, et une reprise garde le mode du lancement', () => {
      const voix = etape(etat({ scene: 'intro', manche_id: 'se' }), { type: 'commencer' });
      expect(voix?.manche?.options).toEqual({ mode: 'voix' });
      const reprise = enJeu({ scene: 'intro', etape: null });
      expect(etape(reprise, { type: 'commencer', mode: 'voix' })?.manche).toEqual({
        id: 'se',
        statut: 'en_cours',
      });
    });

    it('lance le chrono réglé pour les téléphones', () => {
      expect(
        etape(enJeu({ passage_id: 't1', etape: 'sujet' }), { type: 'adjuger' })?.pilotage,
      ).toMatchObject({ etape: 'chrono', chrono: 'demarrer', chrono_duree_s: 75 });
    });

    it('n’a pas d’équipe du champion : ni à l’adjudication, ni pendant le chrono', () => {
      const ecriture = etape(enJeu({ passage_id: 't1', etape: 'sujet' }), {
        type: 'adjuger',
        equipeChampion: 1,
      });
      expect(ecriture?.passage).toBeNull();
      expect(
        etape(enJeu({ passage_id: 't1', etape: 'chrono' }), {
          type: 'champion',
          equipeChampion: 1,
        }),
      ).toBeNull();
    });

    it('classe le thème d’après les mots non rayés : +100, +60, +30', () => {
      const e = enJeu({ passage_id: 't1', etape: 'chrono' });
      e.programme[1]!.passages[0]!.mots = {
        '1': { valides: 9, liste: null },
        '2': { valides: 9, liste: null },
        '3': { valides: 0, liste: null },
      };
      const ecriture = etape(e, { type: 'classer' });
      expect(ecriture?.pilotage).toMatchObject({ etape: 'podium', chrono: 'arreter' });
      expect(ecriture?.scores).toEqual([
        { equipe_id: 'e1', points: 100, motif: 'Podium 1 9', manche_id: 'se' },
        { equipe_id: 'e2', points: 100, motif: 'Podium 1 9', manche_id: 'se' },
      ]);
      expect(ecriture?.passage).toMatchObject({
        id: 't1',
        statut: 'termine',
        points: 200,
        resultat: { mode: 'telephones', rangs: { 1: 1, 2: 1 } },
      });
    });

    it('n’a ni verdict au téléphone, ni podium à la voix', () => {
      expect(
        etape(enJeu({ passage_id: 't1', etape: 'chrono' }), {
          type: 'verdict',
          tenu: true,
          equipeChampion: 1,
        }),
      ).toBeNull();
      const voix = etat({ scene: 'jeu', manche_id: 'se', passage_id: 't1', etape: 'chrono' });
      voix.programme[1]!.statut = 'en_cours';
      voix.programme[1]!.options = { mode: 'voix' };
      expect(etape(voix, { type: 'classer' })).toBeNull();
    });

    it('s’explique avec son propre script', () => {
      const e = etat({ scene: 'intro', manche_id: 'se' });
      expect(etape(e, { type: 'expliquer', mode: 'telephones' })?.pilotage).toMatchObject({
        etape: 'explication-telephones',
        chrono: 'demarrer',
        chrono_duree_s: 45,
      });
      // Le mode d'un autre jeu : le script de base.
      expect(etape(e, { type: 'expliquer', mode: 'jetons' })?.pilotage.etape).toBe('explication');
    });
  });

  it('terminer la manche revient au programme, pas au classement', () => {
    const ecriture = etape(etat({ scene: 'jeu', manche_id: 'pc', etape: 'trouve' }), {
      type: 'terminer',
    });
    expect(ecriture?.manche).toEqual({ id: 'pc', statut: 'terminee' });
    expect(ecriture?.pilotage).toMatchObject({ scene: 'programme', manche_id: null, etape: null });
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

  it('Quiz en mode jetons : refusé tant qu’une équipe qui a des joueurs n’a pas de capitaine', () => {
    const intro = etat({ scene: 'intro', manche_id: 'qz' });
    intro.equipes[0]!.capitaine = 'Alice';
    expect(etape(intro, { type: 'commencer', mode: 'jetons' })).toBeNull();
    // L'équipe 3 n'a personne : elle ne bloque pas.
    intro.equipes[1]!.capitaine = 'Chloé';
    const jetons = etape(intro, { type: 'commencer', mode: 'jetons' });
    // Toutes partent avec l'effectif de la plus grande (3).
    expect(jetons?.manche?.options).toEqual({ mode: 'jetons', jetons: 3 });
  });

  it('Quiz en mode jetons : les jetons restants valent des survivants, avec leur motif', () => {
    const e = etat({ scene: 'jeu', manche_id: 'qz', passage_id: 'q2', etape: 'survivants' });
    e.programme[2]!.options = { questions: 2, mode: 'jetons', jetons: 3 };
    expect(etape(e, { type: 'survivants', survivants: { 1: 2, 2: 0, 3: 0 } })?.scores).toEqual([
      { equipe_id: 'e1', points: 200, motif: 'Jetons 2', manche_id: 'qz' },
    ]);
  });

  it('Quiz : la question seule, puis A, B, C, D une à une, puis le chrono de 30 s', () => {
    const pret = etat({ scene: 'jeu', manche_id: 'qz', passage_id: 'q1', etape: 'pret' });
    expect(etape(pret, { type: 'quiz', action: 'afficher' })).toMatchObject({
      pilotage: { etape: 'question', chrono: 'arreter', indices: 0 },
      passage: { id: 'q1', statut: 'en_cours' },
    });
    const question = (indices: number, chrono_depart_ms: number | null = null) =>
      etat({
        scene: 'jeu',
        manche_id: 'qz',
        passage_id: 'q1',
        etape: 'question',
        indices,
        chrono_depart_ms,
      });
    expect(etape(question(0), { type: 'quiz', action: 'proposition' })?.pilotage).toMatchObject({
      etape: 'question',
      indices: 1,
      chrono: 'garder',
    });
    // Ni chrono ni révélation tant que les quatre réponses ne sont pas à l'écran.
    expect(etape(question(2), { type: 'quiz', action: 'lancer' })).toBeNull();
    expect(etape(question(4), { type: 'quiz', action: 'reveler' })).toBeNull();
    expect(etape(question(4), { type: 'quiz', action: 'lancer' })?.pilotage).toMatchObject({
      etape: 'question',
      indices: 4,
      chrono: 'demarrer',
      chrono_duree_s: 30,
    });
    expect(etape(question(4, 1000), { type: 'quiz', action: 'reveler' })).toMatchObject({
      pilotage: { etape: 'reponse', chrono: 'arreter' },
      passage: { id: 'q1', statut: 'termine' },
    });
  });

  it('Quiz : le chrono réglé sur la manche remplace les 30 s', () => {
    const e = etat({
      scene: 'jeu',
      manche_id: 'qz',
      passage_id: 'q1',
      etape: 'question',
      indices: 4,
    });
    e.programme[2]!.options = { questions: 2, chrono_s: 120 };
    expect(etape(e, { type: 'quiz', action: 'lancer' })?.pilotage).toMatchObject({
      chrono: 'demarrer',
      chrono_duree_s: 120,
    });
    e.programme[2]!.options = { questions: 2, chrono_s: 'n’importe quoi' };
    expect(etape(e, { type: 'quiz', action: 'lancer' })?.pilotage).toMatchObject({
      chrono_duree_s: 30,
    });
  });

  it('Quiz : question suivante, puis fin des questions après la dernière', () => {
    const e = etat({ scene: 'jeu', manche_id: 'qz', passage_id: 'q1', etape: 'reponse' });
    e.programme[2]!.passages[0]!.statut = 'termine';
    expect(etape(e, { type: 'quiz', action: 'suivante' })?.pilotage).toMatchObject({
      passage_id: 'q2',
      etape: 'pret',
    });
    // Terminer avant la dernière question : la q2 reste non jouée, on passe aux survivants.
    expect(etape(e, { type: 'quiz', action: 'fin' })).toMatchObject({
      pilotage: { etape: 'survivants', passage_id: 'q1' },
      passage: null,
    });

    const derniere = etat({ scene: 'jeu', manche_id: 'qz', passage_id: 'q2', etape: 'reponse' });
    for (const p of derniere.programme[2]!.passages) p.statut = 'termine';
    expect(etape(derniere, { type: 'quiz', action: 'fin' })?.pilotage.etape).toBe('survivants');
  });

  // 2026-11-14 : un quiz aux jetons s'est fini sans validation, « Scores » a montré zéro partout
  // et les points n'ont jamais été écrits. Quand l'app compte, la fin donne les points.
  describe('Quiz : la fin des questions quand l’app compte', () => {
    const finDuQuiz = (options: Record<string, unknown>, compte: Partial<MancheSalle>) => {
      const e = etat({ scene: 'jeu', manche_id: 'qz', passage_id: 'q2', etape: 'reponse' });
      const quiz = e.programme[2]!;
      quiz.statut = 'en_cours';
      quiz.options = { questions: 2, ...options };
      quiz.passages.forEach((p) => (p.statut = 'termine'));
      Object.assign(quiz, compte);
      return e;
    };

    it('aux jetons : les jetons restants donnent les points du même geste', () => {
      const e = finDuQuiz(
        { mode: 'jetons', jetons: 3 },
        { jetons: { '1': { depart: 3, restants: 2 }, '2': { depart: 3, restants: 0 } } },
      );
      const fin = etape(e, { type: 'quiz', action: 'fin' });
      expect(fin?.pilotage).toMatchObject({ scene: 'jeu', etape: 'resultat', passage_id: 'q2' });
      // L'équipe 3, sans ligne dans le compte, vaut zéro : aucune ligne de score pour elle.
      expect(fin?.manche).toEqual({
        id: 'qz',
        statut: 'en_cours',
        options: { fin: true, survivants: { 1: 2, 2: 0, 3: 0 } },
      });
      expect(fin?.scores).toEqual([
        { equipe_id: 'e1', points: 200, motif: 'Jetons 2', manche_id: 'qz' },
      ]);
      expect(survivantsComptes(e, e.programme[2]!)).toEqual({ 1: 2, 2: 0, 3: 0 });
    });

    it('au téléphone : les survivants comptés par la base, de même', () => {
      const e = finDuQuiz({ mode: 'telephone' }, { survivants: { '1': 1, '2': 3 } });
      const fin = etape(e, { type: 'quiz', action: 'fin' });
      expect(fin?.pilotage.etape).toBe('resultat');
      expect(fin?.scores).toEqual([
        { equipe_id: 'e1', points: 100, motif: 'Quiz 1', manche_id: 'qz' },
        { equipe_id: 'e2', points: 300, motif: 'Quiz 3', manche_id: 'qz' },
      ]);
    });

    it('à la croix, ou sans compte dans l’état : la saisie et sa validation restent', () => {
      const croix = etape(finDuQuiz({ mode: 'croix' }, {}), { type: 'quiz', action: 'fin' });
      expect(croix?.pilotage.etape).toBe('survivants');
      expect(croix?.manche).toEqual({ id: 'qz', statut: 'en_cours', options: { fin: true } });
      expect(croix?.scores).toEqual([]);
      // Jamais de zéros par défaut : un état sans le compte des jetons ne valide rien.
      const sansCompte = etape(finDuQuiz({ mode: 'jetons', jetons: 3 }, {}), {
        type: 'quiz',
        action: 'fin',
      });
      expect(sansCompte?.pilotage.etape).toBe('survivants');
      expect(sansCompte?.scores).toEqual([]);
    });

    it('tant que les survivants ne sont pas validés, on ne quitte pas le quiz', () => {
      const e = etat({ scene: 'jeu', manche_id: 'qz', passage_id: 'q2', etape: 'survivants' });
      e.programme[2]!.options = { questions: 2, mode: 'croix' };
      expect(quizEnSuspens(e)).toBe('valider');
      expect(etape(e, { type: 'scene', scene: 'scores' })).toBeNull();
      expect(etape(e, { type: 'intro', mancheId: 'pc' })).toBeNull();
      expect(etape(e, { type: 'devoilerEquipes' })).toBeNull();
      // Le bonus d'une soirée à thème (2026-11-28) attend lui aussi les points du quiz.
      expect(etape(e, { type: 'bonus', etape: 'karaoke' })).toBeNull();
      // La validation, elle, passe ; ensuite les scènes se rouvrent.
      expect(etape(e, { type: 'survivants', survivants: { 1: 1 } })?.pilotage.etape).toBe(
        'resultat',
      );
      const valide = etat({ scene: 'jeu', manche_id: 'qz', passage_id: 'q2', etape: 'resultat' });
      expect(quizEnSuspens(valide)).toBeNull();
      expect(etape(valide, { type: 'scene', scene: 'scores' })?.pilotage.scene).toBe('scores');
    });

    it('entre deux questions les scores se montrent ; après la dernière réponse, la fin d’abord', () => {
      const entre = etat({ scene: 'jeu', manche_id: 'qz', passage_id: 'q1', etape: 'reponse' });
      entre.programme[2]!.passages[0]!.statut = 'termine';
      expect(quizEnSuspens(entre)).toBeNull();
      expect(etape(entre, { type: 'scene', scene: 'scores' })?.pilotage.scene).toBe('scores');

      const derniere = etat({ scene: 'jeu', manche_id: 'qz', passage_id: 'q2', etape: 'reponse' });
      derniere.programme[2]!.passages.forEach((p) => (p.statut = 'termine'));
      expect(quizEnSuspens(derniere)).toBe('fin');
      expect(etape(derniere, { type: 'scene', scene: 'scores' })).toBeNull();
      expect(etape(derniere, { type: 'quiz', action: 'fin' })?.pilotage.etape).toBe('survivants');
      // Un autre jeu n'est pas concerné, même à une étape du même nom.
      const mime = etat({ scene: 'jeu', manche_id: 'mi', passage_id: 'm1', etape: 'reponse' });
      expect(quizEnSuspens(mime)).toBeNull();
    });
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

  // Audit du 2026-11-02 : la régie quitte un jeu par une scène libre (les scores) avant
  // « Terminer la manche », puis le présente à nouveau.
  describe('un jeu quitté en cours de route, puis présenté à nouveau', () => {
    const quizRepris = (options: Record<string, unknown>, joues: number) => {
      const e = etat({ scene: 'intro', manche_id: 'qz' }, undefined);
      e.evenement.statut = 'en_cours';
      const quiz = e.programme[2]!;
      quiz.statut = 'en_cours';
      quiz.options = { questions: 2, ...options };
      quiz.passages.slice(0, joues).forEach((p) => (p.statut = 'termine'));
      return e;
    };

    it('le quiz reprend à la question suivante, au mode fixé au lancement', () => {
      const e = quizRepris({ mode: 'telephone' }, 1);
      // Même si la touche demande un autre mode : il ne change pas en cours de quiz.
      const reprise = etape(e, { type: 'commencer', mode: 'croix' });
      expect(reprise?.pilotage).toMatchObject({ scene: 'jeu', passage_id: 'q2', etape: 'pret' });
      expect(reprise?.manche).toEqual({ id: 'qz', statut: 'en_cours' });
      expect(reprise?.ouvrirLaSoiree).toBe(false);
    });

    it('en mode jetons, ni nouveaux jetons de départ ni capitaine exigé', () => {
      const e = quizRepris({ mode: 'jetons', jetons: 2 }, 1);
      // Personne n'est capitaine : un lancement serait refusé, une reprise ne l'est pas.
      expect(e.equipes.every((x) => !x.capitaine)).toBe(true);
      const reprise = etape(e, { type: 'commencer', mode: 'jetons' });
      expect(reprise?.manche).toEqual({ id: 'qz', statut: 'en_cours' });
    });

    it('toutes les questions jouées sans validation : retour aux survivants', () => {
      const reprise = etape(quizRepris({ mode: 'croix' }, 2), { type: 'commencer' });
      expect(reprise?.pilotage).toMatchObject({ passage_id: 'q2', etape: 'survivants' });
      expect(reprise?.passage).toBeNull();
    });

    it('arrêté avant la dernière question puis quitté : retour aux survivants', () => {
      const reponse = etat({ scene: 'jeu', manche_id: 'qz', passage_id: 'q1', etape: 'reponse' });
      reponse.programme[2]!.passages[0]!.statut = 'termine';
      // « Terminer le quiz ici » se garde dans la manche…
      expect(etape(reponse, { type: 'quiz', action: 'fin' })?.manche).toEqual({
        id: 'qz',
        statut: 'en_cours',
        options: { fin: true },
      });
      // … et la reprise y revient, sans ouvrir la question 2.
      const reprise = etape(quizRepris({ mode: 'telephone', fin: true }, 1), {
        type: 'commencer',
      });
      expect(reprise?.pilotage).toMatchObject({ passage_id: 'q1', etape: 'survivants' });
    });

    it('un quiz déjà validé ne se rejoue pas : il ne reste qu’à le terminer', () => {
      // Arrêté après la première question : la seconde reste, mais les points sont donnés.
      const e = quizRepris({ mode: 'croix', survivants: { 1: 2 } }, 1);
      expect(mancheATerminer(e.programme[2]!)).toBe(true);
      expect(etape(e, { type: 'commencer' })).toBeNull();
      expect(etape(e, { type: 'terminer' })?.manche).toEqual({ id: 'qz', statut: 'terminee' });
    });

    it('Points communs joué en entier : terminer, pas recommencer', () => {
      const e = etat({ scene: 'intro', manche_id: 'pc' });
      const pc = e.programme[0]!;
      pc.statut = 'en_cours';
      pc.passages.forEach((p) => (p.statut = 'termine'));
      expect(mancheATerminer(pc)).toBe(true);
      expect(etape(e, { type: 'commencer' })).toBeNull();
      expect(etape(e, { type: 'terminer' })?.manche).toEqual({ id: 'pc', statut: 'terminee' });
      // Un passage restant : la manche se reprend, elle n'est pas à terminer.
      pc.passages[1]!.statut = 'a_venir';
      expect(mancheATerminer(pc)).toBe(false);
      expect(etape(e, { type: 'commencer' })?.pilotage).toMatchObject({ passage_id: 'p2' });
    });

    it('la Surenchère n’est jamais « à terminer » : sa grille des thèmes le propose', () => {
      const e = etat({ scene: 'intro', manche_id: 'se' });
      const se = e.programme[1]!;
      se.statut = 'en_cours';
      se.passages.forEach((p) => (p.statut = 'termine'));
      expect(mancheATerminer(se)).toBe(false);
      expect(etape(e, { type: 'commencer' })?.pilotage).toMatchObject({ etape: 'themes' });
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

  describe('Ciné-mime', () => {
    const UUID = '0b8f6a52-3c1e-4f7a-9d2b-5e6f7a8b9c0d';
    const cine = (
      extraitDuPassage: PassageSalle['extrait'] = { chemin: `${UUID}.mp4`, duree_ms: 32_400 },
    ) =>
      ({
        id: 'ci',
        jeu: 'cinemime',
        ordre: 6,
        statut: 'en_cours',
        options: { chrono_s: 120 },
        passages: [
          passage('c1', 1, { equipe_id: 'e1', statut: 'en_cours', extrait: extraitDuPassage }),
          passage('c2', 2, {
            equipe_id: 'e2',
            extrait: { chemin: `${UUID}.mp4`, duree_ms: 10_000 },
          }),
        ],
      }) satisfies MancheSalle;
    const en = (etapeCine: string, manche = cine()) =>
      etat({ scene: 'jeu', manche_id: 'ci', passage_id: 'c1', etape: etapeCine }, [manche]);

    it('commence au premier passage, comme le Mime', () => {
      const intro = etat({ scene: 'intro', manche_id: 'ci' }, [{ ...cine(), statut: 'a_venir' }]);
      expect(etape(intro, { type: 'commencer' })).toMatchObject({
        pilotage: { passage_id: 'c1', etape: 'pret' },
        passage: { id: 'c1', statut: 'en_cours' },
      });
    });

    it('montre la scène pour sa durée, puis lance la chaîne au chrono de la préparation', () => {
      expect(etape(en('pret'), { type: 'cinemime', action: 'montrer' })?.pilotage).toMatchObject({
        etape: 'extrait',
        chrono: 'demarrer',
        chrono_duree_s: 33,
      });
      expect(etape(en('extrait'), { type: 'cinemime', action: 'lancer' })?.pilotage).toMatchObject({
        etape: 'lance',
        chrono: 'demarrer',
        chrono_duree_s: 120,
      });
      expect(etape(en('pret'), { type: 'cinemime', action: 'lancer' })).toBeNull();
    });

    it('trouvé vaut +100 à l’équipe du passage ; la scène rejoue ensuite, sans rien écrire', () => {
      const trouve = etape(en('lance'), { type: 'cinemime', action: 'trouve' }, 61_000);
      expect(trouve?.passage).toMatchObject({
        id: 'c1',
        statut: 'termine',
        points: 100,
        resultat: { trouve: true, ecoule_ms: 61_000 },
      });
      expect(trouve?.scores).toEqual([
        { equipe_id: 'e1', points: 100, motif: 'Ciné Navy', manche_id: 'ci' },
      ]);
      expect(etape(en('lance'), { type: 'cinemime', action: 'rate' })?.scores).toEqual([]);
      const revue = etape(en('trouve'), { type: 'cinemime', action: 'rejouer' });
      expect(revue?.pilotage).toMatchObject({
        etape: 'revue',
        chrono: 'demarrer',
        chrono_duree_s: 33,
      });
      expect(revue?.passage).toBeNull();
      expect(revue?.scores).toEqual([]);
    });

    it('passe à l’équipe suivante après le verdict ou la revue', () => {
      for (const fin of ['rate', 'revue']) {
        const e = en(fin);
        e.programme[0]!.passages[0]!.statut = 'termine';
        expect(etape(e, { type: 'suivant' })).toMatchObject({
          pilotage: { passage_id: 'c2', etape: 'pret' },
        });
      }
    });

    it('sans vidéo, la scène ne se montre pas, mais le verdict reste possible', () => {
      const sans = cine(null);
      expect(etape(en('pret', sans), { type: 'cinemime', action: 'montrer' })).toBeNull();
      expect(etape(en('lance', sans), { type: 'cinemime', action: 'rate' })?.passage).toMatchObject(
        {
          statut: 'termine',
          points: 0,
        },
      );
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
      chrono_duree_s: 45,
    });
    expect(ecriture?.manche).toBeNull();
    expect(ecriture?.ouvrirLaSoiree).toBe(false);
  });

  it('rejouer repart de zéro', () => {
    const e = etat({ scene: 'intro', manche_id: 'pc', etape: 'explication' });
    expect(etape(e, { type: 'expliquer' })?.pilotage.chrono).toBe('demarrer');
  });

  it('le Quiz s’explique selon le mode demandé, les autres jeux l’ignorent', () => {
    const intro = etat({ scene: 'intro', manche_id: 'qz' });
    expect(etape(intro, { type: 'expliquer', mode: 'telephone' })?.pilotage.etape).toBe(
      'explication-telephone',
    );
    const jetons = etape(intro, { type: 'expliquer', mode: 'jetons' });
    expect(jetons?.pilotage).toMatchObject({
      etape: 'explication-jetons',
      chrono: 'demarrer',
      chrono_duree_s: 44,
    });
    const mime = etape(etat({ scene: 'intro', manche_id: 'mi' }), {
      type: 'expliquer',
      mode: 'jetons',
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
    expect(scriptEnCours('qcm2', 'intro', 'explication-jetons')).toBe('qcm2-jetons');
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

describe('un passage resté sans équipe (panne du 2026-10-31)', () => {
  /** Points communs, passage 1 ouvert alors que son équipe a été supprimée. */
  function orphelin(): EtatSalle {
    const e = etat({ scene: 'jeu', manche_id: 'pc', passage_id: 'p1', etape: 'pret' });
    const pc = e.programme[0]!;
    pc.statut = 'en_cours';
    pc.passages[0] = { ...pc.passages[0]!, equipe_id: null, statut: 'en_cours' };
    return e;
  }

  it('« Passer » le clôt sans points et revient à l’intro, d’où l’on reprend', () => {
    const ecriture = etape(orphelin(), { type: 'passer' });
    expect(ecriture?.passage).toEqual({
      id: 'p1',
      statut: 'termine',
      resultat: { passe: true },
      points: 0,
    });
    expect(ecriture?.scores).toEqual([]);
    expect(ecriture?.manche).toBeNull();
    expect(ecriture?.pilotage).toMatchObject({ scene: 'intro', manche_id: 'pc', passage_id: null });
  });

  it('dernier passage : la manche se termine', () => {
    const e = orphelin();
    e.programme[0]!.passages[1]!.statut = 'termine';
    const ecriture = etape(e, { type: 'passer' });
    expect(ecriture?.manche).toEqual({ id: 'pc', statut: 'terminee' });
    expect(ecriture?.pilotage.scene).toBe('programme');
  });

  it('refusé quand le passage a son équipe', () => {
    const e = etat({ scene: 'jeu', manche_id: 'pc', passage_id: 'p1', etape: 'pret' });
    expect(etape(e, { type: 'passer' })).toBeNull();
  });

  it('le tirage de l’ordre range le passage sans équipe à la fin', () => {
    const e = etat({ scene: 'intro', manche_id: 'pc' });
    e.programme[0]!.passages[0] = { ...e.programme[0]!.passages[0]!, equipe_id: null };
    expect(etape(e, { type: 'tirerOrdre', passages: ['p2', 'p1'] })).not.toBeNull();
  });
});

describe('le dévoilement des équipes (2026-11-04)', () => {
  it('passe l’écran sur les équipes, à l’étape « formation », sur 5 s', () => {
    const ecriture = etape(etat({ scene: 'accueil' }), { type: 'devoilerEquipes' });
    expect(ecriture?.pilotage).toMatchObject({
      scene: 'equipes',
      etape: 'formation',
      chrono: 'demarrer',
      chrono_duree_s: 5,
    });
    expect([ecriture?.passage, ecriture?.manche, ecriture?.ordre]).toEqual([null, null, null]);
    expect(ecriture?.scores).toEqual([]);
  });

  it('se rejoue, même depuis la scène Équipes', () => {
    const deja = etat({ scene: 'equipes', etape: 'formation', chrono_depart_ms: 1000 });
    expect(etape(deja, { type: 'devoilerEquipes' })?.pilotage.chrono).toBe('demarrer');
  });

  it('refuse tant que les équipes ne sont pas formées', () => {
    const sansEquipes = etat({ scene: 'accueil' });
    sansEquipes.equipes = [];
    expect(etape(sansEquipes, { type: 'devoilerEquipes' })).toBeNull();
  });
});

// Blind test (2026-11-15) : la régie lance, juge, relance ; le buzz de secours passe par elle.
describe('le blind test, touche par touche', () => {
  const blind = (passages = [passage('b1', 1), passage('b2', 2)]): MancheSalle => ({
    id: 'bt',
    jeu: 'blind',
    ordre: 1,
    statut: 'en_cours',
    options: {
      extrait_s: 30,
      titres: [
        { musique: 'm-1', debut_s: 0 },
        { musique: 'm-2', debut_s: 12 },
      ],
    },
    passages,
  });
  const enJeu = (etape: string, resultat: Record<string, unknown> = {}, passageId = 'b1') => {
    const e = etat(
      {
        scene: 'jeu',
        manche_id: 'bt',
        passage_id: passageId,
        etape,
        chrono_depart_ms: 1000,
        chrono_duree_s: 30,
      },
      [blind([passage('b1', 1, { statut: 'en_cours', resultat }), passage('b2', 2)])],
    );
    e.equipes[0]!.capitaine = 'Alice';
    e.equipes[1]!.capitaine = 'Bruno';
    return e;
  };

  it('se lance seulement quand chaque équipe qui a des joueurs a son capitaine', () => {
    const intro = etat({ scene: 'intro', manche_id: 'bt' }, [{ ...blind(), statut: 'a_venir' }]);
    expect(etape(intro, { type: 'commencer' })).toBeNull();
    intro.equipes[0]!.capitaine = 'Alice';
    intro.equipes[1]!.capitaine = 'Bruno';
    expect(etape(intro, { type: 'commencer' })).toMatchObject({
      pilotage: { scene: 'jeu', passage_id: 'b1', etape: 'pret' },
      passage: { id: 'b1', statut: 'en_cours' },
      manche: { id: 'bt', statut: 'en_cours' },
    });
  });

  it('lance la musique pour la durée de l’extrait', () => {
    expect(etape(enJeu('pret'), { type: 'blind', action: { type: 'lancer' } })).toMatchObject({
      pilotage: { etape: 'ecoute', chrono: 'demarrer', chrono_duree_s: 30 },
      passage: { id: 'b1', statut: 'en_cours', resultat: { ecoute_ms: 0, bloquees: [] } },
    });
  });

  it('buzz de secours, puis bonne réponse : +100 à l’équipe et le karaoké', () => {
    const buzz = etape(
      enJeu('ecoute'),
      { type: 'blind', action: { type: 'buzz', equipe: 2 } },
      5000,
    );
    expect(buzz).toMatchObject({
      pilotage: { etape: 'buzz', chrono: 'demarrer', chrono_duree_s: 7 },
      passage: { resultat: { ecoute_ms: 5000, buzz: 2 } },
    });
    // L'équipe 3 n'a personne : elle ne buzze pas.
    expect(
      etape(enJeu('ecoute'), { type: 'blind', action: { type: 'buzz', equipe: 3 } }),
    ).toBeNull();

    const bonne = etape(enJeu('buzz', { ecoute_ms: 5000, buzz: 2 }), {
      type: 'blind',
      action: { type: 'bonne' },
    });
    expect(bonne).toMatchObject({
      pilotage: { etape: 'karaoke', chrono: 'demarrer', chrono_duree_s: KARAOKE_MAX_S },
      passage: { id: 'b1', statut: 'termine', points: 100, resultat: { trouve_par: 2 } },
    });
    expect(bonne?.scores).toEqual([
      { equipe_id: 'e2', points: 100, motif: 'Blind 1', manche_id: 'bt' },
    ]);
  });

  it('couper le karaoké révèle le titre sans toucher aux points', () => {
    const karaoke = enJeu('karaoke', { ecoute_ms: 5000, trouve_par: 2 });
    karaoke.programme[0]!.passages[0]!.statut = 'termine';
    // Pendant le karaoké, on ne saute pas au titre suivant sans le couper.
    expect(etape(karaoke, { type: 'suivant' })).toBeNull();
    const coupe = etape(karaoke, { type: 'blind', action: { type: 'couper' } });
    expect(coupe).toMatchObject({
      pilotage: { etape: 'revele', chrono: 'arreter' },
      passage: { id: 'b1', statut: 'termine', resultat: { trouve_par: 2 } },
    });
    expect(coupe?.passage).not.toHaveProperty('points');
    expect(coupe?.scores).toEqual([]);
  });

  it('mauvaise réponse : l’équipe est bloquée, la musique reprend quand la régie la relance', () => {
    const pause = etape(enJeu('buzz', { ecoute_ms: 5000, buzz: 2 }), {
      type: 'blind',
      action: { type: 'mauvaise' },
    });
    expect(pause).toMatchObject({
      pilotage: { etape: 'pause', chrono: 'arreter' },
      passage: { statut: 'en_cours', resultat: { bloquees: [2], buzz: null } },
    });
    expect(pause?.scores).toEqual([]);
    const relance = etape(enJeu('pause', { ecoute_ms: 5000, bloquees: [2] }), {
      type: 'blind',
      action: { type: 'relancer' },
    });
    expect(relance?.pilotage).toMatchObject({ etape: 'ecoute', chrono_duree_s: 25 });
  });

  it('une réponse à juger retient la régie ; révélé, on passe au titre suivant', () => {
    const buzz = enJeu('buzz', { buzz: 1 });
    expect(quizEnSuspens(buzz)).toBe('juger');
    expect(etape(buzz, { type: 'scene', scene: 'scores' })).toBeNull();
    expect(etape(buzz, { type: 'blind', action: { type: 'reveler' } })).toBeNull();

    const revele = enJeu('revele', { trouve_par: 1 });
    // Révélé, le titre est terminé (`statut: 'termine'` écrit avec la révélation).
    revele.programme[0]!.passages[0]!.statut = 'termine';
    expect(quizEnSuspens(revele)).toBeNull();
    expect(etape(revele, { type: 'suivant' })).toMatchObject({
      pilotage: { passage_id: 'b2', etape: 'pret', chrono: 'arreter' },
      passage: { id: 'b2', statut: 'en_cours' },
    });
  });
});

// Portrait mystère (2026-11-18) : la grille d'abord, un tour par indice, les points à la fin de
// chaque tour, la carte noire montrée après la dernière cible.
describe('le Portrait mystère, touche par touche', () => {
  const ids = Array.from({ length: 25 }, (_, i) => `c${i}`);
  const portrait = (
    passages = [passage('r1', 1, { contenu_id: 'c7' }), passage('r2', 2, { contenu_id: 'c3' })],
    noire: number | null = 13,
  ): MancheSalle => ({
    id: 'pm',
    jeu: 'portrait',
    ordre: 1,
    statut: 'en_cours',
    options: { mode: 'voix', chrono_s: 25 },
    grille: { cartes: [], ids, noire, retournees: {} },
    passages,
  });
  const enJeu = (
    etape: string,
    tour: number,
    extra: Partial<PassageSalle> = {},
    autres: PassageSalle[] = [passage('r2', 2, { contenu_id: 'c3' })],
  ) =>
    etat({ scene: 'jeu', manche_id: 'pm', passage_id: 'r1', etape, indices: tour }, [
      portrait([passage('r1', 1, { contenu_id: 'c7', statut: 'en_cours', ...extra }), ...autres]),
    ]);

  it('se lance seulement grille prête ; au téléphone, un capitaine par équipe', () => {
    const intro = (m: MancheSalle) =>
      etat({ scene: 'intro', manche_id: 'pm' }, [{ ...m, statut: 'a_venir', options: {} }]);
    expect(etape(intro(portrait(undefined, null)), { type: 'commencer', mode: 'voix' })).toBeNull();
    expect(etape(intro(portrait()), { type: 'commencer', mode: 'voix' })).toMatchObject({
      pilotage: { scene: 'jeu', passage_id: 'r1', etape: 'pret' },
      manche: { id: 'pm', statut: 'en_cours', options: { mode: 'voix' } },
    });
    const telephones = intro(portrait());
    expect(etape(telephones, { type: 'commencer', mode: 'telephones' })).toBeNull();
    telephones.equipes[0]!.capitaine = 'Alice';
    telephones.equipes[1]!.capitaine = 'Bruno';
    expect(etape(telephones, { type: 'commencer', mode: 'telephones' })).toMatchObject({
      manche: { options: { mode: 'telephones' } },
    });
  });

  it('un indice ouvre un tour de vote, au chrono de la préparation', () => {
    expect(etape(enJeu('pret', 0), { type: 'portrait', action: { type: 'indice' } })).toMatchObject(
      {
        pilotage: { etape: 'vote', indices: 1, chrono: 'demarrer', chrono_duree_s: 25 },
        passage: { id: 'r1', statut: 'en_cours' },
      },
    );
  });

  it('fin du tour : points à qui a trouvé, la noire élimine ; un tour ouvert ne se quitte pas', () => {
    const vote = enJeu('vote', 1, { votes: { 1: 7, 2: 13 } });
    expect(quizEnSuspens(vote)).toBe('tour');
    expect(etape(vote, { type: 'scene', scene: 'scores' })).toBeNull();
    const fin = etape(vote, { type: 'portrait', action: { type: 'cloturer' } });
    expect(fin).toMatchObject({
      pilotage: { etape: 'tour', indices: 1, chrono: 'arreter' },
      passage: {
        statut: 'en_cours',
        resultat: { trouvees: { 1: 1 }, eliminees: [2], tours: 1 },
      },
    });
    expect(fin?.scores).toEqual([
      { equipe_id: 'e1', points: 100, motif: 'Portrait 1 (1)', manche_id: 'pm' },
    ]);
  });

  it('révéler termine la cible avec son total ; la suivante attend « Cible suivante »', () => {
    const revele = etape(
      enJeu('tour', 1, { resultat: { trouvees: { 1: 1 }, eliminees: [2], tours: 1 } }),
      { type: 'portrait', action: { type: 'reveler' } },
    );
    expect(revele).toMatchObject({
      pilotage: { etape: 'revele' },
      passage: { id: 'r1', statut: 'termine', points: 100 },
    });
    expect(etape(enJeu('revele', 1, { statut: 'termine' }), { type: 'suivant' })).toMatchObject({
      pilotage: { passage_id: 'r2', etape: 'pret', indices: 0 },
    });
  });

  it('après la dernière cible, la carte noire se montre sans toucher à la cible', () => {
    const derniere = enJeu('revele', 2, { statut: 'termine' }, []);
    const noire = etape(derniere, { type: 'portrait', action: { type: 'noire' } });
    expect(noire).toMatchObject({ pilotage: { etape: 'noire' }, passage: null });
    // Pas avant : il reste une cible.
    expect(
      etape(enJeu('revele', 2, { statut: 'termine' }), {
        type: 'portrait',
        action: { type: 'noire' },
      }),
    ).toBeNull();
  });
});

describe('le bonus d’une soirée à thème (2026-11-28)', () => {
  it('lance la chanson à une heure posée par la base, puis la coupe', () => {
    const accueil = etat({ scene: 'accueil' });
    const lance = etape(accueil, { type: 'bonus', etape: 'karaoke' });
    expect(lance?.pilotage).toMatchObject({
      scene: 'bonus',
      etape: 'karaoke',
      chrono: 'demarrer',
    });
    expect(lance?.pilotage.chrono_duree_s).toBeGreaterThanOrEqual(300);
    // Couper : seulement une chanson qui joue ; le départ reste (l'écran s'efface en fondu).
    const enCours = etat({ scene: 'bonus', etape: 'karaoke' });
    expect(etape(enCours, { type: 'bonus', etape: 'couper' })?.pilotage).toMatchObject({
      scene: 'bonus',
      etape: 'couper',
      chrono: 'garder',
    });
    expect(etape(accueil, { type: 'bonus', etape: 'couper' })).toBeNull();
    expect(
      etape(etat({ scene: 'bonus', etape: 'couper' }), { type: 'bonus', etape: 'couper' }),
    ).toBeNull();
  });
});
