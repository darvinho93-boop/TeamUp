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
  dureeExplicationS,
  DUREE_TIRAGE_S,
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
  type ModeQuiz,
  type ScoresParEquipe,
  type ScriptExplication,
} from '@teamup/game';
import {
  mancheCourante,
  passageCourant,
  type EtatSalle,
  type MancheSalle,
  type Scene,
} from './salle';

export type Commande =
  | { type: 'scene'; scene: Exclude<Scene, 'intro' | 'jeu'> }
  | { type: 'intro'; mancheId: string }
  | { type: 'expliquer'; telephone?: boolean }
  | { type: 'arreterExplication' }
  /** L'ordre tiré par la régie (lot 13) : les ids des passages de la manche, dans l'ordre. */
  | { type: 'tirerOrdre'; passages: string[] }
  | { type: 'commencer'; mode?: ModeQuiz }
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
  | { type: 'devoiler'; passageId: string }
  | { type: 'adjuger' }
  | { type: 'verdict'; tenu: boolean; equipeChampion: number }
  | { type: 'retour' }
  | { type: 'terminer' };

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
  quiz: (survivants: number) => string;
  mime: (equipe: string) => string;
  photo: (equipe: string) => string;
  duel: (prenom: string, equipe: string) => string;
}

/**
 * Explication animée (lot 12) : une étape de la scène intro, `explication` ou, pour le Quiz
 * en mode téléphone, `explication-telephone`. Le chrono de la salle en donne le départ.
 */
const ETAPE_EXPLICATION = 'explication';
const ETAPE_EXPLICATION_TELEPHONE = 'explication-telephone';

/** Le script que l'écran doit jouer, ou `null` hors explication. */
export function scriptEnCours(
  jeu: GameCode | undefined,
  scene: Scene,
  etape: string | null,
): ScriptExplication | null {
  if (!jeu || scene !== 'intro') return null;
  if (etape === ETAPE_EXPLICATION) return scriptExplication(jeu);
  if (etape === ETAPE_EXPLICATION_TELEPHONE && jeu === 'qcm2') return scriptExplication(jeu, true);
  return null;
}

/** Tirage de l'ordre de passage en direct (lot 13) : une étape de l'intro, animée à l'écran. */
export const ETAPE_TIRAGE_ORDRE = 'tirage-ordre';

/** Les jeux qui se jouent une équipe à la fois : leur ordre de passage se tire. */
export const jeuParEquipe = (jeu: string | undefined): boolean =>
  jeu === 'list2' || jeu === 'mime2';

const estDuel = (jeu: string | undefined): jeu is BetaDuel => jeu === 'grab' || jeu === 'cup';

/** Les duellistes tirés pour ce passage, gardés dans son résultat. */
export function duellistesDe(resultat: Record<string, unknown>): [Duelliste, Duelliste] | null {
  const d = resultat['duellistes'];
  return Array.isArray(d) && d.length === 2 ? (d as [Duelliste, Duelliste]) : null;
}

function chronoDe(chrono: Chrono): Pick<Ecriture['pilotage'], 'chrono' | 'chrono_duree_s'> {
  return typeof chrono === 'string'
    ? { chrono }
    : { chrono: 'demarrer', chrono_duree_s: chrono.demarrer };
}

function chronoSurenchere(manche: MancheSalle): number {
  const reglage = manche.options['chrono_s'];
  return typeof reglage === 'number' ? reglage : CHRONO_SURENCHERE_DEFAUT_S;
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
        const telephone = commande.telephone === true && manche.jeu === 'qcm2';
        // Rejouer, c'est la même touche : un nouveau départ, posé par la base.
        ecriture.pilotage.etape = telephone ? ETAPE_EXPLICATION_TELEPHONE : ETAPE_EXPLICATION;
        Object.assign(
          ecriture.pilotage,
          chronoDe({ demarrer: dureeExplicationS(scriptExplication(manche.jeu, telephone)) }),
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
          if (!premiere) return null;
          ecriture.pilotage = { ...base, passage_id: premiere.id, etape: 'pret' };
        } else {
          return null;
        }
        ecriture.manche = {
          id: manche.id,
          statut: 'en_cours',
          // Le mode du quiz se choisit au lancement de la manche (spec v3), la croix d'abord.
          ...(manche.jeu === 'qcm2' ? { options: { mode: commande.mode ?? 'croix' } } : {}),
        };
        ecriture.ouvrirLaSoiree = etat.evenement.statut === 'preparation';
        return ecriture;
      }

      case 'pointsCommuns': {
        if (manche?.jeu !== 'list2' || !passage) return null;
        const suite = appliquerPointsCommuns(
          { etape: p.etape as EtapePointsCommuns, indices: p.indices },
          commande.action,
          ecouleMs,
        );
        Object.assign(ecriture.pilotage, {
          etape: suite.etat.etape,
          indices: suite.etat.indices,
          ...chronoDe(suite.chrono),
        });
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
        const suite = appliquerQuiz(
          { etape: p.etape as EtapeQuiz, resteDesQuestions: suivante !== undefined },
          action,
        );
        Object.assign(ecriture.pilotage, { etape: suite.etape, ...chronoDe(suite.chrono) });
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
                motif: motifs.quiz(action.survivants[Number(numero)] ?? 0),
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
      case 'retour': {
        if (manche?.jeu !== 'enchere2') return null;
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
              ? { type: 'adjuger', chronoS: chronoSurenchere(manche) }
              : commande.type === 'verdict'
                ? {
                    type: 'verdict',
                    tenu: commande.tenu,
                    equipeChampion: commande.equipeChampion,
                    equipesAvecJoueurs,
                  }
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
          for (const [numero, gagnes] of Object.entries(points)) {
            const equipe = etat.equipes.find((e) => e.numero === Number(numero));
            if (!equipe) continue;
            ecriture.scores.push({
              equipe_id: equipe.id,
              points: gagnes,
              motif: suite.resultat.tenu ? motifs.tenu : motifs.rate,
              manche_id: manche.id,
            });
          }
        }
        return ecriture;
      }

      case 'terminer': {
        if (!manche) return null;
        ecriture.manche = { id: manche.id, statut: 'terminee' };
        ecriture.pilotage = {
          scene: 'scores',
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
