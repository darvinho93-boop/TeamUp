'use client';

import type { CSSProperties } from 'react';
import type { EtatSalle } from '@/lib/salle';
import { Salle } from '@/ecran/Salle';
import { useEchelleScene } from '@/ecran/useEchelleScene';

/**
 * L'écran commun en réduction, dans la régie : les mêmes composants que l'écran projeté,
 * à sa taille de référence (1 920 × 1 080), mis à l'échelle de la place disponible.
 */
export function Apercu(props: {
  etat: EtatSalle;
  decalageMs: number;
  qrSvg: string;
  adresse: string;
}) {
  const [cadre, echelle] = useEchelleScene('largeur', 0.4);

  return (
    <div
      ref={cadre}
      className="tu-regie-preview"
      style={{ '--tu-stage-echelle': echelle } as CSSProperties}
    >
      <Salle {...props} apercu />
    </div>
  );
}
