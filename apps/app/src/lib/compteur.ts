/**
 * Des points qui défilent (2026-11-19, audit « jeu télé ») : un verdict, la fin du quiz ou le
 * classement comptent de leur valeur de départ à leur valeur finale, en ralentissant à la fin.
 */

/** Le défilement des points d'un verdict. */
export const DUREE_COMPTEUR_MS = 900;

/** La valeur affichée `ecouleMs` après le début du défilement, entière. */
export function valeurA(
  depart: number,
  cible: number,
  ecouleMs: number,
  dureeMs: number = DUREE_COMPTEUR_MS,
): number {
  if (ecouleMs <= 0) return depart;
  if (ecouleMs >= dureeMs) return cible;
  const avance = ecouleMs / dureeMs;
  // Décélération : vite au début, puis on lit les derniers chiffres.
  const lisse = 1 - (1 - avance) ** 3;
  return Math.round(depart + (cible - depart) * lisse);
}
