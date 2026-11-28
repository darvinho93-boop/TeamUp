'use client';

import { useRef, type CSSProperties } from 'react';
import { FINALE } from '@/lib/ouverture';
import { Ronds } from '@/marque/Ronds';
import { useAnimationsCalees } from './useAnimationsCalees';

/**
 * La dernière passe de l'ouverture : les ronds forment le logo Team Up!, le nom paraît, puis la
 * page du QR code, déjà dessous, se découvre. Elle part à `depuisMs` de son début quand elle
 * reprend la boucle au vol (`raccordFinale`) : ses animations et le fondu sont avancés d'autant.
 * Elles se comptent depuis `debutMs` (horloge de `performance.now()`), l'instant sur lequel le
 * reel est calé (2026-11-28).
 */
export function Finale({
  depuisMs = 0,
  debutMs = null,
}: {
  depuisMs?: number;
  debutMs?: number | null;
}) {
  const racine = useRef<HTMLDivElement>(null);
  useAnimationsCalees(racine, debutMs);
  const instants = {
    '--tu-finale-depuis': `${depuisMs}ms`,
    '--tu-finale-qr': `${FINALE.qr - depuisMs}ms`,
    '--tu-finale-fondu': `${FINALE.fin - FINALE.qr}ms`,
  } as CSSProperties;
  return (
    <div
      ref={racine}
      className="tu-finale"
      style={instants}
      data-testid="finale"
      aria-hidden="true"
    >
      <Ronds mode="finale" />
    </div>
  );
}
