/**
 * Duels 1 contre 1, en bêta (`grab`, `cup`) : un moteur commun, verdict de l'animateur.
 *
 * Barème (décision du 2026-10-03, la spec v3 n'en donne pas) : +50 à l'équipe du vainqueur.
 * Tirage en rotation équitable : les équipes qui ont le moins duellé passent d'abord, et dans
 * une équipe, personne ne revient tant qu'un équipier n'a pas eu son tour.
 */

import type { ScoresParEquipe } from './scores';

export const POINTS_DUEL = 50;

export function scoreDuel(equipeGagnante: number): ScoresParEquipe {
  return { [equipeGagnante]: POINTS_DUEL };
}

/** Un nombre dans [0, 1[, injecté pour que les tests soient déterministes. */
export type Alea = () => number;

export interface Candidat {
  id: string;
  equipe: number;
}

/** Les deux duellistes, d'équipes différentes. */
export type Duel = readonly [Candidat, Candidat];

function auHasard<T>(liste: readonly T[], alea: Alea): T {
  return liste[Math.min(liste.length - 1, Math.floor(alea() * liste.length))]!;
}

/** Les éléments de `liste` dont la clé est minimale. */
function lesMoins<T>(liste: readonly T[], cle: (x: T) => number): T[] {
  const min = Math.min(...liste.map(cle));
  return liste.filter((x) => cle(x) === min);
}

/**
 * Tire le prochain duel parmi `joueurs`. `dejaTires` : les duellistes des duels déjà joués de
 * la soirée (un joueur peut y figurer plusieurs fois). Rend `null` s'il n'y a pas deux équipes
 * avec au moins un joueur.
 */
export function tirerDuel(
  joueurs: readonly Candidat[],
  dejaTires: readonly Candidat[],
  alea: Alea,
): Duel | null {
  const duelsParJoueur = new Map<string, number>();
  const duelsParEquipe = new Map<number, number>();
  for (const t of dejaTires) {
    duelsParJoueur.set(t.id, (duelsParJoueur.get(t.id) ?? 0) + 1);
    duelsParEquipe.set(t.equipe, (duelsParEquipe.get(t.equipe) ?? 0) + 1);
  }

  const equipes = [...new Set(joueurs.map((j) => j.equipe))];
  if (equipes.length < 2) return null;

  const choisirEquipe = (parmi: number[]) =>
    auHasard(
      lesMoins(parmi, (e) => duelsParEquipe.get(e) ?? 0),
      alea,
    );
  const premiere = choisirEquipe(equipes);
  const seconde = choisirEquipe(equipes.filter((e) => e !== premiere));

  const choisirJoueur = (equipe: number) =>
    auHasard(
      lesMoins(
        joueurs.filter((j) => j.equipe === equipe),
        (j) => duelsParJoueur.get(j.id) ?? 0,
      ),
      alea,
    );
  return [choisirJoueur(premiere), choisirJoueur(seconde)];
}

// ---------------------------------------------------------------------------
// Tête, épaule, gobelet : la séquence soufflée à l'animateur
// ---------------------------------------------------------------------------

/** Les gestes que l'animateur annonce. Les mots, par langue, sont dans les messages de la régie. */
export const GESTES_GOBELET = ['tete', 'epaules', 'genoux', 'pieds'] as const;
/** Des mots qui sonnent comme « gobelet » : le premier qui y touche se fait piéger. */
export const PIEGES_GOBELET = ['gobelin', 'goeland', 'gober'] as const;

export type MotGobelet =
  (typeof GESTES_GOBELET)[number] | (typeof PIEGES_GOBELET)[number] | 'gobelet';

export const LONGUEUR_MIN_GOBELET = 6;
export const LONGUEUR_MAX_GOBELET = 12;

/**
 * Une séquence de gestes qui se termine par « gobelet », à une position tirée au hasard pour
 * que personne ne la devine. Deux pièges au plus, jamais en tête ni collés l'un à l'autre.
 */
export function sequenceGobelet(alea: Alea): MotGobelet[] {
  const longueur =
    LONGUEUR_MIN_GOBELET + Math.floor(alea() * (LONGUEUR_MAX_GOBELET - LONGUEUR_MIN_GOBELET + 1));
  const sequence: MotGobelet[] = [];
  let pieges = 0;
  for (let i = 0; i < longueur - 1; i++) {
    const precedent = sequence.at(-1);
    const piegePossible =
      i >= 2 && pieges < 2 && !(PIEGES_GOBELET as readonly string[]).includes(precedent ?? '');
    if (piegePossible && alea() < 0.25) {
      sequence.push(auHasard(PIEGES_GOBELET, alea));
      pieges++;
    } else {
      // Jamais deux fois le même geste de suite : l'animateur doit pouvoir enchaîner.
      sequence.push(
        auHasard(
          GESTES_GOBELET.filter((g) => g !== precedent),
          alea,
        ),
      );
    }
  }
  sequence.push('gobelet');
  return sequence;
}
