'use client';

import type { EtatSalle } from '@/lib/salle';
import { Salle } from './Salle';
import { useEtatSalle } from './useEtatSalle';

/** L'écran projeté : aucune commande, il suit la régie en temps réel. */
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
  return (
    <div data-en-direct={enDirect}>
      <Salle etat={etat} decalageMs={decalageMs} qrSvg={qrSvg} adresse={adresse} />
    </div>
  );
}
