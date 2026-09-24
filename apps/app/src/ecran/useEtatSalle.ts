'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { REALTIME_SUBSCRIBE_STATES, type RealtimeChannel } from '@supabase/supabase-js';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';
import type { EtatSalle } from '@/lib/salle';

/** Relecture de secours quand le canal temps réel est coupé. */
const SECOURS_MS = 5000;
/** Relecture de sûreté même canal ouvert : rattrape un changement manqué. */
const SURETE_MS = 20_000;

/**
 * Ce que le signal de la régie ne couvre pas : les corrections de score (page Scores) et les
 * arrivées. Le pilotage, les passages et les manches ne changent que par une touche de régie,
 * qui signale déjà ; les écouter aussi doublerait les relectures au moment de la touche suivante.
 */
const TABLES = [
  { table: 'scores', event: 'INSERT' },
  // Les arrivées seulement : chaque téléphone met à jour son "vu le" toutes les 4 s, ce qui
  // ferait relire l'état en continu à 150 joueurs. Le compte des connectés suit la relecture
  // de sûreté.
  { table: 'joueurs', event: 'INSERT' },
] as const;
/**
 * La régie compte en plus les réponses au quiz en mode téléphone (« 12 réponses reçues »).
 * L'écran commun s'en passe : 150 réponses en rafale le feraient relire pour un simple compteur,
 * que la touche « Révéler » met de toute façon à jour.
 */
const TABLES_REGIE = [...TABLES, { table: 'reponses_quiz', event: 'INSERT' }] as const;
/** Les changements de la base arrivent en rafale (150 arrivées, une étape = plusieurs lignes) :
 * on les regroupe, le signal de la régie assurant déjà la réactivité. */
const REGROUPEMENT_MS = 250;
const SIGNAL = 'relire';

/**
 * L'état de la salle, tenu à jour en temps réel pour l'écran commun et la régie.
 *
 * Deux signaux déclenchent une relecture complète par `etat_ecran` (sous la RLS) :
 * - le signal de la régie (`signaler`), envoyé dès qu'une touche a été enregistrée : un simple
 *   « ça a bougé », sans aucune donnée, qui passe de navigateur à navigateur en quelques
 *   dizaines de millisecondes. C'est lui qui tient l'écran à jour en moins d'une seconde ;
 * - les changements de la base (`postgres_changes`, filtrés par la RLS), qui rattrapent tout le
 *   reste : un joueur qui arrive, une correction de score, une seconde régie.
 * Les relectures se
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
  const canalRef = useRef<RealtimeChannel | null>(null);
  const regroupement = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // Même sujet pour l'écran et la régie : le signal de l'une atteint l'autre.
      canal = supabase.channel(`salle:${id}`, { config: { broadcast: { self: false } } });
      canalRef.current = canal;
      canal.on('broadcast', { event: SIGNAL }, () => void relire());
      for (const { table, event } of regie ? TABLES_REGIE : TABLES) {
        canal.on(
          'postgres_changes',
          { event, schema: 'public', table, filter: `evenement_id=eq.${id}` },
          () => {
            regroupement.current ??= setTimeout(() => {
              regroupement.current = null;
              void relire();
            }, REGROUPEMENT_MS);
          },
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
      canalRef.current = null;
      if (regroupement.current) clearTimeout(regroupement.current);
      if (canal) void supabase.removeChannel(canal);
    };
  }, [initial.evenement.id, regie, relire]);

  useEffect(() => {
    const minuterie = setInterval(() => void relire(), enDirect ? SURETE_MS : SECOURS_MS);
    return () => clearInterval(minuterie);
  }, [enDirect, relire]);

  /** Prévient les autres fenêtres de la salle qu'il faut relire (après une touche de la régie). */
  const signaler = useCallback(() => {
    void canalRef.current?.send({ type: 'broadcast', event: SIGNAL, payload: {} });
  }, []);

  return { etat, decalageMs, enDirect, relire, signaler };
}
