/**
 * Ce que le téléphone sait d'une partie. Partagé entre le serveur et les écrans :
 * aucun secret n'a sa place ici, il n'en transite aucun par ces formes.
 */

import type { GameCode } from '@teamup/game';

export const LANGUES = ['fr', 'en', 'ta'] as const;
export type Langue = (typeof LANGUES)[number];

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
}

export interface EtatJoueur {
  joueur: { id: string; prenom: string; langue: Langue; capitaine: boolean };
  evenement: {
    code: string;
    statut: 'preparation' | 'repetition' | 'en_cours' | 'termine';
    langues: Langue[];
    photos_closes: boolean;
  };
  equipe: { id: string; numero: number; nom: string; points: number } | null;
  manche: { jeu: GameCode; ordre: number } | null;
  prochaine: { jeu: GameCode; ordre: number } | null;
}

/** Réponses d'erreur des routes de la partie : le client les traduit. */
export type ErreurPartie = 'code_inconnu' | 'complet' | 'langue' | 'prenom' | 'serveur';
