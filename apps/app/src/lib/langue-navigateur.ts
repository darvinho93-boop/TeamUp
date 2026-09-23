import { COOKIE_LANGUE, type Langue } from './partie';

const UN_AN_S = 365 * 24 * 60 * 60;

/** La langue suit le navigateur d'une page à l'autre : le serveur la lit pour choisir les textes. */
export function memoriserLangue(langue: Langue) {
  document.cookie = `${COOKIE_LANGUE}=${langue}; path=/; max-age=${UN_AN_S}; samesite=lax`;
}

/** Chaque langue se nomme dans sa propre langue. */
export const NOMS_LANGUES: Record<Langue, string> = {
  fr: 'Français',
  en: 'English',
  ta: 'தமிழ்',
};
