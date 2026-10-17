import type { CSSProperties } from 'react';
import { REVELATION } from '@/lib/logo-soiree';
import { Ronds } from '@/marque/Ronds';

/** Les instants de `REVELATION`, en variables CSS : la feuille de style y cale chaque étape. */
const INSTANTS = {
  '--tu-rev-fond': `${REVELATION.fond}ms`,
} as CSSProperties;

/**
 * Le passage de l'ouverture à la page du QR code, par-dessus la scène déjà à jour : les ronds
 * forment le logo Team Up! une dernière fois, puis la page paraît.
 */
export function Revelation() {
  return (
    <div className="tu-revelation" style={INSTANTS} data-testid="revelation" aria-hidden="true">
      <div className="tu-revelation__marque">
        <Ronds mode="forme" dureeMs={REVELATION.fond} />
      </div>
    </div>
  );
}
