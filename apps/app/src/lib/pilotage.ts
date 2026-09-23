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
  appliquerPointsCommuns,
  appliquerSurenchere,
  CHRONO_SURENCHERE_DEFAUT_S,
  passageSuivant,
  type ActionPointsCommuns,
  type ActionSurenchere,
  type Chrono,
  type EtapePointsCommuns,
  type EtapeSurenchere,
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
  | { type: 'commencer' }
  | { type: 'pointsCommuns'; action: ActionPointsCommuns }
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
  manche: { id: string; statut: 'en_cours' | 'terminee' } | null;
  scores: { equipe_id: string; points: number; motif: string; manche_id: string }[];
  /** La première manche lancée fait passer la soirée « en cours » (les téléphones le voient). */
  ouvrirLaSoiree: boolean;
}

/** Libellés du journal des points, dans la langue de la régie. */
export interface Motifs {
  pointsCommuns: (equipe: string) => string;
  tenu: string;
  rate: string;
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
        } else if (manche.jeu === 'list2') {
          const premier = passageSuivant(manche);
          if (!premier) return null;
          ecriture.pilotage = { ...base, passage_id: premier.id, etape: 'pret' };
          ecriture.passage = { id: premier.id, statut: 'en_cours' };
        } else {
          return null;
        }
        ecriture.manche = { id: manche.id, statut: 'en_cours' };
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
        if (manche?.jeu !== 'list2' || (p.etape !== 'trouve' && p.etape !== 'echec')) return null;
        const suivant = passageSuivant(manche);
        if (!suivant) return null;
        Object.assign(ecriture.pilotage, {
          passage_id: suivant.id,
          etape: 'pret',
          indices: 0,
          chrono: 'arreter',
        });
        ecriture.passage = { id: suivant.id, statut: 'en_cours' };
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
