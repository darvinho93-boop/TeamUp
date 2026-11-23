'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ouvrirMessageEcran } from './MessageEcran';

export type Onglet = 'partie' | 'jeux' | 'equipe' | 'classement';

const ICONES: Record<Onglet, ReactNode> = {
  partie: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9v12h14V9" />
      <path d="M10 21v-6h4v6" />
    </>
  ),
  jeux: (
    <>
      <rect x="2" y="7" width="20" height="12" rx="4" />
      <path d="M7 11v4M5 13h4" />
      <path d="M16 12h.01M18 14h.01" />
    </>
  ),
  equipe: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
      <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14c2.1.8 3.5 3 3.5 6" />
    </>
  ),
  classement: (
    <>
      <path d="M8 21h8M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </>
  ),
};

/**
 * La barre du bas : Ma partie, Les jeux, Message (une action, pas un onglet), Équipe, Classement.
 * Messages fermés, les quatre destinations se partagent toute la largeur.
 */
export function NavigationJoueur({
  onglet,
  choisir,
  messages,
}: {
  onglet: Onglet;
  choisir: (onglet: Onglet) => void;
  messages: boolean;
}) {
  const t = useTranslations();
  const destination = (cle: Onglet) => (
    <button
      type="button"
      className="tu-player-nav__item"
      aria-current={onglet === cle ? 'page' : undefined}
      onClick={() => choisir(cle)}
      data-testid={`onglet-${cle}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {ICONES[cle]}
      </svg>
      <span>{t(`parcours.nav.${cle}`)}</span>
    </button>
  );
  return (
    <nav
      className="tu-player-nav"
      data-colonnes={messages ? 5 : 4}
      aria-label={t('parcours.nav.titre')}
      data-testid="navigation-joueur"
    >
      {destination('partie')}
      {destination('jeux')}
      {messages && (
        <button
          type="button"
          className="tu-player-nav__item tu-player-nav__item--message"
          onClick={ouvrirMessageEcran}
          aria-label={t('messageEcran.ouvrir')}
          data-testid="ouvrir-message"
        >
          <span className="tu-player-nav__bulle" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" />
            </svg>
          </span>
          <span>{t('parcours.nav.message')}</span>
        </button>
      )}
      {destination('equipe')}
      {destination('classement')}
    </nav>
  );
}
