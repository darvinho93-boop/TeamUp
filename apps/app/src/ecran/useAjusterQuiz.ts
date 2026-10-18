'use client';

import { useLayoutEffect, type RefObject } from 'react';

/** Le texte des cases ne descend pas sous la moitié de sa taille : au-delà, illisible en salle. */
const ECHELLE_MIN = 0.5;
const PAS = 0.05;

/**
 * Les cases du quiz à l'écran commun : leur texte (une longue réponse, parfois en trois langues)
 * se réduit par pas jusqu'à tenir dans sa case (`--tu-quiz-echelle`). En mode jetons, la place des
 * pastilles de toutes les équipes en jeu est réservée d'abord (`--tu-mises-rangs`), pour qu'aucune
 * ne soit coupée quand les mises arrivent. Recalculé à chaque question et étape, au chargement des
 * polices et quand la scène change de taille ; jamais à l'arrivée d'une mise.
 */
export function useAjusterQuiz(
  ref: RefObject<HTMLOListElement | null>,
  cle: string,
  equipesEnJeu: number,
): void {
  useLayoutEffect(() => {
    const liste = ref.current;
    if (!liste) return;

    const ajuster = () => {
      const mises = liste.querySelector<HTMLElement>('.tu-stage-mises');
      if (mises) {
        // Les colonnes réelles de la grille des pastilles (auto-fill) : trois en 1 920 × 1 080.
        const colonnes =
          getComputedStyle(mises).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
        liste.style.setProperty(
          '--tu-mises-rangs',
          String(Math.max(1, Math.ceil(equipesEnJeu / colonnes))),
        );
      }
      const deborde = () =>
        [...liste.children].some((zone) => zone.scrollHeight > zone.clientHeight + 1);
      let echelle = 1;
      liste.style.setProperty('--tu-quiz-echelle', '1');
      while (deborde() && echelle > ECHELLE_MIN) {
        echelle = Math.round((echelle - PAS) * 100) / 100;
        liste.style.setProperty('--tu-quiz-echelle', String(echelle));
      }
    };

    ajuster();
    let actif = true;
    // Les polices changent la largeur du texte : on recommence une fois qu'elles sont là.
    void document.fonts?.ready.then(() => {
      if (actif) ajuster();
    });
    // La liste a la taille que la scène lui laisse : le texte n'y change rien, pas de boucle.
    const observateur = new ResizeObserver(() => ajuster());
    observateur.observe(liste);
    return () => {
      actif = false;
      observateur.disconnect();
    };
  }, [ref, cle, equipesEnJeu]);
}
