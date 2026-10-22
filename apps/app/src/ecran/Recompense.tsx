import { cx } from '@teamup/ui/react';

/**
 * Coupe pour la première place, médaille pour la deuxième et la troisième (2026-10-22). Dessins
 * simples en `currentColor` : la couleur (or, argent, bronze) vient de la feuille de style.
 */
export function Recompense({ place, className }: { place: 1 | 2 | 3; className?: string }) {
  return (
    <svg
      className={cx('tu-recompense', `tu-recompense--${place}`, className)}
      viewBox="0 0 64 64"
      aria-hidden="true"
      data-testid={`recompense-${place}`}
    >
      {place === 1 ? (
        <>
          {/* Coupe : la vasque, ses deux anses, le pied et le socle. */}
          <path
            fill="currentColor"
            d="M18 6h28v14c0 9-6 16-14 16s-14-7-14-16V6Zm-8 4h8v4h-4c0 5 2 8 5 9l-1 4c-5-1-8-6-8-13v-4Zm44 0h-8v4h4c0 5-2 8-5 9l1 4c5-1 8-6 8-13v-4ZM28 36h8v10h-8V36Zm-8 12h24v6H20v-6Zm-4 8h32v4H16v-4Z"
          />
          <path className="tu-recompense__reflet" d="M23 10h4v12c0 4 1 7 3 9-5-1-7-5-7-9V10Z" />
        </>
      ) : (
        <>
          {/* Médaille : le ruban, puis le disque et son chiffre. */}
          <path
            className="tu-recompense__ruban"
            d="M18 2h10l6 20h-10L18 2Zm28 0H36l-6 20h10l6-20Z"
          />
          <circle fill="currentColor" cx="32" cy="40" r="20" />
          <circle className="tu-recompense__reflet" cx="32" cy="40" r="14" />
          <text className="tu-recompense__chiffre" x="32" y="47" textAnchor="middle">
            {place}
          </text>
        </>
      )}
    </svg>
  );
}
