/**
 * Chronos. Un chrono est une durée et un instant de départ ; le paquet n'a pas d'horloge,
 * l'appelant fournit le temps écoulé en millisecondes.
 *
 * Le temps restant se compte en secondes entières, arrondi à l'inférieur : c'est la même
 * valeur qui s'affiche et qui entre dans les barèmes.
 */

/** Secondes entières restantes, entre 0 et `dureeS`. */
export function tempsRestant(dureeS: number, ecouleMs: number): number {
  const restantMs = dureeS * 1000 - Math.max(0, ecouleMs);
  return Math.max(0, Math.floor(restantMs / 1000));
}

/** `130` → `2:10`, format du chrono affiché. */
export function formatChrono(secondes: number): string {
  const s = Math.max(0, Math.floor(secondes));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** `130` → `2 min 10`, `600` → `10 min`, `45` → `45 s` : format des durées de la spec. */
export function formatDuree(secondes: number): string {
  const s = Math.max(0, Math.round(secondes));
  const min = Math.floor(s / 60);
  const reste = s % 60;
  if (min === 0) return `${reste} s`;
  if (reste === 0) return `${min} min`;
  return `${min} min ${String(reste).padStart(2, '0')}`;
}
