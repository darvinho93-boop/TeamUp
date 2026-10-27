'use client';

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * L'échelle de la scène, toujours composée à sa taille de référence (1 920 × 1 080) : `largeur`,
 * réduite à la largeur du cadre (l'aperçu de la régie) ; `contenir`, entière dans le cadre, quelle
 * que soit la taille du projecteur (l'écran commun, 2026-10-27). Le cadre observé est le parent
 * de la scène, la scène son premier enfant.
 */
export function useEchelleScene(
  mode: 'largeur' | 'contenir',
  initiale: number,
): [RefObject<HTMLDivElement | null>, number] {
  const cadre = useRef<HTMLDivElement>(null);
  const [echelle, setEchelle] = useState(initiale);

  useLayoutEffect(() => {
    const element = cadre.current;
    if (!element) return;
    const mesurer = () => {
      const scene = element.firstElementChild as HTMLElement | null;
      if (!scene?.offsetWidth || !scene.offsetHeight) return;
      const enLargeur = element.clientWidth / scene.offsetWidth;
      setEchelle(
        mode === 'largeur'
          ? enLargeur
          : Math.min(enLargeur, element.clientHeight / scene.offsetHeight),
      );
    };
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(element);
    mesurer();
    return () => observateur.disconnect();
  }, [mode]);

  return [cadre, echelle];
}
