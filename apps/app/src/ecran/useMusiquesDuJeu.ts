'use client';

import { useEffect, useState } from 'react';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';

/** Une musique de la bibliothèque, telle que la régie et l'écran commun la lisent. */
export interface MusiqueDuJeu {
  id: string;
  titre: string;
  artiste: string | null;
  chemin: string;
  actif: boolean;
}

/**
 * Les musiques d'un jeu (blind test, 2026-11-15), lues dans la bibliothèque sous la session de
 * l'animateur : la régie y lit la réponse, l'écran le fichier. Jamais un téléphone (le bucket
 * et la table sont fermés sans compte).
 */
export function useMusiquesDuJeu(ids: readonly string[]): ReadonlyMap<string, MusiqueDuJeu> {
  const cle = [...new Set(ids)].sort().join('|');
  const [musiques, setMusiques] = useState<ReadonlyMap<string, MusiqueDuJeu>>(() => new Map());
  useEffect(() => {
    if (!cle) {
      setMusiques((avant) => (avant.size ? new Map() : avant));
      return;
    }
    let actif = true;
    void supabaseNavigateur()
      .from('musiques')
      .select('id, titre, artiste, chemin, actif')
      .in('id', cle.split('|'))
      .then(({ data }) => {
        if (actif) setMusiques(new Map((data ?? []).map((m) => [m.id, m])));
      });
    return () => {
      actif = false;
    };
  }, [cle]);
  return musiques;
}
