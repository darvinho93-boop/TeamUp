/**
 * Une touche de la régie, traduite en écriture pour `enregistrer_etape`.
 *
 * Fonction pure : la régie l'applique à l'état qu'elle affiche, avec les règles de
 * packages/game, puis écrit directement sous la session de l'animateur. La base garde le
 * dernier mot : RLS (ses événements seulement), version (un état périmé est refusé, donc un
 * double appui ne compte jamais deux fois) et heure de départ des chronos posée par elle.
 * Écrire depuis le navigateur épargne un aller-retour par le serveur de l'app : c'est ce qui
 * tient l'écran projeté à jour en moins d'une seconde.
 */

import {
  appliquerDuel,
  appliquerMime,
  appliquerPhoto,
  appliquerPointsCommuns,
  appliquerQuiz,
  appliquerSurenchere,
  CHRONO_SURENCHERE_DEFAUT_S,
  CHRONO_SURENCHERE_TELEPHONES_DEFAUT_S,
  dureeExplicationS,
  DUREE_TIRAGE_S,
  MODES_QUIZ,
  MODES_SURENCHERE,
  passageSuivant,
  scriptExplication,
  type ActionDuel,
  type ActionMime,
  type ActionPhoto,
  type ActionPointsCommuns,
  type ActionQuiz,
  type ActionSurenchere,
  type BetaDuel,
  type Chrono,
  type Duelliste,
  type EtapeDuel,
  type EtapeMime,
  type EtapePhoto,
  type EtapePointsCommuns,
  type EtapeQuiz,
  type EtapeSurenchere,
  type GameCode,
  type ModeExplication,
  type ModeQuiz,
  type ModeSurenchere,
  type ScoresParEquipe,
  type ScriptExplication,
} from '@teamup/game';
import { DUREE_DEVOILEMENT_MS } from './devoilement';
import { capitainesManquants, jetonsDeDepartDe } from './jetons';
import {
  indicesMsDe,
  mancheCourante,
  passageCourant,
  type EtatSalle,
  type MancheSalle,
  type PassageSalle,
  type Scene,
} from './salle';

export type Commande =
  | { type: 'scene'; scene: Exclude<Scene, 'intro' | 'jeu'> }
  | { type: 'intro'; mancheId: string }
  /**
   * Le Quiz et la Surenchère s'expliquent selon le mode qu'on va lancer ; les autres jeux n'en
   * ont qu'un.
   */
  | { type: 'expliquer'; mode?: ModeExplication }
  | { type: 'arreterExplication' }
  /** L'ordre tiré par la régie (lot 13) : les ids des passages de la manche, dans l'ordre. */
  | { type: 'tirerOrdre'; passages: string[] }
  /** Le mode du Quiz ou de la Surenchère, choisi au lancement de la manche. */
  | { type: 'commencer'; mode?: ModeExplication }
  | { type: 'pointsCommuns'; action: ActionPointsCommuns }
  | { type: 'quiz'; action: Exclude<ActionQuiz['type'], 'valider'> }
  | { type: 'survivants'; survivants: ScoresParEquipe }
  | { type: 'mime'; action: ActionMime }
  | { type: 'duel'; action: ActionDuel }
  | {
      type: 'photo';
      action:
        Omit<Extract<ActionPhoto, { type: 'gagnante' }>, 'equipesAvecPhoto'> | { type: 'aucune' };
    }
  | { type: 'suivant' }
  /** Un passage de Points communs ou de Mime resté sans équipe (panne du 2026-10-31) : 0 point. */
  | { type: 'passer' }
  | { type: 'devoiler'; passageId: string }
  | { type: 'adjuger' }
  | { type: 'verdict'; tenu: boolean; equipeChampion: number }
  /** Surenchère en mode téléphones : le podium du thème, d'après les mots non rayés. */
  | { type: 'classer' }
  | { type: 'retour' }
  | { type: 'terminer' }
  /** Le dévoilement animé des équipes formées (2026-11-04), rejouable. */
  | { type: 'devoilerEquipes' };

