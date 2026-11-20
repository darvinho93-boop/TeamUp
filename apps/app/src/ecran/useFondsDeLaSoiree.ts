'use client';

import { useFichiersLocaux } from './useFichiersLocaux';

/**
 * Les photos de fond des jeux de la soirée (2026-11-15), téléchargées dès l'ouverture de l'écran
 * sous la session de l'animateur (bucket privé) et gardées en mémoire (`blob:`) : rien à attendre
 * au lancement d'un jeu, et le réseau peut tomber ensuite. Rend chemin → adresse locale.
 */
export function useFondsDeLaSoiree(chemins: readonly string[]): ReadonlyMap<string, string> {
  return useFichiersLocaux('fonds', chemins);
}
