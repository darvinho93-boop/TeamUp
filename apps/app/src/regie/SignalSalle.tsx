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
 * sûreté (20 s).
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
    let actif = true;
    void (async () => {
      await supabase.realtime.setAuth();
      if (!actif) return;
      canal.current = supabase
        .channel(`salle:${evenementId}`, { config: { broadcast: { self: false } } })
        .subscribe();
    })();
    return () => {
      actif = false;
      if (canal.current) void supabase.removeChannel(canal.current);
      canal.current = null;
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
