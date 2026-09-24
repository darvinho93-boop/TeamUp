'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { EtatJoueur } from '@/lib/partie';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';

/** Rythme de relecture de secours : 150 joueurs donnent environ 40 requêtes par seconde. */
export const INTERVALLE_MS = 4000;
/**
 * Au signal, 150 téléphones relisent en même temps : chacun attend un instant tiré au hasard,
 * pour étaler la rafale sans retarder la question de façon perceptible.
 */
const ETALEMENT_MS = 250;
const SIGNAL = 'relire';

/**
 * État du téléphone, tenu à jour de deux façons :
 * - le signal de la régie (`salle:<id>`, sans données) que l'écran commun écoute déjà : une
 *   touche de régie et le téléphone relit aussitôt. C'est ce qui fait arriver une question de
 *   quiz en même temps sur l'écran et dans les mains. Le canal ne transporte rien : la clé anon
 *   n'ouvre aucun droit, l'état passe toujours par `/api/partie/[code]/etat` ;
 * - une relecture toutes les 4 s, en secours si le canal est coupé.
 * La session vit dans un cookie, donc une coupure ne fait rien perdre : au retour du réseau,
 * la relecture suivante reprend là où on en était.
 */
export function useEtatJoueur(code: string, initial: EtatJoueur) {
  const router = useRouter();
  const [etat, setEtat] = useState(initial);
  const [horsLigne, setHorsLigne] = useState(false);
  // Écart entre l'horloge de la base et celle du téléphone, pour le chrono du quiz.
  const [decalageMs, setDecalageMs] = useState(0);
  const relireRef = useRef<() => Promise<void>>(async () => {});
  const evenementId = etat.evenement.id;

  const recevoir = useCallback((suivant: EtatJoueur) => {
    setEtat(suivant);
    if (suivant.quiz) setDecalageMs(suivant.quiz.serveur_ms - Date.now());
  }, []);

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
        recevoir(suivant);
        setHorsLigne(false);
      } catch {
        if (actif) setHorsLigne(true);
      }
      if (actif) minuterie = setTimeout(() => void relire(), INTERVALLE_MS);
    };
    relireRef.current = relire;

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
  }, [code, router, recevoir]);

  useEffect(() => {
    let canal: RealtimeChannel | null = null;
    let etalement: ReturnType<typeof setTimeout> | undefined;
    try {
      const supabase = supabaseNavigateur();
      canal = supabase.channel(`salle:${evenementId}`, {
        config: { broadcast: { self: false } },
      });
      canal
        .on('broadcast', { event: SIGNAL }, () => {
          clearTimeout(etalement);
          etalement = setTimeout(() => void relireRef.current(), Math.random() * ETALEMENT_MS);
        })
        .subscribe();
    } catch {
      // Sans temps réel (configuration absente), la relecture régulière suffit.
    }
    return () => {
      clearTimeout(etalement);
      if (canal) void supabaseNavigateur().removeChannel(canal);
    };
  }, [evenementId]);

  /** Un état reçu en réponse à une action du joueur (sa réponse au quiz) : affiché tout de suite. */
  const remplacer = recevoir;
  const relire = useCallback(() => void relireRef.current(), []);

  return { etat, horsLigne, decalageMs, remplacer, relire };
}
