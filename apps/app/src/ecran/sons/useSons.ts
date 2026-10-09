'use client';

import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { ambianceA, instantDe, reglageDe, sonsPour, type Instant, type Son } from '@/lib/sons';
import type { EtatSalle } from '@/lib/salle';
import { creerLecteur, type Lecteur } from './lecteur';

/**
 * De quoi jouer un son, pour les composants qui en déclenchent d'eux-mêmes (le chrono, l'arrêt
 * d'un palier). `null` partout sauf sur l'écran commun : la régie et son aperçu restent muets.
 */
export const SonsContexte = createContext<((son: Son) => void) | null>(null);

declare global {
  interface Window {
    /** Le lecteur de l'écran commun (journal des sons joués, réglage), pour les contrôles. */
    __tuLecteur?: Lecteur;
  }
}

/**
 * Le son de l'écran commun : un clic l'active (les navigateurs l'exigent), puis chaque
 * changement d'état joue ce que `sonsPour` en dit, l'ambiance suit la scène, et le volume suit
 * la régie.
 */
export function useSons(etat: EtatSalle, eteint: boolean) {
  const [lecteur, setLecteur] = useState<Lecteur | null>(null);
  const precedent = useRef<Instant | null>(null);
  const reglage = reglageDe(etat);
  const instant = instantDe(etat);

  const activer = useCallback(async () => {
    const neuf = await creerLecteur(reglageDe(etat));
    window.__tuLecteur = neuf;
    setLecteur(neuf);
  }, [etat]);

  useEffect(() => () => lecteur?.fermer(), [lecteur]);

  const { actif, volume } = reglage;
  useEffect(() => lecteur?.regler({ actif, volume }), [lecteur, actif, volume]);

  const { scene, etape, mancheId, passageId, jeu, joueurs } = instant;
  useEffect(() => {
    const apres: Instant = { scene, etape, mancheId, passageId, jeu, joueurs };
    const avant = precedent.current;
    precedent.current = apres;
    if (!lecteur) return;
    // À l'activation, pas d'« avant » à comparer : seule l'ambiance démarre si c'est l'accueil.
    if (avant) for (const son of sonsPour(avant, apres)) lecteur.jouer(son);
    lecteur.ambiance(ambianceA(apres));
  }, [lecteur, scene, etape, mancheId, passageId, jeu, joueurs]);

  const jouer = useCallback((son: Son) => lecteur?.jouer(son), [lecteur]);

  return {
    /** À proposer tant que le son n'est pas activé sur cet écran. */
    aActiver: !eteint && !lecteur,
    activer,
    jouer: eteint || !lecteur ? null : jouer,
  };
}
