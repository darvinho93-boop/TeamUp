'use client';

import { cx } from '@teamup/ui/react';
import { formatChrono, tempsRestant } from '@teamup/game';
import { useMaintenant } from '@/ecran/Chrono';

export const LETTRES = ['A', 'B', 'C', 'D'] as const;

/** Le chrono d'une question du quiz, à l'heure de la base (décalage mesuré à chaque lecture). */
export function ChronoQuestion({
  departMs,
  dureeS,
  decalageMs,
}: {
  departMs: number;
  dureeS: number;
  decalageMs: number;
}) {
  const maintenant = useMaintenant(true);
  const reste = tempsRestant(dureeS, Math.max(0, maintenant + decalageMs - departMs));
  return (
    <span className={cx('tu-quiz__chrono', reste === 0 && 'tu-quiz__chrono--zero')} role="timer">
      {formatChrono(reste)}
    </span>
  );
}
