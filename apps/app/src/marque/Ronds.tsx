import type { CSSProperties } from 'react';
import { Wordmark } from '@teamup/ui/react';
import { Pictogramme } from './Pictogramme';

const TEINTES = ['navy', 'corail', 'sable', 'vert'] as const;

/**
 * Les quatre ronds du teaser, aux couleurs des personnages du logo.
 * - `boucle` (scène d'ouverture) : ils apparaissent, se rejoignent en tournant, deviennent le
 *   pictogramme, se remettent en cercle et se dispersent, sans fin.
 * - `forme` (tête de la révélation) : ils se rejoignent une fois, en `dureeMs`, et le logo
 *   Team Up! reste, nom compris.
 * Tout le mouvement est en CSS (`ouverture.css`) ; sans mouvement, le pictogramme seul.
 */
export function Ronds({ mode, dureeMs }: { mode: 'boucle' | 'forme'; dureeMs?: number }) {
  return (
    <div
      className={`tu-ronds tu-ronds--${mode}`}
      style={dureeMs ? ({ '--tu-ronds-duree': `${dureeMs}ms` } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      <div className="tu-ronds__ronde">
        {TEINTES.map((teinte) => (
          <span key={teinte} className={`tu-rond tu-rond--${teinte}`} />
        ))}
      </div>
      <div className="tu-ronds__logo">
        <Pictogramme taille="lg" />
        {mode === 'forme' && <Wordmark className="tu-ronds__nom" />}
      </div>
    </div>
  );
}
