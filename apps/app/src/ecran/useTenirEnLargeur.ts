'use client';

import { useLayoutEffect, type RefObject } from 'react';

/**
 * Un nom d'équipe (« Les Super Champions 2026 ») ou un prénom (« Balasubramaniam ») tient sur sa
 * ligne : chaque élément de `selecteur` qui dépasse de sa boîte voit sa police réduite d'autant,
 * lui seul, jusqu'à `min` de sa taille ; en deçà, les points de suspension de la feuille de style
 * reprennent la main. Les autres gardent leur taille (inventaire du 2026-10-24 : un seul nom long
 * coupé, ou réduisant toute une carte). La largeur d'un texte suit sa police : un passage suffit.
 * Recalculé quand `cle` change, au chargement des polices et quand le bloc change de taille.
 */
export function useTenirEnLargeur(
  ref: RefObject<HTMLElement | null>,
  cle: string,
  selecteur: string,
  min = 0.6,
): void {
  useLayoutEffect(() => {
    const bloc = ref.current;
    if (!bloc) return;

    const ajuster = () => {
      const elements = [...bloc.querySelectorAll<HTMLElement>(selecteur)];
      for (const e of elements) e.style.fontSize = '';
      for (const e of elements) {
        if (e.scrollWidth <= e.clientWidth + 1 || !e.clientWidth) continue;
        const taille = parseFloat(getComputedStyle(e).fontSize);
        const ratio = Math.max(min, (e.clientWidth / e.scrollWidth) * 0.98);
        e.style.fontSize = `${taille * ratio}px`;
      }
    };

    ajuster();
    let actif = true;
    void document.fonts?.ready.then(() => {
      if (actif) ajuster();
    });
    const observateur = new ResizeObserver(() => ajuster());
    observateur.observe(bloc);
    return () => {
      actif = false;
      observateur.disconnect();
    };
  }, [ref, cle, selecteur, min]);
}
