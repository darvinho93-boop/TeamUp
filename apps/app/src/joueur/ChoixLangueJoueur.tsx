'use client';

import { useLocale, useTranslations } from 'next-intl';
import { libelleLangue } from '@/lib/langue-navigateur';
import { estLangue, type Langue } from '@/lib/partie';

/**
 * Langue du téléphone, changeable à tout moment, parmi celles de la soirée. Rien à choisir
 * quand la soirée n'en a qu'une : le sélecteur ne paraît pas.
 */
export function ChoixLangueJoueur({
  langues,
  choisir,
}: {
  langues: Langue[];
  choisir: (langue: Langue) => void;
}) {
  const t = useTranslations('commun');
  const locale = useLocale();
  if (langues.length < 2) return null;
  return (
    <select
      className="tu-player__langue"
      aria-label={t('langue')}
      value={locale}
      lang={locale}
      onChange={(e) => {
        if (estLangue(e.target.value) && e.target.value !== locale) choisir(e.target.value);
      }}
    >
      {langues.map((l) => (
        <option key={l} value={l} lang={l}>
          {libelleLangue(l)}
        </option>
      ))}
    </select>
  );
}
