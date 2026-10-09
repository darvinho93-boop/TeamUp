import type { GameCode } from '@teamup/game';
import { ETAPE_TIRAGE_ORDRE } from './pilotage';
import { mancheCourante, type EtatSalle } from './salle';

/**
 * Les sons de l'écran commun (fabriqués par `scripts/sons.mjs`, servis depuis `/sons/`), et la
 * règle qui dit lequel part à quel moment. Seul l'écran commun en joue : ni la régie, ni son
 * aperçu, ni les téléphones.
 */
export const SONS = [
  'tic',
  'tac',
  'fin-de-temps',
  'indice',
  'reussite',
  'echec',
  'revelation',
  'jingle',
  'roulement',
  'fanfare',
  'arrivee',
  'ambiance',
] as const;
export type Son = (typeof SONS)[number];

/** Niveau de chaque son par rapport au volume de la salle : l'ambiance reste en fond. */
export const NIVEAUX: Record<Son, number> = {
  tic: 0.55,
  tac: 0.55,
  'fin-de-temps': 0.9,
  indice: 0.8,
  reussite: 1,
  echec: 0.8,
  revelation: 0.8,
  jingle: 0.9,
  roulement: 0.9,
  fanfare: 1,
  arrivee: 0.45,
  ambiance: 0.3,
};

/** Le chrono se fait entendre à partir de là : une seconde, un battement. */
export const DERNIERES_SECONDES = 10;

export interface ReglageSon {
  actif: boolean;
  /** De 0 à 100. */
  volume: number;
}

export const REGLAGE_PAR_DEFAUT: ReglageSon = { actif: true, volume: 80 };

/** Le réglage posé par la régie ; sans la migration du 2026-10-10, le son est actif à 80. */
export function reglageDe(etat: Pick<EtatSalle, 'son'>): ReglageSon {
  const son = etat.son;
  if (!son || typeof son.volume !== 'number') return REGLAGE_PAR_DEFAUT;
  return { actif: son.actif !== false, volume: Math.max(0, Math.min(100, son.volume)) };
}

/** Ce que les sons ont besoin de savoir d'un état de la salle. */
export interface Instant {
  scene: EtatSalle['pilotage']['scene'];
  etape: string | null;
  mancheId: string | null;
  passageId: string | null;
  jeu: GameCode | null;
  joueurs: number;
}

export function instantDe(etat: EtatSalle): Instant {
  const { scene, etape, manche_id: mancheId, passage_id: passageId } = etat.pilotage;
  return {
    scene,
    etape,
    mancheId,
    passageId,
    jeu: mancheCourante(etat)?.jeu ?? null,
    joueurs: etat.joueurs,
  };
}

/** L'étape de chaque jeu qui sonne, et comment. */
const VERDICTS: Partial<Record<GameCode, Record<string, Son>>> = {
  list2: { trouve: 'reussite', echec: 'echec' },
  enchere2: { tenu: 'reussite', rate: 'echec' },
  qcm2: { reponse: 'revelation' },
  mime2: { trouve: 'reussite', rate: 'echec' },
  photo2: { gagnante: 'reussite' },
  grab: { gagne: 'reussite' },
  cup: { gagne: 'reussite' },
};

/**
 * Les sons qu'un changement d'état déclenche, dans l'ordre. Un état relu sans changement ne
 * sonne pas ; le premier état d'un écran qu'on ouvre non plus (il n'a pas d'« avant »).
 * L'ambiance n'est pas ici : elle dure tant que la scène est l'accueil (`ambianceA`).
 */
export function sonsPour(avant: Instant, apres: Instant): Son[] {
  const sons: Son[] = [];
  // Un seul son, même si dix invités sont arrivés entre deux lectures.
  if (apres.scene === 'accueil' && apres.joueurs > avant.joueurs) sons.push('arrivee');
  if (apres.scene === 'podium' && avant.scene !== 'podium') sons.push('fanfare');

  if (apres.scene === 'intro') {
    const nouveauJeu = avant.scene !== 'intro' || avant.mancheId !== apres.mancheId;
    if (nouveauJeu && apres.mancheId) sons.push('jingle');
    if (apres.etape === ETAPE_TIRAGE_ORDRE && avant.etape !== ETAPE_TIRAGE_ORDRE)
      sons.push('roulement');
  }

  if (apres.scene === 'jeu' && apres.jeu && apres.etape) {
    const nouvelleEtape =
      avant.scene !== 'jeu' || avant.etape !== apres.etape || avant.passageId !== apres.passageId;
    const son = VERDICTS[apres.jeu]?.[apres.etape];
    if (nouvelleEtape && son) sons.push(son);
  }
  return sons;
}

/** L'ambiance joue à l'accueil, pendant que les invités scannent le QR code. */
export function ambianceA(instant: Instant): boolean {
  return instant.scene === 'accueil';
}

/**
 * Le battement d'une seconde de chrono : rien au-dessus des dernières secondes, « tic » et
 * « tac » en alternance ensuite, et la fin de temps à zéro.
 */
export function sonDuChrono(reste: number): Son | null {
  if (reste === 0) return 'fin-de-temps';
  if (reste > DERNIERES_SECONDES) return null;
  return reste % 2 ? 'tac' : 'tic';
}
