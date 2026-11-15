import { domaineDuCookie } from './cookies';
import { COOKIE_LANGUE, type Langue } from './partie';

const UN_AN_S = 365 * 24 * 60 * 60;

/**
 * La langue suit le navigateur d'une page à l'autre : le serveur la lit pour choisir les textes.
 * Posée pour tout `teamup-game.fr` (lot 15), elle suit aussi l'invité sur la machine de la salle.
 */
export function memoriserLangue(langue: Langue) {
  const domaine = domaineDuCookie(window.location.hostname);
  // Un ancien cookie posé pour la seule adresse passerait avant celui du domaine : il part.
  if (domaine) document.cookie = `${COOKIE_LANGUE}=; path=/; max-age=0`;
  document.cookie = `${COOKIE_LANGUE}=${langue}; path=/; max-age=${UN_AN_S}; samesite=lax${domaine ? `; domain=${domaine}` : ''}`;
}

/** Chaque langue se nomme dans sa propre langue. */
export const NOMS_LANGUES: Record<Langue, string> = {
  fr: 'Français',
  en: 'English',
  ta: 'தமிழ்',
};

/**
 * Le drapeau d'une langue, pour trouver d'un coup d'œil où la changer (2026-11-02). Le tamoul
 * n'en a pas : il se parle dans plusieurs pays, son écriture suffit à le reconnaître.
 */
export const DRAPEAUX: Record<Langue, string | null> = {
  fr: '🇫🇷',
  en: '🇬🇧',
  ta: null,
};

/** Le nom d'une langue, précédé de son drapeau quand elle en a un (menu de la langue). */
export function libelleLangue(langue: Langue): string {
  const drapeau = DRAPEAUX[langue];
  return drapeau ? `${drapeau} ${NOMS_LANGUES[langue]}` : NOMS_LANGUES[langue];
}
