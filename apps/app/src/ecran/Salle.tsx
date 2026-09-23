'use client';

import { NextIntlClientProvider } from 'next-intl';
import { cx } from '@teamup/ui/react';
import { MESSAGES } from '@/i18n/messages';
import type { EtatSalle } from '@/lib/salle';
import { Scene } from './Scenes';

/**
 * L'écran de la salle, dans la première langue de la soirée quelle que soit celle du navigateur
 * qui l'affiche : c'est la langue de la salle, pas celle de l'animateur. Les contenus, eux, sont
 * dans toutes les langues de la soirée.
 */
export function Salle({
  etat,
  decalageMs,
  qrSvg,
  adresse,
  apercu = false,
}: {
  etat: EtatSalle;
  decalageMs: number;
  qrSvg: string;
  adresse: string;
  /** Rendu réduit dans la régie : même composant, même contenu que l'écran projeté. */
  apercu?: boolean;
}) {
  const langue = etat.evenement.langues[0] ?? 'fr';
  return (
    <NextIntlClientProvider locale={langue} messages={MESSAGES[langue]}>
      <div
        className={cx('tu-stage', apercu && 'tu-stage--apercu')}
        data-theme="stage"
        lang={langue}
        aria-hidden={apercu || undefined}
      >
        <Scene etat={etat} decalageMs={decalageMs} qrSvg={qrSvg} adresse={adresse} />
      </div>
    </NextIntlClientProvider>
  );
}
