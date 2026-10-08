/**
 * L'état de la salle tel que `etat_ecran` le renvoie : ce que l'écran commun affiche et ce
 * que la régie pilote. Les secrets n'y figurent qu'à l'étape qui les montre (sauf en régie).
 */

import type { GameCode, StatutManche, StatutPassage } from '@teamup/game';
import type { Langue } from './partie';

export type Scene = 'accueil' | 'equipes' | 'programme' | 'intro' | 'jeu' | 'scores' | 'podium';

export type Valeurs = Record<string, unknown>;
export type ParLangue = Partial<Record<Langue, Valeurs>>;

export interface PassageSalle {
  id: string;
  ordre: number;
  statut: StatutPassage;
  equipe_id: string | null;
  points: number | null;
  resultat: Valeurs;
  contenu_id: string | null;
  public: ParLangue;
  secret: ParLangue | null;
  /** Quiz : réponses reçues des téléphones pour cette question. */
  reponses?: number | null;
  /** Photo : les photos du thème (régie toujours, écran une fois la diffusion lancée). */
  photos?: PhotoSalle[] | null;
}

export interface PhotoSalle {
  equipe_id: string;
  /** Chemin dans le bucket privé : l'image passe par une URL signée (session animateur). */
  chemin: string;
  envoyee_ms: number;
  gagnante: boolean;
}

export interface MancheSalle {
  id: string;
  jeu: GameCode;
  ordre: number;
  statut: StatutManche;
  options: Valeurs;
  /** Quiz en mode téléphone : survivants par numéro d'équipe, comptés par la base. */
  survivants?: Record<string, number> | null;
  passages: PassageSalle[];
}

export interface EquipeSalle {
  id: string;
  numero: number;
  nom: string;
  points: number;
  joueurs: number;
  prenoms: string[];
  /** Prénom du capitaine ; absent tant que la base n'a pas la migration du 2026-10-09. */
  capitaine?: string | null;
}

export interface EtatSalle {
  serveur_ms: number;
  evenement: {
    id: string;
    code: string;
    langues: Langue[];
    statut: 'preparation' | 'repetition' | 'en_cours' | 'termine';
    client_nom: string;
    creneau_minutes: number;
    photos_closes: boolean;
  };
  pilotage: {
    scene: Scene;
    manche_id: string | null;
    passage_id: string | null;
    etape: string | null;
    indices: number;
    chrono_depart_ms: number | null;
    chrono_duree_s: number | null;
    version: string;
  };
  equipes: EquipeSalle[];
  joueurs: number;
  connectes: number;
  programme: MancheSalle[];
}

export function mancheCourante(etat: EtatSalle): MancheSalle | null {
  return etat.programme.find((m) => m.id === etat.pilotage.manche_id) ?? null;
}

export function passageCourant(etat: EtatSalle): PassageSalle | null {
  const id = etat.pilotage.passage_id;
  return etat.programme.flatMap((m) => m.passages).find((p) => p.id === id) ?? null;
}

export function equipeDe(etat: EtatSalle, id: string | null): EquipeSalle | null {
  return etat.equipes.find((e) => e.id === id) ?? null;
}

/** Classement : points décroissants, numéro d'équipe en cas d'égalité. */
export function classement(etat: EtatSalle): EquipeSalle[] {
  return [...etat.equipes].sort((a, b) => b.points - a.points || a.numero - b.numero);
}

/** Temps écoulé sur le chrono de la salle, à l'horloge de la base (`decalageMs` = base − local). */
export function ecouleMs(etat: EtatSalle, decalageMs: number, maintenant = Date.now()): number {
  const depart = etat.pilotage.chrono_depart_ms;
  return depart === null ? 0 : Math.max(0, maintenant + decalageMs - depart);
}

/**
 * Points communs : l'instant de chaque indice donné (ms depuis le lancement), gardé dans le
 * résultat du passage pendant qu'il se joue. Le temps de jeu s'en déduit (`tempsDeJeu`).
 */
export function indicesMsDe(passage: PassageSalle | null): number[] {
  const instants = passage?.resultat['indices_ms'];
  return Array.isArray(instants) ? instants.filter((i): i is number => typeof i === 'number') : [];
}

/** Un champ texte d'un contenu, dans chaque langue de l'événement qui l'a. */
export function texteParLangue(
  valeurs: ParLangue | null,
  cle: string,
  langues: readonly Langue[],
): { langue: Langue; texte: string }[] {
  if (!valeurs) return [];
  return langues.flatMap((langue) => {
    const texte = valeurs[langue]?.[cle];
    return typeof texte === 'string' && texte ? [{ langue, texte }] : [];
  });
}
