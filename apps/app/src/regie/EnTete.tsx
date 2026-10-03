import type { ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@teamup/ui/react';
import { deconnecter } from '@/app/regie/actions';
import { ChoixLangue } from './ChoixLangue';
import { NavEvenement } from './NavEvenement';

/**
 * En-tête de la régie et du back-office : logotype, événement en cours et ses sections (ou celles
 * du back-office), compte, langue, déconnexion.
 */
export async function EnTete({
  evenement,
  admin = false,
  nav,
}: {
  evenement?: { code: string; client_nom: string };
  /** Le compte est admin : lien vers le back-office. */
  admin?: boolean;
  /** Navigation propre à la page, à la place de celle d'un événement. */
  nav?: ReactNode;
}) {
  const t = await getTranslations('regie');
  return (
    <header className="tu-regie__head">
      <Link href="/regie" aria-label={t('accueil')}>
        <Wordmark />
      </Link>
      {evenement && (
        <>
          <p className="tu-regie__event">
            <span>{evenement.client_nom}</span>
            <span className="tu-regie__code">{evenement.code}</span>
          </p>
          <NavEvenement code={evenement.code} />
        </>
      )}
      {nav}
      <div className="tu-regie__tools">
        {admin && (
          <Link href="/admin" className="tu-btn tu-btn--ghost">
            {t('backOffice')}
          </Link>
        )}
        <Link href="/regie/compte" className="tu-btn tu-btn--ghost">
          {t('compte.lien')}
        </Link>
        <ChoixLangue />
        <form action={deconnecter}>
          <button type="submit" className="tu-btn tu-btn--ghost">
            {t('deconnexion')}
          </button>
        </form>
      </div>
    </header>
  );
}
