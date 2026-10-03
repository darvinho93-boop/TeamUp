/**
 * Ce que le téléphone sait d'une partie. Partagé entre le serveur et les écrans :
 * aucun secret n'a sa place ici, il n'en transite aucun par ces formes.
 */

import type { GameCode } from '@teamup/game';

export const LANGUES = ['fr', 'en', 'ta'] as const;
export type Langue = (typeof LANGUES)[number];

/** Langue choisie par le joueur : un cookie lisible par le navigateur, qui la pose lui-même. */
export const COOKIE_LANGUE = 'tu_langue';

export function estLangue(valeur: unknown): valeur is Langue {
  return (LANGUES as readonly unknown[]).includes(valeur);
}

/** Code de salle : 6 caractères, sans I, O, 0 ni 1 (même règle que la base). */
const FORMAT_CODE = /^[A-HJ-NP-Z2-9]{6}$/;

/** Le code tel que tapé ou scanné, en majuscules ; `null` s'il ne peut pas exister. */
export function normaliserCode(brut: string): string | null {
  const code = brut.trim().toUpperCase();
  return FORMAT_CODE.test(code) ? code : null;
}

export interface EvenementPublic {
  code: string;
  langues: Langue[];
  statut: 'preparation' | 'repetition' | 'en_cours';
  /** Groupes à mélanger (lot 11), dans l'ordre de la préparation ; vide sans groupes. */
  groupes: GroupePublic[];
}

export interface GroupePublic {
  id: string;
  nom: string;
}

/**
 * Le quiz vu par un téléphone, en mode téléphone seulement (`null` en mode croix). La bonne
 * réponse n'arrive qu'une fois révélée à la salle : la base ne l'envoie pas avant.
 */
export interface QuizJoueur {
  serveur_ms: number;
  etape: 'pret' | 'question' | 'reponse' | 'survivants' | 'resultat';
  passage_id: string | null;
  numero: number | null;
  total: number;
  chrono_depart_ms: number | null;
  chrono_duree_s: number | null;
  question: { question: string; propositions: string[] } | null;
  ma_reponse: number | null;
  bonne: number | null;
  /** Arrivé après la première question : il regarde. */
  participant: boolean;
  elimine: boolean;
}

/**
 * Le photo challenge vu par un téléphone : les thèmes dans sa langue et l'heure d'envoi de la
 * photo de son équipe pour chacun. Aucune image ne descend vers un téléphone.
 */
export interface PhotosJoueur {
  closes: boolean;
  themes: { theme_id: string; theme: string | null; envoyee_le: number | null }[];
}

export interface EtatJoueur {
  joueur: { id: string; prenom: string; langue: Langue; capitaine: boolean };
  evenement: {
    /** Canal du signal temps réel de la salle ; ne donne accès à rien d'autre. */
    id: string;
    code: string;
    statut: 'preparation' | 'repetition' | 'en_cours' | 'termine';
    langues: Langue[];
    photos_closes: boolean;
  };
  equipe: { id: string; numero: number; nom: string; points: number } | null;
  manche: { jeu: GameCode; ordre: number } | null;
  prochaine: { jeu: GameCode; ordre: number } | null;
  quiz: QuizJoueur | null;
  /** `null` tant que la soirée n'a pas de manche photo. */
  photos: PhotosJoueur | null;
}

/** Réponses d'erreur des routes de la partie : le client les traduit. */
export type ErreurPartie = 'code_inconnu' | 'complet' | 'langue' | 'prenom' | 'serveur';

/** Refus d'une réponse au quiz, dans l'ordre où la base les vérifie. */
export type RefusQuiz = 'session' | 'fermee' | 'spectateur' | 'elimine' | 'deja';

/** Refus d'un envoi photo. Tous définitifs, sauf `serveur` : la file d'attente réessaiera. */
export type RefusPhoto = 'session' | 'capitaine' | 'close' | 'theme' | 'fichier';

/** Plafond d'une photo compressée, sous la limite du bucket (5 Mo) et du corps Vercel (4,5 Mo). */
export const TAILLE_MAX_PHOTO = 4 * 1024 * 1024;
