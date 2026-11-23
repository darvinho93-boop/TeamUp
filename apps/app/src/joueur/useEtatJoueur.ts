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
/**
 * Le canal est public (clé anon) : quelqu'un qui l'inonderait de signaux ne doit pas faire
 * relire 150 téléphones en continu. Un signal reçu pendant qu'une relecture attend s'y joint, et
 * deux relectures sur signal sont espacées d'au moins cette durée (audit du 2026-10-23).
 */
const ECART_MIN_MS = 750;
const SIGNAL = 'relire';
/** Une relecture qui ne répond pas ne doit ni bloquer l'écran ni arrêter les suivantes. */
const DELAI_RELECTURE_MS = 8000;

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
  // Faux au retour d'une veille ou du réseau, le temps de la relecture : aucune action n'est
  // proposée sur un état périmé (2026-11-23). Jamais pendant la coupure elle-même : la Surenchère
  // y garde ses mots en file d'attente.
  const [aJour, setAJour] = useState(true);
  const relireRef = useRef<() => Promise<void>>(async () => {});
  const evenementId = etat.evenement.id;

  const recevoir = useCallback((suivant: EtatJoueur) => {
    setEtat(suivant);
    // L'heure de la base, quand l'état en porte une : le chrono du quiz et celui de la Surenchère
    // au téléphone se lisent à cette heure-là, jamais à celle du téléphone (une montre qui avance
    // de 45 s trouvait le chrono déjà fini, 2026-11-09).
    const serveurMs =
      suivant.quiz?.serveur_ms ?? suivant.surenchere?.serveur_ms ?? suivant.portrait?.serveur_ms;
    if (serveurMs !== undefined) setDecalageMs(serveurMs - Date.now());
  }, []);

  useEffect(() => {
    let actif = true;
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    // Seule la dernière relecture lancée compte : une réponse partie avant la veille, arrivée
    // après, ne vaut pas état à jour.
    let derniere = 0;

    const relire = async () => {
      clearTimeout(minuterie);
      const numero = ++derniere;
      try {
        const reponse = await fetch(`/api/partie/${code}/etat`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(DELAI_RELECTURE_MS),
        });
        // Session effacée côté base (joueur retiré, événement supprimé) : on repart de l'arrivée.
        if (reponse.status === 401) return router.refresh();
        if (!reponse.ok) throw new Error(`état : ${reponse.status}`);
        const suivant = (await reponse.json()) as EtatJoueur;
        if (!actif || numero !== derniere) return;
        recevoir(suivant);
        setHorsLigne(false);
        setAJour(true);
      } catch {
        if (actif && numero === derniere) {
          setHorsLigne(true);
          // Pas de relecture possible : le bandeau le dit, l'écran ne reste pas bloqué.
          setAJour(true);
        }
      }
      if (actif && numero === derniere) {
        minuterie = setTimeout(() => void relire(), INTERVALLE_MS);
      }
    };
    relireRef.current = relire;

    const aRelire = () => {
      setAJour(false);
      void relire();
    };
    const aLaCoupure = () => setHorsLigne(true);
    const aLaVue = () => {
      if (document.visibilityState === 'visible') aRelire();
    };
    // Page rendue par le cache d'historique : aucun `visibilitychange` ne l'annonce toujours.
    const auRetourHistorique = (e: PageTransitionEvent) => {
      if (e.persisted) aRelire();
    };

    window.addEventListener('online', aRelire);
    window.addEventListener('offline', aLaCoupure);
    window.addEventListener('pageshow', auRetourHistorique);
    document.addEventListener('visibilitychange', aLaVue);
    // Dès l'ouverture : la page peut venir d'un préchargement (lien de la carte), donc d'avant la
    // manche en cours, et c'est cette lecture qui cale l'horloge des chronos.
    void relire();

    return () => {
      actif = false;
      clearTimeout(minuterie);
      window.removeEventListener('online', aRelire);
      window.removeEventListener('offline', aLaCoupure);
      window.removeEventListener('pageshow', auRetourHistorique);
      document.removeEventListener('visibilitychange', aLaVue);
    };
  }, [code, router, recevoir]);

  useEffect(() => {
    let canal: RealtimeChannel | null = null;
    let etalement: ReturnType<typeof setTimeout> | undefined;
    let derniere = 0;
    try {
      const supabase = supabaseNavigateur();
      canal = supabase.channel(`salle:${evenementId}`, {
        config: { broadcast: { self: false } },
      });
      canal
        .on('broadcast', { event: SIGNAL }, () => {
          if (etalement !== undefined) return;
          const attente = Math.max(
            Math.random() * ETALEMENT_MS,
            derniere + ECART_MIN_MS - Date.now(),
          );
          etalement = setTimeout(() => {
            etalement = undefined;
            derniere = Date.now();
            void relireRef.current();
          }, attente);
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

  return { etat, horsLigne, aJour, decalageMs, remplacer, relire };
}
