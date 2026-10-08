import { describe, expect, it } from 'vitest';
import {
  actionsPointsCommuns,
  appliquerPointsCommuns,
  ETAT_INITIAL_POINTS_COMMUNS,
  type EtatPointsCommuns,
} from './points-communs';
import {
  actionsSurenchere,
  appliquerSurenchere,
  ETAT_INITIAL_SURENCHERE,
  type EtatSurenchere,
} from './surenchere';
import { mancheJouee, mancheSuivante, passageSuivant, type MancheDuProgramme } from './programme';
import { actionsQuiz, appliquerQuiz, CHRONO_QUESTION_S, MODES_QUIZ, type EtatQuiz } from './quiz';
import { actionsMime, appliquerMime, CHRONO_MIME_S } from './mime';
import { actionsPhoto, appliquerPhoto } from './photo';

const s = (secondes: number) => secondes * 1000;

describe('pilotage de Points communs', () => {
  it('suit les cinq touches de la régie, dans l’ordre', () => {
    let etat: EtatPointsCommuns = ETAT_INITIAL_POINTS_COMMUNS;
    expect(actionsPointsCommuns(etat, 0)).toEqual(['afficher']);
    etat = appliquerPointsCommuns(etat, 'afficher', 0).etat;
    expect(etat.etape).toBe('consigne');
    expect(actionsPointsCommuns(etat, 0)).toEqual(['masquer']);
    etat = appliquerPointsCommuns(etat, 'masquer', 0).etat;
    const lancement = appliquerPointsCommuns(etat, 'lancer', 0);
    expect(lancement.chrono).toEqual({ demarrer: 130 });
    expect(lancement.etat.etape).toBe('lance');
  });

  it('refuse une touche hors de son étape', () => {
    expect(() => appliquerPointsCommuns(ETAT_INITIAL_POINTS_COMMUNS, 'lancer', 0)).toThrow(
      /impossible/,
    );
  });

  it('ne donne un indice que chrono arrêté, une fois par arrêt', () => {
    const lance: EtatPointsCommuns = { etape: 'lance', indices: 0, indicesMs: [] };
    expect(actionsPointsCommuns(lance, s(30))).toEqual(['valider', 'echec']);
    expect(actionsPointsCommuns(lance, s(60))).toEqual(['indice', 'valider', 'echec']);
    expect(actionsPointsCommuns(lance, s(72))).toContain('indice');

    const unIndice = appliquerPointsCommuns(lance, 'indice', s(72));
    expect(unIndice.chrono).toBe('garder');
    expect(unIndice.etat).toMatchObject({ indices: 1, indicesMs: [72_000] });
    // Le temps de lire l'indice, puis le palier 2 : plus d'indice avant le second arrêt.
    expect(actionsPointsCommuns(unIndice.etat, s(74))).not.toContain('indice');
    expect(actionsPointsCommuns(unIndice.etat, s(100))).not.toContain('indice');
    expect(() => appliquerPointsCommuns(unIndice.etat, 'indice', s(100))).toThrow(/impossible/);

    // Reprise à 77 s, second arrêt 35 s de jeu plus tard.
    expect(actionsPointsCommuns(unIndice.etat, s(112))).toContain('indice');
    const deux = appliquerPointsCommuns(unIndice.etat, 'indice', s(115)).etat;
    expect(deux).toMatchObject({ indices: 2, indicesMs: [72_000, 115_000] });
    expect(actionsPointsCommuns(deux, s(140))).toEqual(['valider', 'echec']);
  });

  it('valider compte le barème au temps de jeu, arrêts déduits, et arrête le chrono', () => {
    // Indice à 72 s, reprise à 77 s : 97 s après le lancement, 80 s de jeu.
    const t = appliquerPointsCommuns(
      { etape: 'lance', indices: 1, indicesMs: [72_000] },
      'valider',
      s(97),
    );
    expect(t.etat.etape).toBe('trouve');
    expect(t.chrono).toBe('arreter');
    expect(t.points).toBe(15 * 2 + 35);
    expect(t.resultat).toEqual({
      ecoule_ms: 80_000,
      palier: 2,
      indices: 1,
      indices_ms: [72_000],
      trouve: true,
    });
  });

  it('trouvé pendant un arrêt : le palier qui s’ouvre compte en entier', () => {
    const lance: EtatPointsCommuns = { etape: 'lance', indices: 0, indicesMs: [] };
    const premier = appliquerPointsCommuns(lance, 'valider', s(90));
    expect(premier.points).toBe(35 * 2 + 35);
    expect(premier.resultat).toMatchObject({ ecoule_ms: 60_000, palier: 2 });

    const second = appliquerPointsCommuns(
      { etape: 'lance', indices: 1, indicesMs: [60_000] },
      'valider',
      s(150),
    );
    expect(second.points).toBe(35);
    expect(second.resultat).toMatchObject({ ecoule_ms: 95_000, palier: 3 });
  });

  it('l’échec vaut 0', () => {
    const t = appliquerPointsCommuns(
      { etape: 'lance', indices: 2, indicesMs: [60_000, 100_000] },
      'echec',
      s(200),
    );
    expect(t.etat.etape).toBe('echec');
    expect(t.points).toBe(0);
    expect(actionsPointsCommuns(t.etat, s(200))).toEqual([]);
  });
});

