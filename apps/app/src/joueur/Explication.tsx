'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@teamup/ui/react';
import type { GameCode } from '@teamup/game';

/**
 * La page lue à l'inscription (lot 14) : comment se passe la soirée, la règle de chaque jeu du
 * programme (les mêmes que l'écran commun), à quoi sert le téléphone, et rester sur le wifi de
 * la soirée pour jouer. On peut la rouvrir depuis l'écran d'attente.
 */
export function Explication({ programme, retour }: { programme: GameCode[]; retour: () => void }) {
  const t = useTranslations();
  const jeux = [...new Set(programme)];
  return (
    <div className="tu-player__body" data-testid="explication">
      <h1 className="tu-player__title">{t('explication.titre')}</h1>
      <p className="tu-player__lead">{t('explication.deroule')}</p>
      {jeux.length > 0 && (
        <>
          <h2 className="tu-player__subtitle">{t('explication.jeux')}</h2>
          <ul className="tu-player__list">
            {jeux.map((jeu) => (
              <li key={jeu}>
                <strong>{t(`jeux.${jeu}`)}</strong> — {t(`ecran.regles.${jeu}`)}
              </li>
            ))}
          </ul>
        </>
      )}
      <h2 className="tu-player__subtitle">{t('explication.telephone')}</h2>
      <p className="tu-player__lead">{t('explication.telephoneAide')}</p>
      <p className="tu-player__lead">{t('explication.reseau')}</p>
      <div className="tu-player__actions">
        <Button variant="accent" size="lg" block onClick={retour} data-testid="c-est-parti">
          {t('explication.bouton')}
        </Button>
      </div>
    </div>
  );
}
