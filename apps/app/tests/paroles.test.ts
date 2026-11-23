import { describe, expect, it } from 'vitest';
import {
  contientTamoul,
  DUREE_DERNIERE_LIGNE_MS,
  DUREE_LIGNE_MAX_MS,
  horodatage,
  lireParoles,
  LIGNE_MAX,
  parolesDe,
  parolesPretes,
  PAROLES_MAX_LIGNES,
  RANGEE_MAX,
  RANGEE_MAX_TAMOUL,
  rangees,
  versLrc,
  vueKaraoke,
} from '../src/lib/paroles';

describe('lire les paroles collées', () => {
  it('prend un texte brut, une ligne par ligne chantée, sans instants', () => {
    expect(lireParoles('  Première ligne \r\n\r\nDeuxième ligne\n')).toEqual({
      lignes: [
        { t_ms: null, texte: 'Première ligne' },
        { t_ms: null, texte: 'Deuxième ligne' },
      ],
      refus: null,
    });
  });

  it('lit un .lrc : en-têtes ignorés, fractions et lignes instrumentales', () => {
    const { lignes, refus } = lireParoles(
      '[ar:Artiste]\n[ti:Titre]\n[00:01.5] Une\n[00:02.25] Deux\n[00:03.125] Trois\n[00:04.00]\n',
    );
    expect(refus).toBeNull();
    expect(lignes).toEqual([
      { t_ms: 1500, texte: 'Une' },
      { t_ms: 2250, texte: 'Deux' },
      { t_ms: 3125, texte: 'Trois' },
    ]);
  });

  it('un refrain à plusieurs instants se déplie, dans l’ordre de la chanson', () => {
    expect(lireParoles('[01:00.00][00:10.00] Refrain\n[00:20.00] Couplet').lignes).toEqual([
      { t_ms: 10_000, texte: 'Refrain' },
      { t_ms: 20_000, texte: 'Couplet' },
      { t_ms: 60_000, texte: 'Refrain' },
    ]);
  });

  it('refuse le vide, une ligne trop longue et un texte trop long', () => {
    expect(lireParoles(' \n ').refus).toBe('vide');
    expect(lireParoles('x'.repeat(LIGNE_MAX + 1)).refus).toBe('longue');
    expect(lireParoles('a\n'.repeat(PAROLES_MAX_LIGNES + 1)).refus).toBe('trop');
  });

  it('relit à l’identique ce qu’il a écrit', () => {
    const lignes = [
      { t_ms: 83_450, texte: 'Une' },
      { t_ms: 3_725_001, texte: 'Deux' },
    ];
    expect(horodatage(83_450)).toBe('01:23.450');
    expect(lireParoles(versLrc(lignes)).lignes).toEqual(lignes);
    expect(versLrc([{ t_ms: null, texte: 'Pas calée' }])).toBe('Pas calée');
  });
});

describe('des paroles prêtes à enregistrer', () => {
  it('exige un instant par ligne, strictement croissant', () => {
    const bonnes = [
      { t_ms: 0, texte: 'a' },
      { t_ms: 10, texte: 'b' },
    ];
    expect(parolesPretes(bonnes)).toEqual(bonnes);
    expect(parolesPretes([])).toBeNull();
    expect(parolesPretes([{ t_ms: null, texte: 'a' }])).toBeNull();
    expect(
      parolesPretes([
        { t_ms: 10, texte: 'a' },
        { t_ms: 10, texte: 'b' },
      ]),
    ).toBeNull();
    expect(parolesPretes([{ t_ms: 1.5, texte: 'a' }])).toBeNull();
  });

  it('se relisent sans confiance depuis la base', () => {
    expect(parolesDe(null)).toEqual([]);
    expect(parolesDe('x')).toEqual([]);
    expect(parolesDe([{ t_ms: 1, texte: 'a' }, { t_ms: 'x' }, null])).toEqual([
      { t_ms: 1, texte: 'a' },
    ]);
  });
});

describe('ce que montre l’écran', () => {
  const lignes = [
    { t_ms: 10_000, texte: 'Une' },
    { t_ms: 14_000, texte: 'Deux' },
    { t_ms: 40_000, texte: 'Trois' },
  ];

  it('avant la première ligne, annonce la suivante', () => {
    expect(vueKaraoke(lignes, 5_000)).toEqual({
      index: -1,
      precedente: null,
      courante: null,
      suivante: 'Une',
      avancement: 0,
    });
  });

  it('remplit la ligne chantée jusqu’à la suivante', () => {
    expect(vueKaraoke(lignes, 12_000)).toEqual({
      index: 0,
      precedente: null,
      courante: 'Une',
      suivante: 'Deux',
      avancement: 0.5,
    });
  });

  it('ne s’étire pas sur un pont musical : la ligne reste pleine en attendant', () => {
    expect(vueKaraoke(lignes, 14_000 + DUREE_LIGNE_MAX_MS / 2).avancement).toBe(0.5);
    const pont = vueKaraoke(lignes, 30_000);
    expect(pont).toMatchObject({
      index: 1,
      precedente: 'Une',
      courante: 'Deux',
      suivante: 'Trois',
    });
    expect(pont.avancement).toBe(1);
  });

  it('finit sur la dernière ligne', () => {
    expect(vueKaraoke(lignes, 40_000 + DUREE_DERNIERE_LIGNE_MS / 2)).toMatchObject({
      index: 2,
      suivante: null,
      avancement: 0.5,
    });
    expect(vueKaraoke(lignes, 300_000).avancement).toBe(1);
  });

  it('sans paroles, rien à montrer', () => {
    expect(vueKaraoke([], 1_000)).toMatchObject({ index: -1, courante: null, suivante: null });
  });

  it('reconnaît l’écriture tamoule', () => {
    expect(contientTamoul('வணக்கம்')).toBe(true);
    expect(contientTamoul('Vanakkam')).toBe(false);
  });
});

describe('une ligne longue sur deux rangées', () => {
  it('laisse une ligne courte entière', () => {
    expect(rangees('Une ligne courte')).toEqual([{ texte: 'Une ligne courte', debut: 0, part: 1 }]);
    expect(rangees('x'.repeat(RANGEE_MAX))).toHaveLength(1);
  });

  it('coupe à l’espace le plus proche du milieu, et se remplit rangée après rangée', () => {
    const [a, b] = rangees('Une ligne assez longue pour tenir sur deux rangées');
    expect(a!.texte).toBe('Une ligne assez longue pour');
    expect(b!.texte).toBe('tenir sur deux rangées');
    expect(a!.debut).toBe(0);
    expect(b!.debut).toBeCloseTo(a!.part);
    expect(a!.part + b!.part).toBeCloseTo(1);
  });

  it('coupe plus tôt en tamoul, dont les lettres sont plus larges', () => {
    const tamoul = 'தமிழ் எழுத்துகள் சரியாகத் தெரிகிறதா';
    expect(tamoul.length).toBeGreaterThan(RANGEE_MAX_TAMOUL);
    expect(rangees(tamoul)).toHaveLength(2);
  });

  it('ne coupe pas un mot sans espace', () => {
    expect(rangees('x'.repeat(60))).toHaveLength(1);
  });
});
