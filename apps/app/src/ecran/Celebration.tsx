import { useState, type CSSProperties } from 'react';
import { cx } from '@teamup/ui/react';

/** 1 : la plus forte (mot trouvé au premier palier, vainqueur du podium) ; 3 : la plus légère. */
export type Force = 1 | 2 | 3;

const CONFETTIS: Record<Force, number> = { 1: 70, 2: 45, 3: 28 };
const FEUX: Record<Force, number> = { 1: 5, 2: 2, 3: 0 };
const ETINCELLES = 12;

/** Un tirage fixe par indice : deux écrans, ou un rendu serveur, dessinent la même pluie. */
function fraction(i: number, sel: number): number {
  const x = Math.sin((i + 1) * 12.9898 + sel * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Vrai quand `actif` vient de passer à vrai sous les yeux de cet écran : ni au premier rendu
 * (un écran rechargé sur un verdict ne refait pas la fête), ni quand il repasse à faux.
 */
export function useArrivee(actif: boolean): boolean {
  const [avant, setAvant] = useState(actif);
  const [vu, setVu] = useState(false);
  if (actif !== avant) {
    setAvant(actif);
    setVu(actif);
  }
  return vu;
}

/**
 * Confettis et feux d'artifice par-dessus la scène, en CSS seulement (`celebration.css`), une
 * fois ; rien sous `prefers-reduced-motion`. Couleurs d'équipe, jamais le corail.
 */
export function Celebration({ force, className }: { force: Force; className?: string }) {
  return (
    <div className={cx('tu-celebration', className)} aria-hidden="true" data-testid="celebration">
      {Array.from({ length: FEUX[force] }, (_, i) => (
        <span
          key={`feu-${i}`}
          className="tu-feu"
          style={
            {
              '--x': 0.15 + 0.7 * fraction(i, 1),
              '--y': 0.15 + 0.35 * fraction(i, 2),
              '--delai': i / Math.max(1, FEUX[force]),
            } as CSSProperties
          }
        >
          {Array.from({ length: ETINCELLES }, (_, j) => (
            <span
              key={j}
              className="tu-feu__etincelle"
              style={{ '--angle': `${(360 / ETINCELLES) * j}deg` } as CSSProperties}
            />
          ))}
        </span>
      ))}
      {Array.from({ length: CONFETTIS[force] }, (_, i) => (
        <span
          key={`confetti-${i}`}
          className="tu-confetti"
          style={
            {
              '--x': fraction(i, 3),
              '--delai': fraction(i, 4),
              '--derive': fraction(i, 5) * 2 - 1,
              '--tour': fraction(i, 6),
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
