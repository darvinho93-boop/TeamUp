'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@teamup/ui/react';
import type { GameCode } from '@teamup/game';
import { ListeJeux } from '@/carte/ListeJeux';

/**
 * L'onglet Les jeux : le programme réel de la soirée, dans son ordre, chaque règle s'ouvrant au
 * toucher avec sa vidéo (`ListeJeux`), puis à quoi sert le téléphone. Une équipe formée se
 * rejoint d'un appui, sans parcourir la liste.
 */
export function Explication({
  programme,
  voirEquipe,
}: {
  programme: GameCode[];
  voirEquipe?: () => void;
}) {
  const t = useTranslations();
  const jeux = [...new Set(programme)];
  return (
    <div className="tu-player__body" data-testid="explication">
      <h1 className="tu-player__title">{t('parcours.jeux.titre')}</h1>
      {voirEquipe && (
        <Button variant="outline" size="lg" block onClick={voirEquipe}>
          {t('parcours.partie.voirEquipe')}
        </Button>
      )}
      {jeux.length > 0 ? (
        <>
          <h2 className="tu-player__subtitle">{t('explication.jeux')}</h2>
          <ListeJeux jeux={jeux} niveau="h3" repliable />
        </>
      ) : (
        <p className="tu-player__lead" data-testid="programme-vide">
          {t('parcours.jeux.vide')}
        </p>
      )}
      <details className="tu-role-info">
        <summary>{t('explication.telephone')}</summary>
        <p>{t('explication.telephoneAide')}</p>
        <p>{t('explication.reseau')}</p>
      </details>
    </div>
  );
}
