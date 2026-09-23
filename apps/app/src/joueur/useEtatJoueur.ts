'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EtatJoueur } from '@/lib/partie';

/** Rythme de relecture de l'état : 150 joueurs donnent environ 40 requêtes par seconde. */
export const INTERVALLE_MS = 4000;

/**
 * État de l'écran d'attente, tenu à jour par relecture régulière.
 *
 * Au lot 6, le temps réel poussé pourra remplacer la relecture sans toucher aux écrans :
 * ils ne voient que `{ etat, horsLigne }`. La session vit dans un cookie, donc une coupure
 * ne fait rien perdre : au retour du réseau, la relecture suivante reprend là où on en était.
 */
export function useEtatJoueur(code: string, initial: EtatJoueur) {
  const router = useRouter();
  const [etat, setEtat] = useState(initial);
  const [horsLigne, setHorsLigne] = useState(false);

  useEffect(() => {
    let actif = true;
    let minuterie: ReturnType<typeof setTimeout> | undefined;

    const relire = async () => {
      clearTimeout(minuterie);
      try {
        const reponse = await fetch(`/api/partie/${code}/etat`, { cache: 'no-store' });
        // Session effacée côté base (joueur retiré, événement supprimé) : on repart de l'arrivée.
        if (reponse.status === 401) return router.refresh();
        if (!reponse.ok) throw new Error(`état : ${reponse.status}`);
        const suivant = (await reponse.json()) as EtatJoueur;
        if (!actif) return;
        setEtat(suivant);
        setHorsLigne(false);
      } catch {
        if (actif) setHorsLigne(true);
      }
      if (actif) minuterie = setTimeout(() => void relire(), INTERVALLE_MS);
    };

    const auRetour = () => void relire();
    const aLaCoupure = () => setHorsLigne(true);
    const aLaVue = () => {
      if (document.visibilityState === 'visible') void relire();
    };

    window.addEventListener('online', auRetour);
    window.addEventListener('offline', aLaCoupure);
    document.addEventListener('visibilitychange', aLaVue);
    minuterie = setTimeout(() => void relire(), INTERVALLE_MS);

    return () => {
      actif = false;
      clearTimeout(minuterie);
      window.removeEventListener('online', auRetour);
      window.removeEventListener('offline', aLaCoupure);
      document.removeEventListener('visibilitychange', aLaVue);
    };
  }, [code, router]);

  return { etat, horsLigne };
}