export interface Ecriture {
  pilotage: {
    scene: Scene;
    manche_id: string | null;
    passage_id: string | null;
    etape: string | null;
    indices: number;
    chrono: 'garder' | 'arreter' | 'demarrer';
    chrono_duree_s?: number;
  };
  passage: {
    id: string;
    statut: 'en_cours' | 'termine';
    resultat?: object;
    points?: number;
  } | null;
  manche: { id: string; statut: 'en_cours' | 'terminee'; options?: object } | null;
  scores: { equipe_id: string; points: number; motif: string; manche_id: string }[];
  /** La première manche lancée fait passer la soirée « en cours » (les téléphones le voient). */
  ouvrirLaSoiree: boolean;
  /** Nouvel ordre des passages, écrit par `ordonner_passages` avant l'étape (lot 13). */
  ordre: { manche_id: string; passages: string[] } | null;
}

/** Libellés du journal des points, dans la langue de la régie. */
export interface Motifs {
  pointsCommuns: (equipe: string) => string;
  tenu: string;
  rate: string;
  /** Surenchère en mode téléphones : le rang de l'équipe et ses mots validés. */
  podiumMots: (rang: number, mots: number) => string;
  quiz: (survivants: number) => string;
  /** Quiz en mode jetons : les jetons restants, comptés comme des survivants. */
  quizJetons: (jetons: number) => string;
  mime: (equipe: string) => string;
  photo: (equipe: string) => string;
  duel: (prenom: string, equipe: string) => string;
}

/**
 * Explication animée (lot 12) : une étape de la scène intro, `explication` ou, pour le Quiz
 * en mode téléphone ou jetons, `explication-telephone` ou `explication-jetons`, pour la
 * Surenchère en mode téléphones, `explication-telephones`. Le chrono de la salle en donne le
 * départ.
 */
const ETAPE_EXPLICATION = 'explication';
type ModeExpliqueAPart = Exclude<ModeExplication, 'croix' | 'voix'>;
const ETAPES_EXPLICATION_MODE: Record<ModeExpliqueAPart, string> = {
  telephone: 'explication-telephone',
  jetons: 'explication-jetons',
  telephones: 'explication-telephones',
};

/** Le mode qu'une étape d'explication présente (`croix` pour le script de base de chaque jeu). */
export function modeExpliqueDe(etape: string | null): ModeExplication {
  for (const [mode, nom] of Object.entries(ETAPES_EXPLICATION_MODE)) {
    if (etape === nom) return mode as ModeExpliqueAPart;
  }
  return 'croix';
}

/** Le script que l'écran doit jouer, ou `null` hors explication. */
export function scriptEnCours(
  jeu: GameCode | undefined,
  scene: Scene,
  etape: string | null,
): ScriptExplication | null {
  if (!jeu || scene !== 'intro') return null;
  if (etape === ETAPE_EXPLICATION) return scriptExplication(jeu);
  const mode = modeExpliqueDe(etape);
  if (mode === 'croix') return null;
  const script = scriptExplication(jeu, mode);
  // Le mode d'un autre jeu (une étape restée d'une explication du Quiz) : rien à jouer.
  return script === jeu ? null : script;
}

/** Tirage de l'ordre de passage en direct (lot 13) : une étape de l'intro, animée à l'écran. */
export const ETAPE_TIRAGE_ORDRE = 'tirage-ordre';

/**
 * Dévoilement des équipes (2026-11-04) : une étape de la scène Équipes, animée à l'écran tant que
 * le chrono de la salle court (`src/lib/devoilement.ts`). Rien en base ne la distingue d'une autre.
 */
export const ETAPE_FORMATION = 'formation';

/** Les jeux qui se jouent une équipe à la fois : leur ordre de passage se tire. */
export const jeuParEquipe = (jeu: string | undefined): boolean =>
  jeu === 'list2' || jeu === 'mime2';

const estDuel = (jeu: string | undefined): jeu is BetaDuel => jeu === 'grab' || jeu === 'cup';

