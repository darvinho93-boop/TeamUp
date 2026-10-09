'use client';

import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { deroule, fondA, instantDe, reglageDe, sonsPour, type Instant, type Son } from '@/lib/sons';
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
 * changement d'état joue ce que `sonsPour` en dit, la musique de fond suit le moment, et le
 * volume suit la régie.
 */
export function useSons(etat: EtatSalle, eteint: boolean, decalageMs: number) {
  const [lecteur, setLecteur] = useState<Lecteur | null>(null);
  const precedent = useRef<Instant | null>(null);
  const reglage = reglageDe(etat);
  const instant = instantDe(etat);

  // Un second clic pendant le chargement ne crée pas un second lecteur.
  const chargement = useRef(false);
  const activer = useCallback(async () => {
    if (chargement.current) return;
    chargement.current = true;
    try {
      const neuf = await creerLecteur(reglageDe(etat), {
        // Le son est parti dans un autre onglet : celui-ci repropose de l'activer.
        surCession: () => setLecteur(null),
      });
      window.__tuLecteur = neuf;
      setLecteur(neuf);
    } finally {
      chargement.current = false;
    }
  }, [etat]);

  // Réveillé tant que l'écran est monté, en veille sinon (voir `veiller`).
  useEffect(() => {
    lecteur?.veiller(false);
    return () => lecteur?.veiller(true);
  }, [lecteur]);

  const { actif, volume } = reglage;
  useEffect(() => lecteur?.regler({ actif, volume }), [lecteur, actif, volume]);

  const { scene, etape, mancheId, passageId, jeu, joueurs } = instant;
  useEffect(() => {
    const apres: Instant = { scene, etape, mancheId, passageId, jeu, joueurs };
    const avant = precedent.current;
    precedent.current = apres;
    if (!lecteur) return;
    // À l'activation, pas d'« avant » à comparer : seule la musique de fond du moment démarre.
    if (avant) {
      const sansMouvement = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      for (const son of sonsPour(avant, apres))
        for (const pas of deroule(son, sansMouvement)) lecteur.jouer(pas.son, pas.apresMs);
    }
  }, [lecteur, scene, etape, mancheId, passageId, jeu, joueurs]);

  // La musique de fond du moment. Celle d'une explication s'arrête avec elle : l'étape reste
  // « explication » tant que la régie n'a rien touché, mais le script, lui, a une fin.
  const { chrono_depart_ms: depart, chrono_duree_s: duree } = etat.pilotage;
  useEffect(() => {
    if (!lecteur) return;
    const fond = fondA({ scene, etape, mancheId, passageId, jeu, joueurs });
    if (fond !== 'explication' || depart === null || duree === null) {
      lecteur.fond(fond);
      return;
    }
    const reste = depart + duree * 1000 - (Date.now() + decalageMs);
    lecteur.fond(reste > 0 ? fond : null);
    if (reste <= 0) return;
    const fin = setTimeout(() => lecteur.fond(null), reste);
    return () => clearTimeout(fin);
  }, [lecteur, scene, etape, mancheId, passageId, jeu, joueurs, depart, duree, decalageMs]);

  const jouer = useCallback((son: Son) => lecteur?.jouer(son), [lecteur]);

  return {
    /** À proposer tant que le son n'est pas activé sur cet écran. */
    aActiver: !eteint && !lecteur,
    activer,
    jouer: eteint || !lecteur ? null : jouer,
  };
}
