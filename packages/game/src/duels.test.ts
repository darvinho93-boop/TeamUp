import { describe, expect, it } from 'vitest';
import {
  aleaDepuis,
  GESTES_GOBELET,
  LONGUEUR_MAX_GOBELET,
  LONGUEUR_MIN_GOBELET,
  PIEGES_GOBELET,
  POINTS_DUEL,
  scoreDuel,
  sequenceGobelet,
  tirerDuel,
  type Alea,
  type Candidat,
} from './duels';
import { actionsDuel, appliquerDuel, chronoDuelS, type Duelliste } from './pilotage/duel';

/** Générateur pseudo-aléatoire à graine : mêmes tirages à chaque exécution. */
function graine(n: number): Alea {
  let x = n;
  return () => {
    x = (x * 1103515245 + 12345) % 2 ** 31;
    return x / 2 ** 31;
  };
}

const joueurs = (equipes: Record<number, number>): Candidat[] =>
  Object.entries(equipes).flatMap(([equipe, nombre]) =>
    Array.from({ length: nombre }, (_, i) => ({
      id: `e${equipe}-j${i + 1}`,
      equipe: Number(equipe),
    })),
  );

describe('barème des duels', () => {
  it('donne 50 points à l’équipe du vainqueur, rien à l’autre', () => {
    expect(POINTS_DUEL).toBe(50);
    expect(scoreDuel(3)).toEqual({ 3: 50 });
  });
});

describe('tirage des duellistes', () => {
  it('oppose toujours deux équipes différentes', () => {
    const alea = graine(1);
    const salle = joueurs({ 1: 5, 2: 5, 3: 5 });
    for (let i = 0; i < 50; i++) {
      const duel = tirerDuel(salle, [], alea)!;
      expect(duel[0].equipe).not.toBe(duel[1].equipe);
    }
  });

  it('fait passer d’abord les équipes qui ont le moins duellé', () => {
    const salle = joueurs({ 1: 3, 2: 3, 3: 3, 4: 3 });
    const deja = [salle[0]!, salle[3]!]; // équipes 1 et 2 ont déjà duellé
    for (let n = 0; n < 20; n++) {
      const duel = tirerDuel(salle, deja, graine(n))!;
      expect(duel.map((d) => d.equipe).sort()).toEqual([3, 4]);
    }
  });

  it('ne reprend pas un joueur tant qu’un équipier n’a pas duellé', () => {
    const alea = graine(7);
    const salle = joueurs({ 1: 3, 2: 3 });
    const tires: Candidat[] = [];
    for (let duel = 0; duel < 3; duel++) tires.push(...tirerDuel(salle, tires, alea)!);
    // Trois duels entre deux équipes de trois : chacun a duellé exactement une fois.
    expect(new Set(tires.map((t) => t.id)).size).toBe(6);
  });

  it('équilibre les équipes sur une soirée', () => {
    const alea = graine(42);
    const salle = joueurs({ 1: 10, 2: 10, 3: 10, 4: 10, 5: 10 });
    const tires: Candidat[] = [];
    for (let duel = 0; duel < 10; duel++) tires.push(...tirerDuel(salle, tires, alea)!);
    const parEquipe = [1, 2, 3, 4, 5].map((e) => tires.filter((t) => t.equipe === e).length);
    expect(parEquipe).toEqual([4, 4, 4, 4, 4]);
  });

  it('rend null sans deux équipes peuplées', () => {
    expect(tirerDuel(joueurs({ 1: 4 }), [], graine(1))).toBeNull();
    expect(tirerDuel([], [], graine(1))).toBeNull();
  });
});

