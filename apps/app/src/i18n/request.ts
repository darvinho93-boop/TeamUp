import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { estLangue, type Langue } from '@/lib/partie';

/** Langue choisie par le joueur, mémorisée dans un cookie lisible par le navigateur. */
export const COOKIE_LANGUE = 'tu_langue';

/**
 * Pas de préfixe de langue dans l'URL : le code de salle doit rester court (`/K7P2M9`).
 * Chaque joueur choisit la sienne, le français reste le défaut.
 */
export default getRequestConfig(async () => {
  const choisie = (await cookies()).get(COOKIE_LANGUE)?.value;
  const locale: Langue = estLangue(choisie) ? choisie : 'fr';
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
