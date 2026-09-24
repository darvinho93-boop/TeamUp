'use client';

import { useEffect, useState } from 'react';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';

/** Durée de vie d'une URL signée : largement plus qu'une diffusion. */
const DUREE_S = 60 * 60;
/** Une URL est redemandée un peu avant d'expirer. */
const MARGE_MS = 5 * 60 * 1000;

const cache = new Map<string, { url: string; expire: number }>();

/**
 * URL signées des photos, demandées par la session de l'animateur (policy du bucket, lot 3) :
 * aucun téléphone n'en obtient. Toutes les photos de la diffusion sont signées d'un coup, dès
 * que l'écran reçoit leurs chemins : changer de thème ne coûte ensuite aucune requête.
 */
export function usePhotosSignees(chemins: readonly string[]): Record<string, string> {
  const cle = [...chemins].sort().join('|');
  const [urls, setUrls] = useState<Record<string, string>>(() => depuisLeCache(chemins));

  useEffect(() => {
    const liste = cle ? cle.split('|') : [];
    const manquants = liste.filter((c) => (cache.get(c)?.expire ?? 0) < Date.now() + MARGE_MS);
    let actif = true;
    if (manquants.length === 0) {
      setUrls(depuisLeCache(liste));
      return;
    }
    void supabaseNavigateur()
      .storage.from('photos')
      .createSignedUrls(manquants, DUREE_S)
      .then(({ data }) => {
        const expire = Date.now() + DUREE_S * 1000;
        for (const signee of data ?? []) {
          if (signee.path && signee.signedUrl) {
            cache.set(signee.path, { url: signee.signedUrl, expire });
          }
        }
        // Les images descendent aussi d'avance : au changement de thème, elles sont déjà là.
        for (const url of Object.values(depuisLeCache(manquants))) new Image().src = url;
        if (actif) setUrls(depuisLeCache(liste));
      });
    return () => {
      actif = false;
    };
  }, [cle]);

  return urls;
}

function depuisLeCache(chemins: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    chemins.flatMap((c) => {
      const entree = cache.get(c);
      return entree ? [[c, entree.url]] : [];
    }),
  );
}
