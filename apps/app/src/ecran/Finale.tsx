import type { CSSProperties } from 'react';
import { FINALE } from '@/lib/ouverture';
import { Ronds } from '@/marque/Ronds';

/**
 * La dernière passe de l'ouverture : les ronds forment le logo Team Up!, le nom paraît, puis la
 * page du QR code, déjà dessous, se découvre. Elle part à `depuisMs` de son début quand elle
 * reprend la boucle au vol (`raccordFinale`) : ses animations et le fondu sont avancés d'autant.
 */
export function Finale({ depuisMs = 0 }: { depuisMs?: number }) {
  const instants = {
    '--tu-finale-depuis': `${depuisMs}ms`,
    '--tu-finale-qr': `${FINALE.qr - depuisMs}ms`,
    '--tu-finale-fondu': `${FINALE.fin - FINALE.qr}ms`,
  } as CSSProperties;
  return (
    <div className="tu-finale" style={instants} data-testid="finale" aria-hidden="true">
      <Ronds mode="finale" />
    </div>
  );
}