describe('séquence de Tête, épaule, gobelet', () => {
  it('se rejoue à l’identique pour un même passage, change d’un passage à l’autre', () => {
    const a = sequenceGobelet(aleaDepuis('passage-1'));
    expect(sequenceGobelet(aleaDepuis('passage-1'))).toEqual(a);
    const autres = ['passage-2', 'passage-3', 'passage-4'].map((id) =>
      sequenceGobelet(aleaDepuis(id)),
    );
    expect(autres.some((s) => JSON.stringify(s) !== JSON.stringify(a))).toBe(true);
    for (let i = 0; i < 100; i++) {
      const x = aleaDepuis(String(i))();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('finit par gobelet, une seule fois, à une longueur variable', () => {
    const longueurs = new Set<number>();
    for (let n = 0; n < 200; n++) {
      const sequence = sequenceGobelet(graine(n));
      expect(sequence.at(-1)).toBe('gobelet');
      expect(sequence.filter((m) => m === 'gobelet')).toHaveLength(1);
      expect(sequence.length).toBeGreaterThanOrEqual(LONGUEUR_MIN_GOBELET);
      expect(sequence.length).toBeLessThanOrEqual(LONGUEUR_MAX_GOBELET);
      longueurs.add(sequence.length);
    }
    expect(longueurs.size).toBeGreaterThan(3);
  });

  it('place deux pièges au plus, jamais en tête ni collés, sans répéter un geste', () => {
    const pieges = PIEGES_GOBELET as readonly string[];
    let avecPiege = 0;
    for (let n = 0; n < 200; n++) {
      const sequence = sequenceGobelet(graine(n));
      const positions = sequence.flatMap((m, i) => (pieges.includes(m) ? [i] : []));
      expect(positions.length).toBeLessThanOrEqual(2);
      expect(positions.every((p) => p >= 2)).toBe(true);
      if (positions.length === 2) expect(positions[1]! - positions[0]!).toBeGreaterThan(1);
      if (positions.length) avecPiege++;
      sequence.slice(0, -1).forEach((m, i) => {
        expect([...GESTES_GOBELET, ...PIEGES_GOBELET]).toContain(m);
        if (i > 0) expect(m).not.toBe(sequence[i - 1]);
      });
    }
    expect(avecPiege).toBeGreaterThan(0);
  });
});

describe('pilotage d’un duel', () => {
  const duellistes: [Duelliste, Duelliste] = [
    { joueur_id: 'a', prenom: 'Zoé', equipe: 1 },
    { joueur_id: 'b', prenom: 'Malik', equipe: 3 },
  ];

  it('suit tirage, face-à-face, chrono, verdict', () => {
    expect(actionsDuel('tirage')).toEqual(['tirer', 'presenter']);
    const tirage = appliquerDuel('cup', 'tirage', { type: 'tirer', duellistes }, null);
    expect(tirage).toEqual({ etape: 'tirage', chrono: 'garder', resultat: { duellistes } });

    expect(appliquerDuel('cup', 'tirage', { type: 'presenter' }, duellistes).etape).toBe(
      'face_a_face',
    );
    expect(appliquerDuel('cup', 'face_a_face', { type: 'lancer' }, duellistes).chrono).toEqual({
      demarrer: 45,
    });
    expect(appliquerDuel('grab', 'face_a_face', { type: 'lancer' }, duellistes).chrono).toEqual({
      demarrer: 30,
    });

    const verdict = appliquerDuel('cup', 'chrono', { type: 'verdict', gagnant: 1 }, duellistes);
    expect(verdict).toEqual({
      etape: 'gagne',
      chrono: 'arreter',
      resultat: { duellistes, gagnant: 1 },
      points: { 3: 50 },
    });
    expect(actionsDuel('gagne')).toEqual([]);
  });

  it('reprend les chronos de la spec', () => {
    expect(chronoDuelS('grab')).toBe(30);
    expect(chronoDuelS('cup')).toBe(45);
  });

  it('refuse un duel sans duellistes, entre équipiers, ou hors de son étape', () => {
    expect(() => appliquerDuel('cup', 'tirage', { type: 'presenter' }, null)).toThrow(/aucun/);
    expect(() =>
      appliquerDuel(
        'cup',
        'tirage',
        { type: 'tirer', duellistes: [duellistes[0], { ...duellistes[1], equipe: 1 }] },
        null,
      ),
    ).toThrow(/différentes/);
    expect(() => appliquerDuel('cup', 'tirage', { type: 'lancer' }, duellistes)).toThrow(
      /impossible/,
    );
  });
});
