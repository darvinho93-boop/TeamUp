'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const SECTIONS = ['preparation', 'salle', 'pilotage', 'scores'] as const;

export function NavEvenement({ code }: { code: string }) {
  const t = useTranslations('regie.nav');
  const chemin = usePathname();
  return (
    <nav aria-label={t('libelle')}>
      <ul className="tu-regie__nav">
        {SECTIONS.map((section) => {
          const href = `/regie/${code}/${section}` as const;
          return (
            <li key={section}>
              <Link
                href={href}
                className="tu-regie__nav-link"
                aria-current={chemin === href ? 'page' : undefined}
              >
                {t(section)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
