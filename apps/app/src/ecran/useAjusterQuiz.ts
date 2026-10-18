'use client';

import type { RefObject } from 'react';
import { useAjusterTexte } from './useAjusterTexte';

/**
 * Les cases du quiz à l'écran commun : leur texte (une longue réponse, parfois en trois langues)
 * se réduit jusqu'à tenir dans sa case (`--tu-quiz-echelle`). En mode jetons, la place des
 * pastilles de toutes les équipes en jeu est réservée d'abord (`--tu-mises-rangs`), pour qu'aucune
 * ne soit coupée quand les mises arrivent. Recalculé à chaque question et étape ; jamais à
 * l'arrivée d'une mise.
 */
export function useAjusterQuiz(
  ref: RefObject<HTMLOListElement | null>,
  cle: string,
  equipesEnJeu: number,
): void {
  useAjusterTexte(ref, `${cle}:${equipesEnJeu}`, '--tu-quiz-echelle', (liste) => {
    const mises = liste.querySelector<HTMLElement>('.tu-stage-mises');
    if (!mises) return;
    // Les colonnes réelles de la grille des pastilles (auto-fill) : trois en 1 920 × 1 080.
    const colonnes =
      getComputedStyle(mises).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    liste.style.setProperty(
      '--tu-mises-rangs',
      String(Math.max(1, Math.ceil(equipesEnJeu / colonnes))),
    );
  });
}
