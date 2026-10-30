'use client';

import { useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { cloturerSoiree, rouvrirSoiree } from '@/app/regie/[code]/scores/actions';
import { BoutonConfirme } from './BoutonConfirme';

/**
 * Clôturer la soirée (ou la rouvrir, pour une clôture faite par erreur). Confirmée comme toute
 * action qui touche la salle entière : les téléphones passent sur « La partie est terminée ».
 */
export function ClotureSoiree({
  code,
  cloturee,
  termineLe,
}: {
  code: string;
  cloturee: boolean;
  termineLe: string | null;
}) {
  const t = useTranslations('regie.cloture');
  const format = useFormatter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string>();

  const agir = (action: (code: string) => Promise<{ erreur?: string }>) =>
    demarrer(async () => {
      const { erreur: e } = await action(code);
      setErreur(e);
    });

  return (
    <div className="tu-regie__section" data-testid="cloture">
      {cloturee ? (
        <>
          <p className="tu-regie-item__title" role="status">
            {termineLe
              ? t('cloturee', {
                  heure: format.dateTime(new Date(termineLe), { timeStyle: 'short' }),
                })
              : t('clotureeSansHeure')}
          </p>
          <p className="tu-regie__muted">{t('aideRouvrir')}</p>
          <div>
            <BoutonConfirme
              variant="ghost"
              disabled={enCours}
              confirmation={t('confirmerRouvrir')}
              onConfirm={() => agir(rouvrirSoiree)}
            >
              {t('rouvrir')}
            </BoutonConfirme>
          </div>
        </>
      ) : (
        <>
          <p className="tu-regie__muted">{t('aide')}</p>
          <div>
            <BoutonConfirme
              disabled={enCours}
              confirmation={t('confirmer')}
              onConfirm={() => agir(cloturerSoiree)}
            >
              {t('cloturer')}
            </BoutonConfirme>
          </div>
        </>
      )}
      {erreur && (
        <p className="tu-regie__alert" role="alert">
          {erreur}
        </p>
      )}
    </div>
  );
}
