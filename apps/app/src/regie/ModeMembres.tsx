'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@teamup/ui/react';
import { reglerMembres } from '@/app/regie/[code]/salle/actions';
import { useSignalSalle } from './SignalSalle';

export type ModeMembres = 'tous' | 'carrousel';

/**
 * Comment l'écran commun montre les membres des équipes : tous les prénoms d'un coup (la police
 * s'ajuste), ou des pages qui tournent toutes les 5 s. L'écran l'applique aussitôt.
 */
export function ModeMembres({ code, mode }: { code: string; mode: ModeMembres }) {
  const t = useTranslations('regie.salle');
  const [enCours, demarrer] = useTransition();
  const signaler = useSignalSalle();
  const choisir = (choisi: ModeMembres) =>
    demarrer(async () => {
      await reglerMembres(code, choisi);
      signaler();
    });
  return (
    <div className="tu-cluster" role="group" aria-label={t('modeTitre')}>
      <span className="tu-regie__muted">{t('modeTitre')}</span>
      {(['tous', 'carrousel'] as const).map((m) => (
        <Button
          key={m}
          variant={mode === m ? 'primary' : 'ghost'}
          aria-pressed={mode === m}
          disabled={enCours}
          onClick={() => mode !== m && choisir(m)}
        >
          {t(m === 'tous' ? 'modeTous' : 'modeCarrousel')}
        </Button>
      ))}
    </div>
  );
}
