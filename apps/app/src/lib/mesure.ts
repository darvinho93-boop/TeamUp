/**
 * Mesure (cahier des charges § 7) : durée réelle par jeu face à la durée prévue, taux de
 * connexion des invités. Fonctions pures ; le back-office lit la base et les appelle.
 *
 * Les instants viennent de la base : `commence_le` / `termine_le` des manches, posés par
 * `enregistrer_etape` au lancement et à la fin de chaque manche.
 */

import { dureeElement, PART_TRANSITIONS, type GameCode } from '@teamup/game';
import { elementDuProgramme } from './programme';

export interface MancheMesuree {
  jeu: GameCode;
  options: Record<string, unknown>;
  passages: number;
  commence_le: string | null;
  termine_le: string | null;
}

const secondes = (debut: string, fin: string) =>
  Math.max(0, Math.round((Date.parse(fin) - Date.parse(debut)) / 1000));

/** Durée prévue d'une manche : ses chronos, plus la part de transitions de la spec (≈ 15 %). */
export function dureePrevueS(m: Omit<MancheMesuree, 'commence_le' | 'termine_le'>): number {
  return Math.round(dureeElement(elementDuProgramme(m)) * (1 + PART_TRANSITIONS));
}

/** Durée réelle d'une manche jouée jusqu'au bout ; `null` sinon. */
export function dureeReelleS(m: MancheMesuree): number | null {
  return m.commence_le && m.termine_le ? secondes(m.commence_le, m.termine_le) : null;
}

/** Durée réelle d'une soirée : du lancement de la première manche à la fin de la dernière. */
export function dureeSoireeS(manches: readonly MancheMesuree[]): number | null {
  const debuts = manches.flatMap((m) => (m.commence_le ? [m.commence_le] : []));
  const fins = manches.flatMap((m) => (m.termine_le ? [m.termine_le] : []));
  if (!debuts.length || !fins.length) return null;
  const debut = debuts.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b));
  const fin = fins.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));
  return secondes(debut, fin);
}

export interface MesureJeu {
  jeu: GameCode;
  /** Manches jouées jusqu'au bout. */
  manches: number;
  reelMoyenS: number;
  prevuMoyenS: number;
  /** Réel − prévu, en part du prévu : 0,2 = 20 % plus long que prévu. */
  ecart: number;
}

/** Par jeu, sur les manches terminées : durée réelle moyenne face à la prévue. */
export function mesureParJeu(manches: readonly MancheMesuree[]): MesureJeu[] {
  const parJeu = new Map<GameCode, { reel: number; prevu: number; n: number }>();
  for (const m of manches) {
    const reel = dureeReelleS(m);
    if (reel === null) continue;
    const cumul = parJeu.get(m.jeu) ?? { reel: 0, prevu: 0, n: 0 };
    parJeu.set(m.jeu, {
      reel: cumul.reel + reel,
      prevu: cumul.prevu + dureePrevueS(m),
      n: cumul.n + 1,
    });
  }
  return [...parJeu].map(([jeu, c]) => ({
    jeu,
    manches: c.n,
    reelMoyenS: Math.round(c.reel / c.n),
    prevuMoyenS: Math.round(c.prevu / c.n),
    ecart: c.prevu > 0 ? (c.reel - c.prevu) / c.prevu : 0,
  }));
}

/** Joueurs inscrits ÷ invités attendus ; `null` quand l'animateur n'a rien saisi. */
export function tauxConnexion(joueurs: number, attendus: number | null): number | null {
  return attendus && attendus > 0 ? joueurs / attendus : null;
}
