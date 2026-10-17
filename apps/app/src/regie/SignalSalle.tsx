'use client';

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SIGNAL } from '@/ecran/useEtatSalle';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';

const Contexte = createContext<() => void>(() => {});

/**
 * La page Salle prévient l'écran commun après chaque changement (équipe, capitaine, retrait,
 * ajout, mode des membres) : le même signal sans données que la régie, sur `salle:<id>`.
 * Sans lui, l'écran n'écoute que les arrivées et ne verrait le reste qu'à sa relecture de
 * sûreté (20 s). Le canal est créé dès le montage, sans attendre de jeton : une action faite
 * aussitôt la page chargée n'est pas perdue.
 */
export function SignalSalle({
  evenementId,
  children,
}: {
  evenementId: string;
  children: ReactNode;
}) {
  const canal = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = supabaseNavigateur();
    const ouvert = supabase.channel(`salle:${evenementId}`, {
      config: { broadcast: { self: false } },
    });
    // Le signal peut partir dès maintenant : tant que le canal n'est pas ouvert, supabase-js
    // l'envoie par son API.
    ouvert.subscribe();
    canal.current = ouvert;
    return () => {
      canal.current = null;
      void supabase.removeChannel(ouvert);
    };
  }, [evenementId]);

  const signaler = useCallback(() => {
    void canal.current?.send({ type: 'broadcast', event: SIGNAL, payload: {} });
  }, []);

  return <Contexte.Provider value={signaler}>{children}</Contexte.Provider>;
}

export function useSignalSalle(): () => void {
  return useContext(Contexte);
}
