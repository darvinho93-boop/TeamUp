import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@teamup/ui/react';
import { deconnecter } from '@/app/regie/actions';
import { ChoixLangue } from './ChoixLangue';
import { NavEvenement } from './NavEvenement';

/** En-tête de la régie : logotype, événement en cours et ses sections, langue, déconnexion. */
export async function EnTete({ evenement }: { evenement?: { code: string; client_nom: string } }) {
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
      <div className="tu-regie__tools">
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
