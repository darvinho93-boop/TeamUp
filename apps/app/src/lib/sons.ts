import { positionExtraitMs, positionKaraokeMs, resultatBlindDe, type GameCode } from '@teamup/game';
import { musiquesDe } from './musiques';
import { FINALE } from './ouverture';
import { ETAPE_FORMATION, ETAPE_TIRAGE_ORDRE, extraitBlind, titresBlind } from './pilotage';
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
  'finale',
  'top',
  'glisse',
  'buzzer',
  'applaudissements',
] as const;
export type Son = (typeof SONS)[number];

/** L'adresse du fichier d'un son. */
export const fichierDe = (son: Son) => `/sons/${son}.wav`;

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
  finale: 0.9,
  top: 0.8,
  glisse: 0.45,
  buzzer: 0.9,
  applaudissements: 0.9,
};

/** Les sons de la boîte à sons de la régie (2026-11-19), dans l'ordre de ses touches. */
export const BRUITAGES = [
  'applaudissements',
  'roulement',
  'presentation',
  'reussite',
  'echec',
  'buzzer',
] as const satisfies readonly Son[];
export type Bruitage = (typeof BRUITAGES)[number];
const estBruitage = (son: string | null): son is Bruitage =>
  (BRUITAGES as readonly string[]).includes(son ?? '');

/**
 * Le coup du son de la passe finale (la piste du reel Team Up!, `scripts/son-finale.mjs`), en ms
 * depuis le début du fichier : il tombe quand le logo se forme. À garder égal à ce qu'annonce le
 * script (testé sur le fichier).
 */
export const COUP_FINALE_MS = 2668;

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
 * La piste du reel, à la clôture, part de sorte que son coup tombe quand le logo se forme, comme à
 * l'ouverture (`sonsDeLaFinale`).
 */
export function deroule(son: Son, sansMouvement: boolean): { son: Son; apresMs: number }[] {
  if (son === 'finale' && !sansMouvement) return sonsDeLaFinale();
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
  /** Le départ du chrono de la salle : un dévoilement rejoué en pose un nouveau. */
  chronoDepartMs: number | null;
  /** Les réponses du quiz déjà affichées, les indices donnés (`pilotage.indices`). */
  indices: number;
  /** Le dernier son de la boîte à sons, et l'heure (de la base) où la régie l'a demandé. */
  bruitageSon: string | null;
  bruitageMs: number | null;
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
    chronoDepartMs: etat.pilotage.chrono_depart_ms,
    indices: etat.pilotage.indices,
    bruitageSon: etat.bruitage?.son ?? null,
    bruitageMs: etat.bruitage?.a_ms ?? null,
  };
}

/** L'étape de chaque jeu qui sonne, et comment. */
const VERDICTS: Partial<Record<GameCode, Record<string, Son>>> = {
  list2: { trouve: 'reussite', echec: 'echec' },
  enchere2: { tenu: 'reussite', rate: 'echec', podium: 'reussite' },
  // La bonne réponse du quiz sonne depuis la scène, après son suspense (2026-11-19) ; la fin du
  // quiz, quand les points tombent.
  qcm2: { resultat: 'reussite' },
  mime2: { trouve: 'reussite', rate: 'echec' },
  // Ciné-mime (2026-11-20) : la scène rejouée à la revue porte son propre son.
  cinemime: { trouve: 'reussite', rate: 'echec' },
  photo2: { gagnante: 'reussite' },
  // Duels (2026-11-19) : le roulement pendant que les prénoms défilent, le coup au face-à-face.
  grab: { tirage: 'roulement', face_a_face: 'revelation', gagne: 'reussite' },
  // Portrait mystère (2026-11-18) : un indice par tour, la cible puis la carte noire révélées ; le
  // verdict d'un tour sonne depuis la scène (réussite ou échec selon ce qu'il dit).
  portrait: { vote: 'indice', revele: 'revelation', noire: 'revelation' },
  // Le tournoi (2026-11-21) : le coup à l'appel d'une séquence, la fête au vainqueur.
  cup: {
    tirage: 'roulement',
    face_a_face: 'revelation',
    gagne: 'reussite',
    appel: 'revelation',
    vainqueur: 'reussite',
  },
  // Blind test (2026-11-15) : le buzz (un vrai buzzer depuis le 2026-11-19), la mauvaise réponse,
  // la révélation, ou le coup de la bonne réponse quand le karaoké repart (2026-11-23).
  blind: { buzz: 'buzzer', pause: 'echec', karaoke: 'revelation', revele: 'revelation' },
};