describe('pilotage de la Surenchère', () => {
  const equipesAvecJoueurs = [1, 2, 3];

  it('dévoile, adjuge, tranche puis revient aux thèmes', () => {
    let etat: EtatSurenchere = ETAT_INITIAL_SURENCHERE;
    expect(actionsSurenchere(etat)).toEqual(['devoiler']);
    etat = appliquerSurenchere(etat, { type: 'devoiler', passageId: 'cuisine' }).etat;
    expect(etat).toEqual({ etape: 'sujet', passageId: 'cuisine' });

    const adjuge = appliquerSurenchere(etat, { type: 'adjuger', chronoS: 60 });
    expect(adjuge.chrono).toEqual({ demarrer: 60 });

    const verdict = appliquerSurenchere(adjuge.etat, {
      type: 'verdict',
      tenu: false,
      equipeChampion: 2,
      equipesAvecJoueurs,
    });
    expect(verdict.etat.etape).toBe('rate');
    expect(verdict.points).toEqual({ 1: 20, 3: 20 });
    expect(verdict.chrono).toBe('arreter');

    expect(appliquerSurenchere(verdict.etat, { type: 'retour' }).etat).toEqual(
      ETAT_INITIAL_SURENCHERE,
    );
  });

  it('tenu donne 100 à l’équipe du champion', () => {
    const t = appliquerSurenchere(
      { etape: 'chrono', passageId: 'voyages' },
      { type: 'verdict', tenu: true, equipeChampion: 3, equipesAvecJoueurs },
    );
    expect(t.points).toEqual({ 3: 100 });
    expect(t.resultat).toEqual({ tenu: true, equipe_champion: 3 });
  });

  it('refuse de trancher avant d’avoir adjugé, et de rejouer un thème', () => {
    expect(() =>
      appliquerSurenchere(
        { etape: 'sujet', passageId: 'x' },
        { type: 'verdict', tenu: true, equipeChampion: 1, equipesAvecJoueurs },
      ),
    ).toThrow(/impossible/);
    expect(() =>
      appliquerSurenchere(ETAT_INITIAL_SURENCHERE, { type: 'devoiler', passageId: 'x' }, ['x']),
    ).toThrow(/déjà/);
  });
});

describe('progression du programme', () => {
  const programme: MancheDuProgramme[] = [
    {
      id: 'b',
      jeu: 'enchere2',
      ordre: 2,
      statut: 'a_venir',
      passages: [
        { id: 'b2', ordre: 2, statut: 'a_venir' },
        { id: 'b1', ordre: 1, statut: 'termine' },
      ],
    },
    { id: 'a', jeu: 'list2', ordre: 1, statut: 'terminee', passages: [] },
    { id: 'c', jeu: 'list2', ordre: 3, statut: 'annulee', passages: [] },
  ];

  it('prend la première manche à venir, dans l’ordre', () => {
    expect(mancheSuivante(programme)?.id).toBe('b');
    expect(mancheSuivante([programme[1]!, programme[2]!])).toBeNull();
  });

  it('prend le premier passage pas encore joué', () => {
    expect(passageSuivant(programme[0]!)?.id).toBe('b2');
    expect(mancheJouee(programme[0]!)).toBe(false);
  });
});

