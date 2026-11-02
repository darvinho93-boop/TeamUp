'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { memoriserLangue } from '@/lib/langue-navigateur';
import { LANGUES, type Langue } from '@/lib/partie';
import { Cadre } from '@/joueur/Cadre';
import { ChoixLangueJoueur } from '@/joueur/ChoixLangueJoueur';
import type { OngletCarte } from './liens';

/** Les onglets, chacun avec son pictogramme au trait (`currentColor`). */
const ONGLETS: {
  id: OngletCarte;
  href: string;
  cle: 'navSoirees' | 'navJeux' | 'navComment' | 'navNous';
  trace: ReactNode;
}[] = [
  {
    id: 'soirees',
    href: '/soirees',
    cle: 'navSoirees',
    trace: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2.5" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    id: 'jeux',
    href: '/soirees/jeux',
    cle: 'navJeux',
    trace: (
      <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
        <path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" />
      </>
    ),
  },
  {
    id: 'comment',
    href: '/soirees/comment-jouer',
    cle: 'navComment',
    trace: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4M12 17h.01" />
      </>
    ),
  },
  {
    id: 'nous',
    href: '/soirees/qui-sommes-nous',
    cle: 'navNous',
    // L'équipe : trois personnages, celui du milieu devant (comme ceux du jeu).
    trace: (
      <>
        <circle cx="12" cy="7.5" r="3" />
        <path d="M6.5 20v-1a5.5 5.5 0 0 1 11 0v1" />
        <circle cx="5" cy="9.5" r="2" />
        <path d="M1.5 19v-.5a3.5 3.5 0 0 1 4.6-3.3" />
        <circle cx="19" cy="9.5" r="2" />
        <path d="M22.5 19v-.5a3.5 3.5 0 0 0-4.6-3.3" />
      </>
    ),
  },
];

/**
 * Gabarit des pages de la carte Team Up! : la langue en tête (drapeaux), les quatre onglets
 * (l'événement du jour, les jeux, comment on y joue, qui sommes-nous), puis la page.
 */
export function CadreCarte({ actif, children }: { actif: OngletCarte; children: ReactNode }) {
  const t = useTranslations('carte');
  const router = useRouter();
  const choisir = (langue: Langue) => {
    memoriserLangue(langue);
    router.refresh();
  };

  return (
    <Cadre outil={<ChoixLangueJoueur langues={[...LANGUES]} choisir={choisir} />}>
      <nav className="tu-carte-nav" aria-label={t('navigation')}>
        {ONGLETS.map((o) => (
          <Link
            key={o.id}
            href={o.href}
            className="tu-carte-nav__lien"
            aria-current={o.id === actif ? 'page' : undefined}
          >
            <svg className="tu-carte-nav__icone" viewBox="0 0 24 24" aria-hidden="true">
              {o.trace}
            </svg>
            {t(o.cle)}
          </Link>
        ))}
      </nav>
      {children}
    </Cadre>
  );
}
