'use client';

import { useEffect, useState } from 'react';
import { DUREE_COMPTEUR_MS, valeurA } from '@/lib/compteur';
import { useMouvementReduit } from './TirageOrdre';

/**
 * Le nombre affiché par un compteur qui défile (2026-11-19) : de `depuis` à `cible`, après
 * `delaiMs`, image par image. Seulement quand `actif` (l'état est arrivé sous les yeux de
 * l'écran) : au rechargement, dans l'aperçu ou sans mouvement, la valeur finale d'emblée.
 */
export function useCompteur(
  cible: number,
  {
    actif,
    depuis = 0,
    delaiMs = 0,
    dureeMs = DUREE_COMPTEUR_MS,
  }: { actif: boolean; depuis?: number; delaiMs?: number; dureeMs?: number },
): number {
  const reduit = useMouvementReduit();
  const anime = actif && !reduit && depuis !== cible;
  const [valeur, setValeur] = useState(depuis);
  useEffect(() => {
    if (!anime) return;
    const debut = performance.now() + delaiMs;
    let id = 0;
    const pas = () => {
      const n = valeurA(depuis, cible, performance.now() - debut, dureeMs);
      setValeur(n);
      if (n !== cible) id = requestAnimationFrame(pas);
    };
    id = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(id);
  }, [anime, cible, depuis, delaiMs, dureeMs]);
  return anime ? valeur : cible;
}