/** Les duellistes tirés pour ce passage, gardés dans son résultat. */
export function duellistesDe(resultat: Record<string, unknown>): [Duelliste, Duelliste] | null {
  const d = resultat['duellistes'];
  return Array.isArray(d) && d.length === 2 ? (d as [Duelliste, Duelliste]) : null;
}

/** Le mode d'un quiz, fixé à son lancement ; `null` avant, ou pour un autre jeu. */
export function modeDuQuiz(manche: MancheSalle): ModeQuiz | null {
  const mode = manche.options['mode'];
  return manche.jeu === 'qcm2' && (MODES_QUIZ as readonly unknown[]).includes(mode)
    ? (mode as ModeQuiz)
    : null;
}

/**
 * Le mode d'une Surenchère, fixé à son lancement : `voix` pour une manche lancée avant le mode
 * téléphones (sans `mode`), `null` avant le lancement ou pour un autre jeu.
 */
export function modeDeLaSurenchere(manche: MancheSalle): ModeSurenchere | null {
  if (manche.jeu !== 'enchere2' || manche.statut === 'a_venir') return null;
  const mode = manche.options['mode'];
  return (MODES_SURENCHERE as readonly unknown[]).includes(mode)
    ? (mode as ModeSurenchere)
    : 'voix';
}

/** Le chrono d'un thème de la Surenchère selon le mode (réglages de la préparation). */
export function chronoSurenchere(manche: MancheSalle, mode: ModeSurenchere | null): number {
  const reglage = manche.options[mode === 'telephones' ? 'chrono_telephones_s' : 'chrono_s'];
  if (typeof reglage === 'number') return reglage;
  return mode === 'telephones' ? CHRONO_SURENCHERE_TELEPHONES_DEFAUT_S : CHRONO_SURENCHERE_DEFAUT_S;
}

/** Les mots non rayés de chaque équipe sur ce thème, par numéro (Surenchère en mode téléphones). */
export function comptesDesMots(passage: PassageSalle): Record<number, number> {
  const comptes: Record<number, number> = {};
  for (const [numero, mots] of Object.entries(passage.mots ?? {})) {
    comptes[Number(numero)] = mots.valides;
  }
  return comptes;
}

/**
 * Une manche lancée dont tout est joué, mais pas terminée : la régie l'a quittée par une scène
 * libre (les scores, le programme) avant « Terminer la manche ». Il ne reste qu'à la terminer :
 * la présentation le propose, et « Commencer » n'y rejoue rien (un quiz validé ne se valide pas
 * deux fois). La Surenchère n'en a pas besoin : sa grille des thèmes garde « Terminer ».
 */
export function mancheATerminer(manche: MancheSalle): boolean {
  if (manche.statut !== 'en_cours' || manche.jeu === 'enchere2') return false;
  if (manche.jeu === 'qcm2') return manche.options['survivants'] !== undefined;
  return passageSuivant(manche) === null;
}

function chronoDe(chrono: Chrono): Pick<Ecriture['pilotage'], 'chrono' | 'chrono_duree_s'> {
  return typeof chrono === 'string'
    ? { chrono }
    : { chrono: 'demarrer', chrono_duree_s: chrono.demarrer };
}

/**
 * L'écriture qu'une commande produit sur cet état, ou `null` si elle est impossible ici.
 * `ecouleMs` : temps écoulé sur le chrono de la salle au moment de l'appui.
 */
