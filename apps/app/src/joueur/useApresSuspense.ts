'use client';

import { useEffect, useState } from 'react';
import { SUSPENSE_MS } from '@/lib/suspense';

/**
 * Le verdict du quiz au téléphone (2026-11-19) : quand la bonne réponse arrive sous les yeux du
 * joueur, il attend la fin du suspense de l'écran commun, pour ne jamais le devancer. Trouvée au
 * chargement, elle s'affiche d'emblée.
 */
export function useApresSuspense(revelee: boolean): boolean {
  const [avant, setAvant] = useState(revelee);
  const [attente, setAttente] = useState(false);
  if (revelee !== avant) {
    setAvant(revelee);
    setAttente(revelee);
  }
  useEffect(() => {
    if (!attente) return;
    const fin = setTimeout(() => setAttente(false), SUSPENSE_MS);
    return () => clearTimeout(fin);
  }, [attente]);
  return revelee && !attente;
}
