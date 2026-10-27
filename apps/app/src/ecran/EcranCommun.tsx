'use client';

import type { CSSProperties } from 'react';
import type { EtatSalle } from '@/lib/salle';
import { Salle } from './Salle';
import { useEchelleScene } from './useEchelleScene';
import { useEtatSalle } from './useEtatSalle';

/**
 * L'écran projeté : aucune commande, il suit la régie en temps réel. La scène est composée à
 * 1 920 × 1 080 et mise à l'échelle du projecteur (2026-10-27) : la même page à toutes les
 * tailles, rien ne déborde sur un petit projecteur, rien n'est perdu dans le vide sur un grand.
 */
export function EcranCommun({
  initial,
  qrSvg,
  adresse,
}: {
  initial: EtatSalle;
  qrSvg: string;
  adresse: string;
}) {
  const { etat, decalageMs, enDirect } = useEtatSalle(initial.evenement.code, initial, false);
  const [cadre, echelle] = useEchelleScene('contenir', 1);
  return (
    <div
      ref={cadre}
      className="tu-stage-cadre"
      data-en-direct={enDirect}
      style={{ '--tu-stage-echelle': echelle } as CSSProperties}
    >
      <Salle etat={etat} decalageMs={decalageMs} qrSvg={qrSvg} adresse={adresse} projete />
    </div>
  );
}
