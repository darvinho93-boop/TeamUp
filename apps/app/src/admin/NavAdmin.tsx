'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const SECTIONS = ['contenus', 'animateurs', 'evenements'] as const;

export function NavAdmin() {
  const t = useTranslations('admin.nav');
  const chemin = usePathname();
  return (
    <nav aria-label={t('libelle')}>
      <ul className="tu-regie__nav">
        {SECTIONS.map((section) => {
          const href = `/admin/${section}` as const;
          return (
            <li key={section}>
              <Link
                href={href}
                className="tu-regie__nav-link"
                aria-current={chemin.startsWith(href) ? 'page' : undefined}
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
