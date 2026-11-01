import type { ReactNode } from 'react';
import { Wordmark } from '@teamup/ui/react';
import { Pictogramme } from '@/marque/Pictogramme';

/** Gabarit commun de l'écran joueur : le logotype en haut (et la langue en face), une colonne, l'action en bas. */
export function Cadre({
  children,
  bandeau,
  outil,
}: {
  children: ReactNode;
  bandeau?: ReactNode;
  /** En face du logo : le choix de la langue. */
  outil?: ReactNode;
}) {
  return (
    <>
      {bandeau}
      <main className="tu-player">
        <header className="tu-player__head">
          <span className="tu-marque">
            <Pictogramme />
            <Wordmark />
          </span>
          {outil}
        </header>
        {children}
      </main>
    </>
  );
}
