'use client';

import { useLayoutEffect, type RefObject } from 'react';

/**
 * La largeur du texte et la place qu'il a, au sous-pixel et hors mise à l'échelle de la scène.
 * `scrollWidth` arrondit : un texte qui dépassait d'une fraction de pixel passait pour tenir, et
 * les points de suspension le coupaient quand même (vu au tournoi, 32 postes, le 2026-11-21).
 */
function mesurer(e: HTMLElement): { texte: number; place: number } {
  const boite = e.getBoundingClientRect();
  const echelle = boite.width / e.offsetWidth || 1;
  const plage = document.createRange();
  plage.selectNodeContents(e);
  const s = getComputedStyle(e);
  const bords = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'] as const;
  return {
    texte: plage.getBoundingClientRect().width / echelle,
    place: boite.width / echelle - bords.reduce((n, c) => n + (parseFloat(s[c]) || 0), 0),
  };
}

/** En deçà, un élément ajusté à son texte : les deux largeurs ne diffèrent que par l'arrondi. */
const TOLERANCE_PX = 0.05;

/**
 * Sans positionnement au sous-pixel (Chromium sans interface sous Linux), la largeur de chaque
 * lettre s'arrondit au pixel : le texte ne suit pas sa police à la proportion près, et une seule
 * réduction peut le laisser dépasser. Chaque essai réduit d'au moins 2 %.
 */
const ESSAIS_MAX = 8;

/**
 * Un nom d'équipe (« Les Super Champions 2026 ») ou un prénom (« Balasubramaniam ») tient sur sa
 * ligne : chaque élément de `selecteur` qui dépasse de sa boîte voit sa police réduite d'autant,
 * lui seul, jusqu'à `min` de sa taille ; en deçà, les points de suspension de la feuille de style
 * reprennent la main. Les autres gardent leur taille (inventaire du 2026-10-24 : un seul nom long
 * coupé, ou réduisant toute une carte).
 * Recalculé quand `cle` change, à chaque police chargée et quand le bloc change de taille.
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
        if (!e.clientWidth) continue;
        const taille = parseFloat(getComputedStyle(e).fontSize);
        let ratio = 1;
        for (let essai = 0; essai < ESSAIS_MAX && ratio > min; essai++) {
          const { texte, place } = mesurer(e);
          if (e.scrollWidth <= e.clientWidth + 1 && texte <= place + TOLERANCE_PX) break;
          const manque = Math.min(place / texte, e.clientWidth / e.scrollWidth);
          ratio = Math.max(min, ratio * manque * 0.98);
          e.style.fontSize = `${taille * ratio}px`;
        }
      }
    };

    ajuster();
    let actif = true;
    void document.fonts?.ready.then(() => {
      if (actif) ajuster();
    });
    // `ready` peut être déjà résolu quand une graisse de plus arrive ensuite.
    document.fonts?.addEventListener('loadingdone', ajuster);
    const observateur = new ResizeObserver(() => ajuster());
    observateur.observe(bloc);
    return () => {
      actif = false;
      document.fonts?.removeEventListener('loadingdone', ajuster);
      observateur.disconnect();
    };
  }, [ref, cle, selecteur, min]);
}
