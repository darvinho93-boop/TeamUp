'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { memoriserLangue, NOMS_LANGUES } from '@/lib/langue-navigateur';
import { estLangue, LANGUES } from '@/lib/partie';

/** Langue de la régie, propre à ce navigateur. */
export function ChoixLangue() {
  const t = useTranslations('regie');
  const locale = useLocale();
  const router = useRouter();
  return (
    <select
      aria-label={t('langue')}
      value={locale}
      onChange={(e) => {
        if (!estLangue(e.target.value)) return;
        memoriserLangue(e.target.value);
        router.refresh();
      }}
    >
      {LANGUES.map((l) => (
        <option key={l} value={l} lang={l}>
          {NOMS_LANGUES[l]}
        </option>
      ))}
    </select>
  );
}
