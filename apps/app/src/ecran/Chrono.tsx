'use client';

import { useEffect, useState } from 'react';
import { cx } from '@teamup/ui/react';
import { formatChrono, tempsRestant } from '@teamup/game';

/** L'heure du navigateur, rafraîchie cinq fois par seconde tant que `actif`. */
export function useMaintenant(actif: boolean): number {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    if (!actif) return;
    const minuterie = setInterval(() => setMaintenant(Date.now()), 200);
    return () => clearInterval(minuterie);
  }, [actif]);
  return maintenant;
}

/**
 * Chrono de la salle : compte à rebours depuis l'heure de départ posée par la base.
 * `decalageMs` aligne l'horloge du navigateur sur celle de la base : l'écran et la régie
 * affichent la même seconde. À zéro, il vire au rouge.
 */
export function Chrono({
  departMs,
  dureeS,
  decalageMs,
  className,
  arret,
}: {
  departMs: number | null;
  dureeS: number;
  decalageMs: number;
  className?: string;
  /** Temps écoulé figé (passage terminé) : le chrono ne tourne plus. */
  arret?: number;
}) {
  const maintenant = useMaintenant(departMs !== null && arret === undefined);

  const ecoule = arret ?? (departMs === null ? 0 : Math.max(0, maintenant + decalageMs - departMs));
  const reste = tempsRestant(dureeS, ecoule);
  return (
    <span
      className={cx('tu-stage-chrono', reste === 0 && 'tu-stage-chrono--zero', className)}
      data-testid="chrono"
      role="timer"
    >
      {formatChrono(reste)}
    </span>
  );
}
