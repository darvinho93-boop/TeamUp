'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@teamup/ui/react';
import { tirerCapitaines } from '@/app/regie/[code]/salle/actions';
import { useSignalSalle } from './SignalSalle';

/**
 * Tire un capitaine dans chaque équipe qui n'en a pas, parmi les volontaires de l'arrivée
 * d'abord. À lancer quand tout le monde est là ; on peut relancer après de nouvelles arrivées.
 */
export function TirerCapitaines({ code }: { code: string }) {
  const t = useTranslations('regie.salle');
  const [enCours, demarrer] = useTransition();
  const [tires, setTires] = useState<number | null>(null);
  const signaler = useSignalSalle();
  return (
    <div className="tu-cluster">
      <Button
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            setTires(await tirerCapitaines(code));
            signaler();
          })
        }
      >
        {t('tirer')}
      </Button>
      <span className="tu-regie__muted" role="status">
        {tires === null ? '' : t('tires', { n: tires })}
      </span>
    </div>
  );
}
