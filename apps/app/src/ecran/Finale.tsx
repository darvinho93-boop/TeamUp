import type { CSSProperties } from 'react';
import { FINALE } from '@/lib/ouverture';
import { Ronds } from '@/marque/Ronds';

/** Le fondu vers la page du QR code, aux instants de `FINALE`. */
const INSTANTS = {
  '--tu-finale-qr': `${FINALE.qr}ms`,
  '--tu-finale-fondu': `${FINALE.fin - FINALE.qr}ms`,
} as CSSProperties;

/**
 * La dernière passe de l'ouverture, une fois la boucle en cours menée à son terme : les ronds
 * forment le logo Team Up!, le nom paraît, puis la page du QR code, déjà dessous, se découvre.
 */
export function Finale() {
  return (
    <div className="tu-finale" style={INSTANTS} data-testid="finale" aria-hidden="true">
      <Ronds mode="finale" />
    </div>
  );
}