/** Les jeux dont le départ du chrono ne sonne pas : l'extrait du Blind test part, l'indice d'un tour
 * du Portrait mystère sonne déjà. */
const SANS_TOP: ReadonlySet<GameCode> = new Set(['blind', 'portrait']);

/**
 * Les sons qu'un changement d'état déclenche, dans l'ordre. Un état relu sans changement ne
 * sonne pas ; le premier état d'un écran qu'on ouvre non plus (il n'a pas d'« avant »).
 * Les musiques de fond ne sont pas ici : elles durent tant que leur moment dure (`fondA`).
 */
export function sonsPour(avant: Instant, apres: Instant): Son[] {
  const sons: Son[] = [];
  // La boîte à sons de la régie (2026-11-19) : un nouveau son demandé, vu par cet écran.
  if (
    apres.bruitageMs !== null &&
    apres.bruitageMs !== avant.bruitageMs &&
    estBruitage(apres.bruitageSon)
  ) {
    sons.push(apres.bruitageSon);
  }
  // Un seul son, même si dix invités sont arrivés entre deux lectures.
  if (apres.scene === 'accueil' && apres.joueurs > avant.joueurs) sons.push('arrivee');
  if (apres.scene === 'podium' && avant.scene !== 'podium') sons.push('fanfare');
  // La clôture (2026-10-22) : la piste du reel, sur le logo qui se forme.
  if (apres.scene === 'cloture' && avant.scene !== 'cloture') sons.push('finale');
  // Le dévoilement des équipes (2026-11-04) : le roulement, dont la cymbale tombe quand tout est
  // posé. Seulement à un nouveau départ : revenir sur la scène après coup ne le relance pas.
  if (
    apres.scene === 'equipes' &&
    apres.etape === ETAPE_FORMATION &&
    apres.chronoDepartMs !== avant.chronoDepartMs
  ) {
    sons.push('roulement');
  }

  // Cartes « Faisons connaissance » (2026-11-18) : l'équipe célébrée, à chaque présentation.
  if (apres.scene === 'connaissance' && apres.chronoDepartMs !== avant.chronoDepartMs) {
    sons.push('reussite');
  }

  if (apres.scene === 'intro') {
    const nouveauJeu = avant.scene !== 'intro' || avant.mancheId !== apres.mancheId;
    if (nouveauJeu && apres.mancheId) sons.push('jingle');
    if (apres.etape === ETAPE_TIRAGE_ORDRE && avant.etape !== ETAPE_TIRAGE_ORDRE)
      sons.push('roulement');
  }

  // Le classement (2026-11-19) : le roulement court pendant que les barres poussent ; la scène
  // joue la révélation quand les équipes changent de place.
  if (apres.scene === 'scores' && avant.scene !== 'scores') sons.push('presentation');

  if (apres.scene === 'jeu' && apres.jeu && apres.etape) {
    const nouvelleEtape =
      avant.scene !== 'jeu' || avant.etape !== apres.etape || avant.passageId !== apres.passageId;
    const son = VERDICTS[apres.jeu]?.[apres.etape];
    // Le titre qui suit un karaoké est déjà connu : rien ne couvre le fondu de la chanson.
    const apresKaraoke =
      apres.jeu === 'blind' && apres.etape === 'revele' && avant.etape === 'karaoke';
    if (nouvelleEtape && son && !apresKaraoke) sons.push(son);
    // Plateau (2026-11-19) : la question du quiz qui paraît, puis chacune de ses réponses.
    if (apres.jeu === 'qcm2' && apres.etape === 'question') {
      const memeQuestion = !nouvelleEtape;
      if (!memeQuestion || apres.indices > avant.indices) sons.push('glisse');
    }
    // Le départ de chaque chrono de jeu : le top. Au Ciné-mime, celui de la chaîne seulement :
    // le chrono de la scène (muette, puis rejouée avec son son) ne sonne pas.
    if (
      apres.chronoDepartMs !== null &&
      apres.chronoDepartMs !== avant.chronoDepartMs &&
      !SANS_TOP.has(apres.jeu) &&
      !(apres.jeu === 'cinemime' && apres.etape !== 'lance')
    ) {
      sons.push('top');
    }
  }
  return sons;
}