export function calculerEtape(
  etat: EtatSalle,
  commande: Commande,
  ecouleMs: number,
  motifs: Motifs,
): Ecriture | null {
  const p = etat.pilotage;
  const manche = mancheCourante(etat);
  const passage = passageCourant(etat);
  const ecriture: Ecriture = {
    pilotage: {
      scene: p.scene,
      manche_id: p.manche_id,
      passage_id: p.passage_id,
      etape: p.etape,
      indices: p.indices,
      chrono: 'garder',
    },
    passage: null,
    manche: null,
    scores: [],
    ouvrirLaSoiree: false,
    ordre: null,
  };

  try {
    switch (commande.type) {
      case 'scene':
        ecriture.pilotage.scene = commande.scene;
        return ecriture;

      case 'devoilerEquipes':
        // Rejouer, c'est la même touche : un nouveau départ, posé par la base, relance tout.
        if (etat.equipes.length === 0) return null;
        ecriture.pilotage.scene = 'equipes';
        ecriture.pilotage.etape = ETAPE_FORMATION;
        Object.assign(ecriture.pilotage, chronoDe({ demarrer: DUREE_DEVOILEMENT_MS / 1000 }));
        return ecriture;

      case 'intro': {
        const choisie = etat.programme.find((m) => m.id === commande.mancheId);
        if (!choisie || choisie.statut === 'terminee' || choisie.statut === 'annulee') return null;
        ecriture.pilotage = {
          scene: 'intro',
          manche_id: choisie.id,
          passage_id: null,
          etape: null,
          indices: 0,
          chrono: 'arreter',
        };
        return ecriture;
      }

      case 'expliquer': {
        if (p.scene !== 'intro' || !manche) return null;
        const voulu = commande.mode ?? 'croix';
        // Un mode qui n'est pas celui de ce jeu : son script de base.
        const aPart =
          voulu !== 'croix' &&
          voulu !== 'voix' &&
          scriptExplication(manche.jeu, voulu) !== manche.jeu
            ? voulu
            : null;
        const mode: ModeExplication = aPart ?? 'croix';
        // Rejouer, c'est la même touche : un nouveau départ, posé par la base.
        ecriture.pilotage.etape = aPart ? ETAPES_EXPLICATION_MODE[aPart] : ETAPE_EXPLICATION;
        Object.assign(
          ecriture.pilotage,
          chronoDe({ demarrer: dureeExplicationS(scriptExplication(manche.jeu, mode)) }),
        );
        return ecriture;
      }

      case 'arreterExplication':
        if (p.scene !== 'intro') return null;
        ecriture.pilotage.etape = null;
        ecriture.pilotage.chrono = 'arreter';
        return ecriture;

      case 'tirerOrdre': {
        if (p.scene !== 'intro' || !manche || !jeuParEquipe(manche.jeu)) return null;
        if (manche.statut !== 'a_venir' || manche.passages.some((pa) => pa.statut !== 'a_venir')) {
          return null;
        }
        const attendus = new Set(manche.passages.map((pa) => pa.id));
        const recus = new Set(commande.passages);
        if (
          recus.size !== commande.passages.length ||
          recus.size !== attendus.size ||
          commande.passages.some((id) => !attendus.has(id))
        ) {
          return null;
        }
        ecriture.pilotage.etape = ETAPE_TIRAGE_ORDRE;
        Object.assign(ecriture.pilotage, chronoDe({ demarrer: DUREE_TIRAGE_S }));
        ecriture.ordre = { manche_id: manche.id, passages: commande.passages };
        return ecriture;
      }

      case 'commencer': {
        if (!manche || manche.statut === 'terminee' || manche.statut === 'annulee') return null;
        if (mancheATerminer(manche)) return null;
        // Une manche reprise (quittée en cours de jeu) garde le mode choisi à son lancement.
        const modeFixe = manche.statut === 'en_cours' ? modeDuQuiz(manche) : null;
        const modeSurenchereFixe = modeDeLaSurenchere(manche);
        const base = {
          ...ecriture.pilotage,
          scene: 'jeu' as const,
          indices: 0,
          chrono: 'arreter' as const,
        };
        if (manche.jeu === 'enchere2') {
          ecriture.pilotage = { ...base, passage_id: null, etape: 'themes' };
        } else if (manche.jeu === 'list2' || manche.jeu === 'mime2') {
          const premier = passageSuivant(manche);
          if (!premier) return null;
          ecriture.pilotage = { ...base, passage_id: premier.id, etape: 'pret' };
          ecriture.passage = { id: premier.id, statut: 'en_cours' };
        } else if (manche.jeu === 'photo2') {
          // La diffusion : le premier thème à l'écran. La base clôt les envois à cet instant.
          const premier = passageSuivant(manche);
          if (!premier) return null;
          ecriture.pilotage = { ...base, passage_id: premier.id, etape: 'theme' };
          ecriture.passage = { id: premier.id, statut: 'en_cours' };
        } else if (estDuel(manche.jeu)) {
          // Un passage par duel : on commence par tirer les duellistes.
          const premier = passageSuivant(manche);
          if (!premier) return null;
          ecriture.pilotage = { ...base, passage_id: premier.id, etape: 'tirage' };
          ecriture.passage = { id: premier.id, statut: 'en_cours' };
        } else if (manche.jeu === 'qcm2') {
          // La question attend « Afficher » pour s'ouvrir : elle reste à venir jusque-là.
          const premiere = passageSuivant(manche);
          const derniereJouee = manche.passages
            .filter((x) => x.statut === 'termine')
            .sort((a, b) => b.ordre - a.ordre)[0];
          // « Terminer le quiz ici » déjà demandé : les questions restantes ne se jouent plus.
          const finDemandee = manche.options['fin'] === true;
          if (premiere && !finDemandee) {
            ecriture.pilotage = { ...base, passage_id: premiere.id, etape: 'pret' };
          } else if (modeFixe && derniereJouee) {
            // Quitté après sa dernière question, avant la validation : on revient aux
            // survivants, sans quoi les points du quiz seraient perdus.
            ecriture.pilotage = { ...base, passage_id: derniereJouee.id, etape: 'survivants' };
          } else {
            return null;
          }
        } else {
          return null;
        }
        if (manche.jeu === 'enchere2') {
          // Le mode de la Surenchère se choisit au lancement (2026-11-08), la voix d'abord ; une
          // reprise le garde. Mode téléphones : un capitaine par équipe, comme pour les jetons.
          const voulu: ModeSurenchere = commande.mode === 'telephones' ? 'telephones' : 'voix';
          if (
            !modeSurenchereFixe &&
            voulu === 'telephones' &&
            capitainesManquants(etat).length > 0
          ) {
            return null;
          }
          ecriture.manche = {
            id: manche.id,
            statut: 'en_cours',
            ...(modeSurenchereFixe ? {} : { options: { mode: voulu } }),
          };
          ecriture.ouvrirLaSoiree = etat.evenement.statut === 'preparation';
          return ecriture;
        }
        const demande = commande.mode;
        const mode: ModeQuiz =
          modeFixe ??
          ((MODES_QUIZ as readonly unknown[]).includes(demande) ? (demande as ModeQuiz) : 'croix');
        // Mode jetons : chaque équipe mise par son capitaine ; toutes partent avec l'effectif de
        // la plus grande (2026-10-18). Une reprise ne refait ni ce contrôle ni ce compte.
        if (
          manche.jeu === 'qcm2' &&
          !modeFixe &&
          mode === 'jetons' &&
          capitainesManquants(etat).length > 0
        ) {
          return null;
        }
        ecriture.manche = {
          id: manche.id,
          statut: 'en_cours',
          // Le mode du quiz se choisit au lancement de la manche (spec v3), la croix d'abord ;
          // une reprise le garde, jetons de départ compris.
          ...(manche.jeu === 'qcm2' && !modeFixe
            ? {
                options: mode === 'jetons' ? { mode, jetons: jetonsDeDepartDe(etat) } : { mode },
              }
            : {}),
        };
        ecriture.ouvrirLaSoiree = etat.evenement.statut === 'preparation';
        return ecriture;
      }

      case 'pointsCommuns': {
        if (manche?.jeu !== 'list2' || !passage) return null;
        const suite = appliquerPointsCommuns(
          {
            etape: p.etape as EtapePointsCommuns,
            indices: p.indices,
            indicesMs: indicesMsDe(passage),
          },
          commande.action,
          ecouleMs,
        );
        Object.assign(ecriture.pilotage, {
          etape: suite.etat.etape,
          indices: suite.etat.indices,
          ...chronoDe(suite.chrono),
        });
        if (commande.action === 'lancer') {
          // Un passage relancé repart d'un résultat vide : pas d'indice hérité d'un premier essai.
          ecriture.passage = { id: passage.id, statut: 'en_cours', resultat: {} };
        }
        if (commande.action === 'indice') {
          // L'instant de l'indice : l'écran et la régie en déduisent la reprise du chrono.
          ecriture.passage = {
            id: passage.id,
            statut: 'en_cours',
            resultat: { indices_ms: suite.etat.indicesMs },
          };
        }
        if (suite.points !== undefined && suite.resultat) {
          ecriture.passage = {
            id: passage.id,
            statut: 'termine',
            resultat: suite.resultat,
            points: suite.points,
          };
          const equipe = etat.equipes.find((e) => e.id === passage.equipe_id);
          if (equipe && suite.points > 0) {
            ecriture.scores.push({
              equipe_id: equipe.id,
              points: suite.points,
              motif: motifs.pointsCommuns(equipe.nom),
              manche_id: manche.id,
            });
          }
        }
        return ecriture;
      }

      case 'suivant': {
        const fini =
          (manche?.jeu === 'list2' && (p.etape === 'trouve' || p.etape === 'echec')) ||
          (manche?.jeu === 'mime2' && (p.etape === 'trouve' || p.etape === 'rate')) ||
          (manche?.jeu === 'photo2' && (p.etape === 'gagnante' || p.etape === 'aucune')) ||
          (estDuel(manche?.jeu) && p.etape === 'gagne');
        if (!manche || !fini) return null;
        const suivant = passageSuivant(manche);
        if (!suivant) return null;
        Object.assign(ecriture.pilotage, {
          passage_id: suivant.id,
          etape: manche.jeu === 'photo2' ? 'theme' : estDuel(manche.jeu) ? 'tirage' : 'pret',
          indices: 0,
          chrono: 'arreter',
        });
        ecriture.passage = { id: suivant.id, statut: 'en_cours' };
        return ecriture;
      }

      case 'passer': {
        // L'équipe du passage a été supprimée : on le clôt sans points et on revient à l'intro,
        // d'où « Commencer » reprend au passage suivant ; ou, s'il n'en reste pas, la manche finit.
        const courant = passageCourant(etat);
        if (!manche || !courant || !jeuParEquipe(manche.jeu)) return null;
        if (etat.equipes.some((e) => e.id === courant.equipe_id)) return null;
        ecriture.passage = {
          id: courant.id,
          statut: 'termine',
          resultat: { passe: true },
          points: 0,
        };
        const reste = manche.passages.some((pa) => pa.id !== courant.id && pa.statut !== 'termine');
        if (!reste) ecriture.manche = { id: manche.id, statut: 'terminee' };
        ecriture.pilotage = {
          scene: reste ? 'intro' : 'programme',
          manche_id: reste ? manche.id : null,
          passage_id: null,
          etape: null,
          indices: 0,
          chrono: 'arreter',
        };
        return ecriture;
      }

      case 'quiz':
      case 'survivants': {
        if (manche?.jeu !== 'qcm2' || !passage) return null;
        const suivante = manche.passages
          .filter((x) => x.id !== passage.id && x.statut !== 'termine')
          .sort((a, b) => a.ordre - b.ordre)[0];
        const action: ActionQuiz =
          commande.type === 'quiz'
            ? { type: commande.action }
            : { type: 'valider', survivants: commande.survivants };
        // Les propositions affichées une à une vivent dans `indices` (inutilisé par le quiz
        // jusque-là) ; le chrono lancé, c'est un départ posé par la base (2026-10-18).
        const suite = appliquerQuiz(
          {
            etape: p.etape as EtapeQuiz,
            resteDesQuestions: suivante !== undefined,
            propositions: p.indices,
            chronoLance: p.chrono_depart_ms !== null,
          },
          action,
        );
        Object.assign(ecriture.pilotage, { etape: suite.etape, ...chronoDe(suite.chrono) });
        if (suite.propositions !== undefined) ecriture.pilotage.indices = suite.propositions;
        switch (action.type) {
          case 'afficher':
            ecriture.passage = { id: passage.id, statut: 'en_cours' };
            break;
          case 'reveler':
            ecriture.passage = { id: passage.id, statut: 'termine', resultat: {} };
            break;
          case 'annuler':
            ecriture.passage = { id: passage.id, statut: 'termine', resultat: { annulee: true } };
            if (suite.etape === 'pret' && suivante) ecriture.pilotage.passage_id = suivante.id;
            break;
          case 'suivante':
            if (!suivante) return null;
            ecriture.pilotage.passage_id = suivante.id;
            break;
          case 'fin':
            // Gardé dans la manche : une reprise (la régie a montré les scores avant de valider)
            // revient aux survivants au lieu d'ouvrir la question suivante.
            ecriture.manche = { id: manche.id, statut: 'en_cours', options: { fin: true } };
            break;
          case 'valider':
            ecriture.manche = {
              id: manche.id,
              statut: 'en_cours',
              options: { survivants: suite.resultat?.survivants ?? {} },
            };
            for (const [numero, points] of Object.entries(suite.points ?? {})) {
              const equipe = etat.equipes.find((e) => e.numero === Number(numero));
              if (!equipe || points <= 0) continue;
              ecriture.scores.push({
                equipe_id: equipe.id,
                points,
                motif: (manche.options['mode'] === 'jetons' ? motifs.quizJetons : motifs.quiz)(
                  action.survivants[Number(numero)] ?? 0,
                ),
                manche_id: manche.id,
              });
            }
            break;
        }
        return ecriture;
      }

      case 'mime': {
        if (manche?.jeu !== 'mime2' || !passage) return null;
        const suite = appliquerMime(p.etape as EtapeMime, commande.action, ecouleMs);
        Object.assign(ecriture.pilotage, { etape: suite.etape, ...chronoDe(suite.chrono) });
        if (suite.points !== undefined && suite.resultat) {
          ecriture.passage = {
            id: passage.id,
            statut: 'termine',
            resultat: suite.resultat,
            points: suite.points,
          };
          const equipe = etat.equipes.find((e) => e.id === passage.equipe_id);
          if (equipe && suite.points > 0) {
            ecriture.scores.push({
              equipe_id: equipe.id,
              points: suite.points,
              motif: motifs.mime(equipe.nom),
              manche_id: manche.id,
            });
          }
        }
        return ecriture;
      }

      case 'duel': {
        if (!estDuel(manche?.jeu) || !manche || !passage) return null;
        const suite = appliquerDuel(
          manche.jeu,
          p.etape as EtapeDuel,
          commande.action,
          duellistesDe(passage.resultat),
        );
        Object.assign(ecriture.pilotage, { etape: suite.etape, ...chronoDe(suite.chrono) });
        if (commande.action.type === 'tirer' && suite.resultat) {
          ecriture.passage = { id: passage.id, statut: 'en_cours', resultat: suite.resultat };
        }
        if (suite.points && suite.resultat && suite.resultat.gagnant !== undefined) {
          const points = suite.points;
          const vainqueur = suite.resultat.duellistes[suite.resultat.gagnant];
          ecriture.passage = {
            id: passage.id,
            statut: 'termine',
            resultat: suite.resultat,
            points: Object.values(points).reduce((a, b) => a + b, 0),
          };
          for (const [numero, gagnes] of Object.entries(points)) {
            const equipe = etat.equipes.find((e) => e.numero === Number(numero));
            if (!equipe) continue;
            ecriture.scores.push({
              equipe_id: equipe.id,
              points: gagnes,
              motif: motifs.duel(vainqueur.prenom, equipe.nom),
              manche_id: manche.id,
            });
          }
        }
        return ecriture;
      }

      case 'photo': {
        if (manche?.jeu !== 'photo2' || !passage) return null;
        const avecPhoto = (passage.photos ?? []).flatMap((ph) => {
          const equipe = etat.equipes.find((e) => e.id === ph.equipe_id);
          return equipe ? [equipe.numero] : [];
        });
        const suite = appliquerPhoto(
          p.etape as EtapePhoto,
          commande.action.type === 'gagnante'
            ? { ...commande.action, equipesAvecPhoto: avecPhoto }
            : commande.action,
        );
        Object.assign(ecriture.pilotage, { etape: suite.etape, ...chronoDe(suite.chrono) });
        const points = Object.values(suite.points).reduce((a, b) => a + b, 0);
        ecriture.passage = { id: passage.id, statut: 'termine', resultat: suite.resultat, points };
        for (const [numero, gagnes] of Object.entries(suite.points)) {
          const equipe = etat.equipes.find((e) => e.numero === Number(numero));
          if (!equipe) continue;
          ecriture.scores.push({
            equipe_id: equipe.id,
            points: gagnes,
            motif: motifs.photo(equipe.nom),
            manche_id: manche.id,
          });
        }
        return ecriture;
      }

      case 'devoiler':
      case 'adjuger':
      case 'verdict':
      case 'classer':
      case 'retour': {
        if (manche?.jeu !== 'enchere2') return null;
        const modeS = modeDeLaSurenchere(manche);
        // Chaque mode n'a que ses touches : pas de verdict au téléphone, pas de podium à la voix.
        if (commande.type === 'verdict' && modeS === 'telephones') return null;
        if (commande.type === 'classer' && (modeS !== 'telephones' || !passage)) return null;
        const dejaJoues = manche.passages.filter((x) => x.statut === 'termine').map((x) => x.id);
        // L'équipe du champion joue forcément, même si personne ne l'a rejointe par téléphone.
        const equipesAvecJoueurs = [
          ...new Set([
            ...etat.equipes.filter((e) => e.joueurs > 0).map((e) => e.numero),
            ...(commande.type === 'verdict' ? [commande.equipeChampion] : []),
          ]),
        ];
        const action: ActionSurenchere =
          commande.type === 'devoiler'
            ? { type: 'devoiler', passageId: commande.passageId }
            : commande.type === 'adjuger'
              ? { type: 'adjuger', chronoS: chronoSurenchere(manche, modeS) }
              : commande.type === 'verdict'
                ? {
                    type: 'verdict',
                    tenu: commande.tenu,
                    equipeChampion: commande.equipeChampion,
                    equipesAvecJoueurs,
                  }
                : commande.type === 'classer' && passage
                  ? { type: 'classer', comptes: comptesDesMots(passage) }
                  : { type: 'retour' };
        const suite = appliquerSurenchere(
          { etape: p.etape as EtapeSurenchere, passageId: p.passage_id },
          action,
          dejaJoues,
        );
        Object.assign(ecriture.pilotage, {
          passage_id: suite.etat.passageId,
          etape: suite.etat.etape,
          ...chronoDe(suite.chrono),
        });
        if (commande.type === 'devoiler') {
          ecriture.passage = { id: commande.passageId, statut: 'en_cours' };
        }
        if (suite.points && suite.resultat && passage) {
          const points = suite.points;
          ecriture.passage = {
            id: passage.id,
            statut: 'termine',
            resultat: suite.resultat,
            points: Object.values(points).reduce((a, b) => a + b, 0),
          };
          const resultat = suite.resultat;
          for (const [numero, gagnes] of Object.entries(points)) {
            const equipe = etat.equipes.find((e) => e.numero === Number(numero));
            if (!equipe) continue;
            ecriture.scores.push({
              equipe_id: equipe.id,
              points: gagnes,
              motif:
                'mode' in resultat
                  ? motifs.podiumMots(
                      resultat.rangs[Number(numero)] ?? 0,
                      resultat.comptes[Number(numero)] ?? 0,
                    )
                  : resultat.tenu
                    ? motifs.tenu
                    : motifs.rate,
              manche_id: manche.id,
            });
          }
        }
        return ecriture;
      }

      case 'terminer': {
        if (!manche) return null;
        ecriture.manche = { id: manche.id, statut: 'terminee' };
        // Plus de classement d'office (2026-10-22) : le programme, jeu coché ; la régie montre
        // le classement quand elle le décide.
        ecriture.pilotage = {
          scene: 'programme',
          manche_id: null,
          passage_id: null,
          etape: null,
          indices: 0,
          chrono: 'arreter',
        };
        return ecriture;
      }
    }
  } catch {
    // Les règles de packages/game refusent la touche à cette étape.
    return null;
  }
}
