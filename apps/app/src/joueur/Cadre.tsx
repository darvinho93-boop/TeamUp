import type { ReactNode } from 'react';
import { Wordmark } from '@teamup/ui/react';
import { Pictogramme } from '@/marque/Pictogramme';

/** Gabarit commun de l'écran joueur : le logotype en haut, une colonne, l'action en bas. */
export function Cadre({ children, bandeau }: { children: ReactNode; bandeau?: ReactNode }) {
  return (
    <>
      {bandeau}
      <main className="tu-player">
        <header className="tu-player__head">
          <span className="tu-marque">
            <Pictogramme />
            <Wordmark />
          </span>
        </header>
        {children}
      </main>
    </>
  );
}