describe('pilotage du Quiz', () => {
  const q = (etape: EtatQuiz['etape'], resteDesQuestions = true): EtatQuiz => ({
    etape,
    resteDesQuestions,
  });

  it('enchaîne question, révélation et question suivante', () => {
    expect(actionsQuiz(q('pret'))).toEqual(['afficher']);
    const affichee = appliquerQuiz(q('pret'), { type: 'afficher' });
    expect(affichee).toEqual({ etape: 'question', chrono: { demarrer: CHRONO_QUESTION_S } });
    expect(CHRONO_QUESTION_S).toBe(30);
    expect(appliquerQuiz(q('question'), { type: 'reveler' })).toEqual({
      etape: 'reponse',
      chrono: 'arreter',
    });
    expect(actionsQuiz(q('reponse'))).toEqual(['suivante']);
    expect(appliquerQuiz(q('reponse'), { type: 'suivante' }).etape).toBe('pret');
  });

  it('passe aux survivants après la dernière question', () => {
    expect(actionsQuiz(q('reponse', false))).toEqual(['fin']);
    expect(appliquerQuiz(q('reponse', false), { type: 'fin' }).etape).toBe('survivants');
    expect(() => appliquerQuiz(q('reponse', false), { type: 'suivante' })).toThrow(/impossible/);
  });

  it('une question annulée mène à la suivante, ou aux survivants si c’était la dernière', () => {
    expect(appliquerQuiz(q('question'), { type: 'annuler' })).toEqual({
      etape: 'pret',
      chrono: 'arreter',
    });
    expect(appliquerQuiz(q('question', false), { type: 'annuler' }).etape).toBe('survivants');
  });

  it('ne compte les points qu’une fois, à la validation des survivants', () => {
    for (const etape of ['pret', 'question', 'reponse'] as const) {
      expect(() =>
        appliquerQuiz(q(etape, false), { type: 'valider', survivants: { 1: 3 } }),
      ).toThrow(/impossible/);
    }
    const t = appliquerQuiz(q('survivants'), { type: 'valider', survivants: { 1: 3, 2: 0 } });
    expect(t.etape).toBe('resultat');
    expect(t.points).toEqual({ 1: 300, 2: 0 });
    expect(t.resultat).toEqual({ survivants: { 1: 3, 2: 0 } });
    expect(actionsQuiz(q('resultat'))).toEqual([]);
  });

  // Critère de fin du lot 7, côté moteur : le mode ne participe pas au calcul.
  it('les deux modes donnent le même score pour les mêmes survivants', () => {
    const survivants = { 1: 4, 2: 0, 3: 7, 4: 1 };
    const joue = () => {
      let etat: EtatQuiz = q('pret');
      for (let i = 0; i < 4; i++) {
        etat = { ...etat, resteDesQuestions: i < 3 };
        for (const type of ['afficher', 'reveler'] as const) {
          etat = { ...etat, etape: appliquerQuiz(etat, { type }).etape };
        }
        const suite = etat.resteDesQuestions ? 'suivante' : 'fin';
        etat = { ...etat, etape: appliquerQuiz(etat, { type: suite }).etape };
      }
      return appliquerQuiz(etat, { type: 'valider', survivants }).points;
    };
    const scores = MODES_QUIZ.map(joue);
    expect(scores[0]).toEqual({ 1: 400, 2: 0, 3: 700, 4: 100 });
    expect(scores[1]).toEqual(scores[0]);
  });

  it('refuse des survivants qui ne sont pas des entiers positifs', () => {
    expect(() =>
      appliquerQuiz(q('survivants'), { type: 'valider', survivants: { 1: -1 } }),
    ).toThrow(RangeError);
  });
});

describe('pilotage du Mime', () => {
  it('montre le mot à la régie, lance la chaîne, puis tranche', () => {
    expect(actionsMime('pret')).toEqual(['montrer']);
    expect(appliquerMime('pret', 'montrer', 0)).toEqual({ etape: 'secret', chrono: 'garder' });
    expect(appliquerMime('secret', 'lancer', 0)).toEqual({
      etape: 'lance',
      chrono: { demarrer: CHRONO_MIME_S },
    });
    expect(CHRONO_MIME_S).toBe(150);
    expect(actionsMime('lance')).toEqual(['trouve', 'rate']);
  });

  it('trouvé vaut 100, raté 0, et arrête le chrono', () => {
    const trouve = appliquerMime('lance', 'trouve', s(95.4));
    expect(trouve).toEqual({
      etape: 'trouve',
      chrono: 'arreter',
      points: 100,
      resultat: { trouve: true, ecoule_ms: 95_400 },
    });
    const rate = appliquerMime('lance', 'rate', s(150));
    expect(rate.points).toBe(0);
    expect(rate.resultat?.trouve).toBe(false);
    expect(actionsMime('trouve')).toEqual([]);
  });

  it('refuse de lancer avant d’avoir montré le mot', () => {
    expect(() => appliquerMime('pret', 'lancer', 0)).toThrow(/impossible/);
    expect(() => appliquerMime('secret', 'trouve', 0)).toThrow(/impossible/);
  });
});

describe('pilotage de la diffusion photo', () => {
  it('désigne la gagnante du thème : 100 à son équipe, sans chrono', () => {
    expect(actionsPhoto('theme')).toEqual(['gagnante', 'aucune']);
    expect(
      appliquerPhoto('theme', { type: 'gagnante', equipe: 3, equipesAvecPhoto: [1, 3, 4] }),
    ).toEqual({
      etape: 'gagnante',
      chrono: 'garder',
      points: { 3: 100 },
      resultat: { equipe_gagnante: 3 },
    });
  });

  it('clôt un thème sans gagnante, sans points', () => {
    expect(appliquerPhoto('theme', { type: 'aucune' })).toEqual({
      etape: 'aucune',
      chrono: 'garder',
      points: {},
      resultat: { equipe_gagnante: null },
    });
  });

  it('une seule gagnante par thème, et seulement une équipe qui a envoyé', () => {
    expect(actionsPhoto('gagnante')).toEqual([]);
    expect(() =>
      appliquerPhoto('gagnante', { type: 'gagnante', equipe: 1, equipesAvecPhoto: [1] }),
    ).toThrow(/impossible/);
    expect(() => appliquerPhoto('aucune', { type: 'aucune' })).toThrow(/impossible/);
    expect(() =>
      appliquerPhoto('theme', { type: 'gagnante', equipe: 2, equipesAvecPhoto: [1, 3] }),
    ).toThrow(/rien envoyé/);
  });
});
