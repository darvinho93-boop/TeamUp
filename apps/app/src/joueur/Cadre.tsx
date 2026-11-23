import type { ReactNode } from 'react';
import { cx, Wordmark } from '@teamup/ui/react';
import { Pictogramme } from '@/marque/Pictogramme';

/** Gabarit commun de l'écran joueur : le logotype en haut (et la langue en face), une colonne, la navigation en bas une fois inscrit. */
export function Cadre({
  children,
  bandeau,
  outil,
  navigation,
}: {
  children: ReactNode;
  bandeau?: ReactNode;
  /** En face du logo : le choix de la langue. */
  outil?: ReactNode;
  /** La barre du bas (parcours joueur, 2026-11-23) : le contenu lui réserve sa place. */
  navigation?: ReactNode;
}) {
  return (
    <>
      {bandeau}
      <main className={cx('tu-player', navigation ? 'tu-player--navigation' : undefined)}>
        <header className="tu-player__head">
          <span className="tu-marque">
            <Pictogramme />
            <Wordmark />
          </span>
          {outil}
        </header>
        {children}
      </main>
      {navigation}
    </>
  );
}
