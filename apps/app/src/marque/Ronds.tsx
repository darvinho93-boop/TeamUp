import { Wordmark } from '@teamup/ui/react';
import { Pictogramme } from './Pictogramme';

const TEINTES = ['navy', 'corail', 'sable', 'vert'] as const;

/**
 * Les quatre ronds du teaser, aux couleurs des personnages du logo.
 * - `boucle` (scène d'ouverture) : ils apparaissent, se rejoignent en tournant, deviennent le
 *   pictogramme, se remettent en cercle et se dispersent, sans fin.
 * - `finale` (avant la page du QR code) : une dernière passe au même rythme, qui s'arrête sur le
 *   logo Team Up!, nom compris.
 * - `coin` (en haut à droite de chaque scène, 2026-10-22) : en petit, le pictogramme se forme,
 *   reste longtemps, puis les ronds repartent, sans fin.
 * Tout le mouvement est en CSS (`ouverture.css`) ; sans mouvement, le pictogramme seul.
 */
export function Ronds({ mode }: { mode: 'boucle' | 'finale' | 'coin' }) {
  return (
    <div className={`tu-ronds tu-ronds--${mode}`} aria-hidden="true">
      <div className="tu-ronds__ronde">
        {TEINTES.map((teinte) => (
          <span key={teinte} className={`tu-rond tu-rond--${teinte}`} />
        ))}
      </div>
      <div className="tu-ronds__logo">
        <Pictogramme taille={mode === 'coin' ? 'coin' : 'lg'} />
        {mode === 'finale' && <Wordmark className="tu-ronds__nom" />}
      </div>
    </div>
  );
}
