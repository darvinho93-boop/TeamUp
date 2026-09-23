import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { COOKIE_LANGUE, estLangue, type Langue } from '@/lib/partie';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';
import ta from '../../messages/ta.json';

const MESSAGES = { fr, en, ta } satisfies Record<Langue, typeof fr>;

/**
 * Pas de préfixe de langue dans l'URL : le code de salle doit rester court (`/K7P2M9`).
 * Chaque joueur choisit la sienne, le français reste le défaut.
 */
export default getRequestConfig(async () => {
  const choisie = (await cookies()).get(COOKIE_LANGUE)?.value;
  const locale: Langue = estLangue(choisie) ? choisie : 'fr';
  return { locale, messages: MESSAGES[locale] };
});
