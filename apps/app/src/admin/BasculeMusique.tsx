'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@teamup/ui/react';
import { BoutonConfirme } from '@/regie/BoutonConfirme';
import { basculerMusique } from '@/app/admin/musiques/actions';

/** Désactiver (confirmé, deux appuis) ou réactiver une musique de la bibliothèque. */
export function BasculeMusique({
  id,
  titre,
  actif,
}: {
  id: string;
  titre: string;
  actif: boolean;
}) {
  const t = useTranslations('admin.musiques');
  const [enCours, demarrer] = useTransition();
  const [echec, setEchec] = useState(false);
  const basculer = () =>
    demarrer(async () => {
      setEchec(!(await basculerMusique(id, !actif)));
    });

  return (
    <>
      {actif ? (
        <BoutonConfirme
          variant="ghost"
          confirmation={t('confirmerDesactiver', { titre })}
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
      {echec && (
        <p className="tu-regie__alert" role="alert">
          {t('erreur.echec')}
        </p>
      )}
    </>
  );
}
