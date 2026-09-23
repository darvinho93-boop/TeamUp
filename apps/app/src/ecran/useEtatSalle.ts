'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';
import type { EtatSalle } from '@/lib/salle';

/** Relecture de secours quand le canal temps réel est coupé. */
const SECOURS_MS = 5000;
/** Relecture de sûreté même canal ouvert : rattrape un changement manqué. */
const SURETE_MS = 20_000;

const TABLES = ['pilotage', 'scores', 'joueurs', 'passages', 'manches'] as const;

/**
 * L'état de la salle, tenu à jour en temps réel pour l'écran commun et la régie.
 *
 * Supabase Realtime prévient à chaque changement de l'événement (la RLS filtre : seul son
 * animateur reçoit) ; on relit alors l'état complet par `etat_ecran`. Les relectures se
 * regroupent : un changement pendant une lecture en déclenche une seule autre à la suite.
 * Chaque lecture mesure aussi le décalage entre l'horloge de la base et celle du navigateur,
 * pour que les chronos de toutes les fenêtres affichent la même seconde.
 */
export function useEtatSalle(code: string, initial: EtatSalle, regie: boolean) {
  const [etat, setEtat] = useState(initial);
  const [decalageMs, setDecalageMs] = useState(0);
  const [enDirect, setEnDirect] = useState(false);
  const enCours = useRef(false);
  const aRelire = useRef(false);

  const relire = useCallback(async () => {
    if (enCours.current) {
      aRelire.current = true;
      return;
    }
    enCours.current = true;
    try {
      do {
        aRelire.current = false;
        const avant = Date.now();
        const { data } = await supabaseNavigateur().rpc('etat_ecran', {
          p_code: code,
          p_regie: regie,
        });
        const apres = Date.now();
        if (data) {
          const suivant = data as unknown as EtatSalle;
          setDecalageMs(suivant.serveur_ms - (avant + apres) / 2);
          setEtat(suivant);
        }
      } while (aRelire.current);
    } finally {
      enCours.current = false;
    }
  }, [code, regie]);

  useEffect(() => {
    const supabase = supabaseNavigateur();
    const id = initial.evenement.id;
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let actif = true;

    void (async () => {
      // Le jeton de l'animateur, pour que le temps réel applique sa RLS.
      await supabase.realtime.setAuth();
      if (!actif) return;
      canal = supabase.channel(`salle-${id}-${regie ? 'regie' : 'ecran'}`);
      for (const table of TABLES) {
        canal.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `evenement_id=eq.${id}` },
          () => void relire(),
        );
      }
      canal.subscribe((statut) => {
        const ouvert = statut === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED;
        setEnDirect(ouvert);
        // À l'ouverture (ou la réouverture) du canal, on rattrape ce qui a pu passer.
        if (ouvert) void relire();
      });
    })();

    void relire();
    return () => {
      actif = false;
      if (canal) void supabase.removeChannel(canal);
    };
  }, [initial.evenement.id, regie, relire]);

  useEffect(() => {
    const minuterie = setInterval(() => void relire(), enDirect ? SURETE_MS : SECOURS_MS);
    return () => clearInterval(minuterie);
  }, [enDirect, relire]);

  return { etat, decalageMs, enDirect, relire };
}
