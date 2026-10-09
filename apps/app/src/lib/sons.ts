import type { GameCode } from '@teamup/game';
import { ETAPE_TIRAGE_ORDRE } from './pilotage';
import { mancheCourante, type EtatSalle } from './salle';

/**
 * Les sons de l'écran commun (générés par `scripts/sons-elevenlabs.mjs`, servis depuis
 * `/sons/`), et la règle qui dit lequel part à quel moment. Seul l'écran commun en joue : ni la régie, ni son
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
  'presentation',
  'jingle',
  'roulement',
  'fanfare',
  'arrivee',
  'ambiance',
  'explication',
] as const;
export type Son = (typeof SONS)[number];

/** Chaque son existe en deux versions, à l'écoute sur `/kit-ui/sons`. */
export const VARIANTES = ['a', 'b'] as const;
export type Variante = (typeof VARIANTES)[number];

/** La version retenue pour chaque son : celle que joue l'écran commun. */
export const CHOIX: Record<Son, Variante> = {
  tic: 'a',
  tac: 'a',
  'fin-de-temps': 'a',
  indice: 'a',
  reussite: 'a',
  echec: 'a',
  revelation: 'a',
  presentation: 'a',
  jingle: 'a',
  roulement: 'a',
  fanfare: 'a',
  arrivee: 'a',
  ambiance: 'a',
  explication: 'a',
};

/** L'adresse du fichier d'un son ; sans variante, celle qui a été retenue. */
export const fichierDe = (son: Son, variante: Variante = CHOIX[son]) =>
  `/sons/${son}-${variante}.wav`;

/** Niveau de chaque son par rapport au volume de la salle : l'ambiance reste en fond. */
export const NIVEAUX: Record<Son, number> = {
  tic: 0.55,
  tac: 0.55,
  'fin-de-temps': 0.9,
  indice: 0.8,
  reussite: 1,
  echec: 0.8,
  revelation: 0.8,
  presentation: 0.8,
  jingle: 0.9,
  roulement: 0.9,
  fanfare: 1,
  arrivee: 0.45,
  ambiance: 0.3,
  explication: 0.22,
};

/**
 * Un son à la fois. Les battements du chrono sont brefs et se posent sur tout ; un autre son
 * (verdict, jingle, fanfare, arrivée…) coupe celui qui jouait encore, au lieu de s'y ajouter :
 * un échec déclaré pendant le buzzer de fin de temps le remplace.
 */
export function estBattement(son: Son): boolean {
  return son === 'tic' || son === 'tac';
}

/** Les musiques de fond, en boucle : une seule joue à la fois. */
export type Fond = 'ambiance' | 'explication';

/** Pendant qu'un son joue, la musique de fond s'efface à cette fraction de son niveau. */
export const FOND_SOUS_UN_SON = 0.25;

/**
 * Durée de l'interlude entre deux jeux, celle de `--tu-dur-interlude` : le logo passe en plein
 * écran sur un roulement de tambour, puis le nom du jeu paraît sur son jingle.
 */
export const INTERLUDE_MS = 1600;

/**
 * Ce qu'un son devient au moment de le jouer. Le jingle d'un nouveau jeu se déroule en deux
 * temps : le roulement pendant que le logo est à l'écran, puis le jingle quand le nom paraît.
 * Sans mouvement (`prefers-reduced-motion`), il n'y a pas d'interlude : le jingle part seul.
 */
export function deroule(son: Son, sansMouvement: boolean): { son: Son; apresMs: number }[] {
  if (son !== 'jingle' || sansMouvement) return [{ son, apresMs: 0 }];
  return [
    { son: 'presentation', apresMs: 0 },
    { son: 'jingle', apresMs: INTERLUDE_MS },
  ];
}

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
 * Les musiques de fond ne sont pas ici : elles durent tant que leur moment dure (`fondA`).
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

/**
 * La musique de fond du moment : l'ambiance à l'accueil, pendant que les invités scannent le QR
 * code ; une musique légère sous l'explication animée d'un jeu ; rien ailleurs.
 */
export function fondA(instant: Instant): Fond | null {
  if (instant.scene === 'accueil') return 'ambiance';
  if (instant.scene === 'intro' && instant.etape?.startsWith('explication')) return 'explication';
  return null;
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
