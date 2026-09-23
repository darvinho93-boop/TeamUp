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

  it('ne donne un indice qu’au palier qui l’autorise', () => {
    const lance: EtatPointsCommuns = { etape: 'lance', indices: 0 };
    expect(actionsPointsCommuns(lance, s(30))).not.toContain('indice');
    expect(actionsPointsCommuns(lance, s(60))).toContain('indice');
    const unIndice = appliquerPointsCommuns(lance, 'indice', s(60)).etat;
    expect(unIndice.indices).toBe(1);
    expect(actionsPointsCommuns(unIndice, s(80))).not.toContain('indice');
    expect(actionsPointsCommuns(unIndice, s(95))).toContain('indice');
    const deux = appliquerPointsCommuns(unIndice, 'indice', s(95)).etat;
    expect(actionsPointsCommuns(deux, s(120))).toEqual(['valider', 'echec']);
  });

  it('valider compte le barème au temps écoulé et arrête le chrono', () => {
    const t = appliquerPointsCommuns({ etape: 'lance', indices: 1 }, 'valider', s(80));
    expect(t.etat.etape).toBe('trouve');
    expect(t.chrono).toBe('arreter');
    expect(t.points).toBe(15 * 2 + 35);
    expect(t.resultat).toEqual({ ecoule_ms: 80_000, palier: 2, indices: 1, trouve: true });
  });

  it('l’échec vaut 0', () => {
    const t = appliquerPointsCommuns({ etape: 'lance', indices: 2 }, 'echec', s(130));
    expect(t.etat.etape).toBe('echec');
    expect(t.points).toBe(0);
    expect(actionsPointsCommuns(t.etat, s(130))).toEqual([]);
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