/**
 * La passe finale de l'ouverture (décision du 2026-10-18) : la piste du reel Team Up!, à la place
 * du roulement et du jingle. Elle part de sorte que son coup tombe quand le logo se forme
 * (`FINALE.logo`), après sa montée sous les ronds. L'écran la joue au début de la passe
 * (`Salle.tsx`) ; une passe reprise à `depuisMs` de son début (2026-10-23) prend la piste en
 * route au besoin (`dansLeSonMs`), pour que le coup tombe toujours sur le logo.
 */
export function sonsDeLaFinale(
  depuisMs = 0,
): { son: Son; apresMs: number; dansLeSonMs?: number }[] {
  const depart = FINALE.logo - COUP_FINALE_MS - depuisMs;
  return depart >= 0
    ? [{ son: 'finale', apresMs: depart }]
    : [{ son: 'finale', apresMs: 0, dansLeSonMs: -depart }];
}

/**
 * La musique de fond du moment : l'ambiance à l'ouverture et à l'accueil, pendant que les invités
 * arrivent et scannent le QR code ; une musique légère sous l'explication animée d'un jeu ; rien
 * ailleurs.
 */
export function fondA(instant: Instant): Fond | null {
  // La page Instagram et la clôture aussi (2026-10-22) : la salle n'y joue pas.
  if (['ouverture', 'accueil', 'instagram', 'cloture'].includes(instant.scene)) return 'ambiance';
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

/** De quoi faire monter un son : son niveau et sa vitesse de lecture, multipliés. */
export interface Montee {
  gain: number;
  vitesse: number;
}

/**
 * Le battement monte à mesure que le chrono descend (2026-10-22) : de 70 % à 150 % du niveau, et
 * de la vitesse normale à 1,35 fois (donc plus aigu), entre la dixième et la dernière seconde.
 */
export function monteeDuChrono(reste: number): Montee {
  const p = Math.min(1, Math.max(0, (DERNIERES_SECONDES - reste) / (DERNIERES_SECONDES - 1)));
  return { gain: 0.7 + 0.8 * p, vitesse: 1 + 0.35 * p };
}

/**
 * Musique sous les chronos (2026-11-15) : les MP3 de la bibliothèque, cochés à la préparation
 * pour chaque Quiz et chaque Surenchère (`options.musiques`). Plus fort que l'ambiance, sous les
 * bruitages.
 */
export const NIVEAU_MUSIQUE = 0.45;

/** L'extrait du blind test : c'est le jeu, il passe au premier plan. */
export const NIVEAU_EXTRAIT = 0.9;

/** Le fondu de la chanson quand la régie coupe le karaoké (2026-11-23). */
export const FONDU_KARAOKE_MS = 3000;

/**
 * Le fondu des musiques, à l'entrée comme à la sortie (le lecteur s'en sert pour toutes). Celle
 * du chrono commence à s'effacer d'autant avant les dix dernières secondes, pour que le premier
 * battement tombe sur le silence.
 */
export const FONDU_MUSIQUE_MS = 800;

/** La musique qui doit jouer, et l'instant (heure de la base, ms) où elle doit s'effacer. */
export interface MusiqueDuMoment {
  id: string;
  jusquA: number;
}

/**
 * Ce que joue l'écran sous un chrono : pendant celui d'une question du quiz (lancé) et celui d'un
 * thème de la Surenchère, à la voix comme aux téléphones ; jusqu'aux dix dernières secondes, où le
 * tic-tac prend toute la place (elle s'est effacée juste avant). Les musiques cochées et encore actives tournent, une par question
 * ou par thème, dans l'ordre des passages : deux écrans et un rechargement jouent la même.
 * `maintenantMs` est à l'heure de la base.
 */
export function musiqueA(
  etat: Pick<EtatSalle, 'pilotage' | 'programme'>,
  maintenantMs: number,
  actives: ReadonlySet<string>,
): MusiqueDuMoment | null {
  const {
    scene,
    etape,
    passage_id,
    chrono_depart_ms: depart,
    chrono_duree_s: duree,
  } = etat.pilotage;
  if (scene !== 'jeu' || depart === null || duree === null) return null;
  const manche = etat.programme.find((m) => m.id === etat.pilotage.manche_id);
  const sousChrono =
    (manche?.jeu === 'qcm2' && etape === 'question') ||
    (manche?.jeu === 'enchere2' && etape === 'chrono');
  if (!manche || !sousChrono) return null;
  const liste = musiquesDe(manche.options).filter((id) => actives.has(id));
  const passage = manche.passages.find((p) => p.id === passage_id);
  if (liste.length === 0 || !passage) return null;
  // Le chrono affiche la seconde entamée par défaut (`tempsRestant`) : « 10 », le premier
  // battement, paraît quand il reste moins de onze secondes.
  const premierBattement = depart + (duree - DERNIERES_SECONDES - 1) * 1000;
  const jusquA = premierBattement - FONDU_MUSIQUE_MS;
  if (maintenantMs >= jusquA) return null;
  return { id: liste[(Math.max(1, passage.ordre) - 1) % liste.length]!, jusquA };
}

/** L'extrait du blind test qui doit jouer : la musique, la seconde où il en est, et sa fin. */
export interface ExtraitDuMoment {
  id: string;
  depuisS: number;
  /** Heure de la base (ms) où l'écoute s'arrête : le chrono de l'extrait est écoulé. */
  jusquA: number;
  /** La chanson du karaoké : quand elle s'arrête, c'est en fondu. */
  karaoke?: true;
}

/**
 * Blind test (2026-11-15) : l'extrait joue pendant l'écoute, à la seconde où il en est (début
 * choisi, écoute déjà faite, chrono en cours) ; deux écrans et un rechargement tombent donc au même
 * endroit. Au karaoké (2026-11-23), la chanson repart du buzz et va au-delà de l'extrait. Rien
 * ailleurs, ni sans musique choisie et active. `maintenantMs` est à l'heure de la base.
 */
export function extraitA(
  etat: Pick<EtatSalle, 'pilotage' | 'programme'>,
  maintenantMs: number,
  actives: ReadonlySet<string>,
): ExtraitDuMoment | null {
  const {
    scene,
    etape,
    passage_id,
    chrono_depart_ms: depart,
    chrono_duree_s: duree,
  } = etat.pilotage;
  if (scene !== 'jeu' || (etape !== 'ecoute' && etape !== 'karaoke')) return null;
  if (depart === null || duree === null) return null;
  const manche = etat.programme.find((m) => m.id === etat.pilotage.manche_id);
  if (manche?.jeu !== 'blind') return null;
  const passage = manche.passages.find((p) => p.id === passage_id);
  const titre = passage ? titresBlind(manche)[passage.ordre - 1] : undefined;
  if (!passage || !titre?.musique || !actives.has(titre.musique)) return null;
  const jusquA = depart + duree * 1000;
  if (maintenantMs >= jusquA) return null;
  if (etape === 'karaoke') {
    const position = positionKaraokeMs(
      titre.debutS,
      resultatBlindDe(passage.resultat),
      maintenantMs - depart,
    );
    return { id: titre.musique, depuisS: position / 1000, jusquA, karaoke: true };
  }
  const positionMs = positionExtraitMs(
    titre.debutS,
    resultatBlindDe(passage.resultat),
    'ecoute',
    maintenantMs - depart,
    extraitBlind(manche),
  );
  return { id: titre.musique, depuisS: positionMs / 1000, jusquA };
}
