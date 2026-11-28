'use client';

import { useLayoutEffect, type RefObject } from 'react';

/**
 * Cale les animations CSS d'un bloc, à son montage, sur l'instant `debutMs` (horloge de
 * `performance.now()`, la même que `document.timeline`) : leurs délais se comptent depuis cet
 * instant, et non depuis celui où la page a fini de dessiner le bloc. Les sons calés sur ces
 * animations (`jouerA`) visent le même instant, sur l'horloge audio (2026-11-28) : un premier rendu
 * lourd (l'entrée à thème) ne les décale plus.
 *
 * Avant la première image : `getAnimations` résout les styles, donc rien ne saute à l'écran.
 * Seules les animations présentes au montage sont calées ; celles qui viennent ensuite (une
 * arrivée) partent à leur heure.
 */
export function useAnimationsCalees(ref: RefObject<Element | null>, debutMs: number | null) {
  useLayoutEffect(() => {
    const bloc = ref.current;
    if (!bloc || debutMs === null) return;
    for (const animation of bloc.getAnimations({ subtree: true })) animation.startTime = debutMs;
  }, [ref, debutMs]);
}
