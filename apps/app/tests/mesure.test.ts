import { describe, expect, it } from 'vitest';
import {
  dureePrevueS,
  dureeReelleS,
  dureeSoireeS,
  mesureParJeu,
  tauxConnexion,
  type MancheMesuree,
} from '../src/lib/mesure';

const manche = (
  jeu: MancheMesuree['jeu'],
  passages: number,
  debut: string | null,
  fin: string | null,
  options: Record<string, unknown> = {},
): MancheMesuree => ({
  jeu,
  options,
  passages,
  commence_le: debut && `2026-10-03T${debut}:00Z`,
  termine_le: fin && `2026-10-03T${fin}:00Z`,
});

describe('durée prévue d’une manche', () => {
  it('reprend les chronos de la spec, plus 15 % de transitions', () => {
    // Points communs : 130 s par équipe ; 4 équipes = 520 s, + 15 % = 598 s.
    expect(dureePrevueS(manche('list2', 4, null, null))).toBe(598);
    // Tête, épaule, gobelet : 45 s par duel ; 3 duels = 135 s, + 15 % = 155 s.
    expect(dureePrevueS(manche('cup', 3, null, null, { duels: 3 }))).toBe(155);
  });
});

describe('durée réelle', () => {
  it('se mesure entre le lancement et la fin d’une manche', () => {
    expect(dureeReelleS(manche('qcm2', 4, '21:00', '21:03'))).toBe(180);
    expect(dureeReelleS(manche('qcm2', 4, '21:00', null))).toBeNull();
  });

  it('va, pour la soirée, de la première manche lancée à la dernière terminée', () => {
    expect(
      dureeSoireeS([
        manche('list2', 4, '21:10', '21:20'),
        manche('qcm2', 4, '21:00', '21:04'),
        manche('mime2', 4, '21:25', null),
      ]),
    ).toBe(20 * 60);
    expect(dureeSoireeS([manche('list2', 4, null, null)])).toBeNull();
  });
});

describe('mesure par jeu', () => {
  it('fait la moyenne des manches terminées et l’écart au prévu', () => {
    const [quiz] = mesureParJeu([
      manche('qcm2', 4, '21:00', '21:03', { questions: 4 }),
      manche('qcm2', 4, '22:00', '22:05', { questions: 4 }),
      manche('qcm2', 4, '23:00', null, { questions: 4 }),
    ]);
    expect(quiz).toMatchObject({ jeu: 'qcm2', manches: 2, reelMoyenS: 240 });
    expect(quiz!.ecart).toBeCloseTo((240 - quiz!.prevuMoyenS) / quiz!.prevuMoyenS);
  });

  it('ignore un jeu jamais terminé', () => {
    expect(mesureParJeu([manche('mime2', 4, '21:00', null)])).toEqual([]);
  });
});

describe('taux de connexion des invités', () => {
  it('rapporte les inscrits aux invités attendus, rien sans attendus', () => {
    expect(tauxConnexion(90, 120)).toBe(0.75);
    expect(tauxConnexion(90, null)).toBeNull();
  });
});
