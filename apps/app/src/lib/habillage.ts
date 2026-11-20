import type { EtatSalle } from './salle';

/**
 * Habillage du plateau (2026-11-19, audit « jeu télé ») : les ronds du logo dérivent, très pâles,
 * derrière les scènes d'attente seulement (le programme, le classement, la présentation d'un jeu,
 * les consignes sans texte à lire de près). Jamais pendant un jeu, une révélation ou un verdict :
 * rien ne doit y distraire la salle.
 */
export function fondDeRonds(etat: Pick<EtatSalle, 'pilotage' | 'programme'>): boolean {
  const { scene, etape, manche_id } = etat.pilotage;
  if (scene === 'programme' || scene === 'scores') return true;
  // La présentation d'un jeu, ni son explication ni le tirage de l'ordre (déjà animés).
  if (scene === 'intro') return etape === null;
  if (scene !== 'jeu') return false;
  const jeu = etat.programme.find((m) => m.id === manche_id)?.jeu;
  if (jeu === 'list2') return etape === 'pret' || etape === 'masque';
  if (jeu === 'mime2' || jeu === 'cinemime') return etape === 'pret';
  return false;
}
