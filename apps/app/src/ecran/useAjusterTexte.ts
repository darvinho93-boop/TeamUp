'use client';

import { useLayoutEffect, type RefObject } from 'react';

/** Le texte ne descend pas sous la moitié de sa taille : au-delà, illisible en salle. */
const ECHELLE_MIN = 0.5;
const PAS = 0.05;

/**
 * Un élément sort par le bas du bloc ou de l'une de ses cases (enfants directs). On compare les
 * boîtes, pas le dessin des lettres : le chiffre géant d'un chrono, dont les glyphes dépassent
 * d'une ligne de hauteur 1, ne compte pas (`scrollHeight` le comptait, et tout se réduisait à
 * moitié pour rien). En largeur, les mots longs se coupent en CSS (`overflow-wrap`).
 */
function deborde(bloc: HTMLElement): boolean {
  return [bloc, ...bloc.children].some((cadre) => {
    const bas = cadre.getBoundingClientRect().bottom + 1;
    return [...cadre.querySelectorAll('*')].some((e) => e.getBoundingClientRect().bottom > bas);
  });
}

/**
 * L'écran commun loge des textes de longueur variable, parfois en trois langues (le quiz d'un
 * mariage, le 2026-10-18) : ce hook réduit le texte d'un bloc par pas de 5 % (la variable CSS
 * `variable`, de 1 à 0,5) tant que le bloc ou l'une de ses cases déborde. `avant` prépare la
 * mesure (réserver une place qui viendra plus tard). Recalculé quand `cle` change, au chargement
 * des polices et quand le bloc change de taille ; le bloc a la taille que la scène lui laisse,
 * donc le texte n'y change rien et rien ne boucle.
 */
export function useAjusterTexte(
  ref: RefObject<HTMLElement | null>,
  cle: string,
  variable: string,
  avant?: (bloc: HTMLElement) => void,
): void {
  useLayoutEffect(() => {
    const bloc = ref.current;
    if (!bloc) return;

    const ajuster = () => {
      avant?.(bloc);
      let echelle = 1;
      bloc.style.setProperty(variable, '1');
      while (deborde(bloc) && echelle > ECHELLE_MIN) {
        echelle = Math.round((echelle - PAS) * 100) / 100;
        bloc.style.setProperty(variable, String(echelle));
      }
    };

    ajuster();
    let actif = true;
    // Les polices changent la largeur du texte : on recommence une fois qu'elles sont là.
    void document.fonts?.ready.then(() => {
      if (actif) ajuster();
    });
    const observateur = new ResizeObserver(() => ajuster());
    observateur.observe(bloc);
    return () => {
      actif = false;
      observateur.disconnect();
    };
    // `avant` est recréée à chaque rendu : la clé dit seule quand recalculer.
  }, [ref, cle, variable]);
}
