'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@teamup/ui/react';
import { BoutonConfirme } from '@/regie/BoutonConfirme';
import { basculerAnimateur } from '@/app/admin/animateurs/actions';

/** Désactiver (confirmé, deux appuis) ou réactiver un compte. */
export function BasculeAnimateur({ id, nom, actif }: { id: string; nom: string; actif: boolean }) {
  const t = useTranslations('admin.animateurs');
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const basculer = () =>
    demarrer(async () => {
      setErreur(await basculerAnimateur(id, !actif));
    });

  return (
    <>
      {actif ? (
        <BoutonConfirme
          variant="ghost"
          confirmation={t('confirmerDesactiver', { nom })}
          onConfirm={basculer}
          disabled={enCours}
        >
          {t('desactiver')}
        </BoutonConfirme>
      ) : (
        <Button variant="ghost" onClick={basculer} disabled={enCours}>
          {t('reactiver')}
        </Button>
      )}
      {erreur && (
        <p className="tu-regie__alert" role="alert">
          {erreur}
        </p>
      )}
    </>
  );
}
