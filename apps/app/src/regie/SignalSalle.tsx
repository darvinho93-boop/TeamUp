'use client';

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import { REALTIME_SUBSCRIBE_STATES, type RealtimeChannel } from '@supabase/supabase-js';
import { SIGNAL } from '@/ecran/useEtatSalle';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';

/** Au-delà, le signal part sans attendre l'abonnement (supabase-js passe alors par son API). */
const ATTENTE_MAX_MS = 3000;

const Contexte = createContext<() => void>(() => {});

/**
 * La page Salle prévient l'écran commun après chaque changement (équipe, capitaine, retrait,
 * ajout, mode des membres, logo) : le même signal sans données que la régie, sur `salle:<id>`.
 * Sans lui, l'écran n'écoute que les arrivées et ne verrait le reste qu'à sa relecture de
 * sûreté (20 s). Un signal demandé avant que le canal soit ouvert attend qu'il le soit : une
 * action faite aussitôt la page chargée n'est pas perdue.
 */
export function SignalSalle({
  evenementId,
  children,
}: {
  evenementId: string;
  children: ReactNode;
}) {
  const pret = useRef<Promise<RealtimeChannel> | null>(null);

  useEffect(() => {
    const supabase = supabaseNavigateur();
    const canal = supabase.channel(`salle:${evenementId}`, {
      config: { broadcast: { self: false } },
    });
    pret.current = new Promise((resoudre) => {
      canal.subscribe((statut) => {
        if (statut === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) resoudre(canal);
      });
      setTimeout(() => resoudre(canal), ATTENTE_MAX_MS);
    });
    return () => {
      pret.current = null;
      void supabase.removeChannel(canal);
    };
  }, [evenementId]);

  const signaler = useCallback(() => {
    void pret.current?.then((canal) =>
      canal.send({ type: 'broadcast', event: SIGNAL, payload: {} }),
    );
  }, []);

  return <Contexte.Provider value={signaler}>{children}</Contexte.Provider>;
}

export function useSignalSalle(): () => void {
  return useContext(Contexte);
}
