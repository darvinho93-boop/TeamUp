'use client';

import { useEffect, useState } from 'react';
import { parolesDe, type LigneParoles } from '@/lib/paroles';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';

/**
 * Les paroles des titres d'un blind test (2026-11-23), lues d'avance sous la session de
 * l'animateur. À part de `useMusiquesDuJeu` : sans la migration, seul le karaoké perd ses paroles,
 * le jeu continue. Jamais un téléphone (la table est fermée sans compte).
 */
export function useParoles(ids: readonly string[]): ReadonlyMap<string, LigneParoles[]> {
  const cle = [...new Set(ids)].sort().join('|');
  const [paroles, setParoles] = useState<ReadonlyMap<string, LigneParoles[]>>(() => new Map());
  useEffect(() => {
    if (!cle) {
      setParoles((avant) => (avant.size ? new Map() : avant));
      return;
    }
    let actif = true;
    void supabaseNavigateur()
      .from('musiques')
      .select('id, paroles')
      .in('id', cle.split('|'))
      .then(({ data, error }) => {
        if (!actif || error) return;
        setParoles(new Map((data ?? []).map((m) => [m.id, parolesDe(m.paroles)])));
      });
    return () => {
      actif = false;
    };
  }, [cle]);
  return paroles;
}
