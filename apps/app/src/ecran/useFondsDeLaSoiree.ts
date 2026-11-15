'use client';

import { useEffect, useRef, useState } from 'react';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';

/** Le temps d'une URL signée : seulement celui du téléchargement, la photo est gardée ensuite. */
const SIGNATURE_S = 600;
const NOUVEL_ESSAI_MS = 10_000;

/**
 * Les photos de fond des jeux de la soirée (2026-11-15), téléchargées dès l'ouverture de l'écran
 * sous la session de l'animateur (bucket privé) et gardées en mémoire (`blob:`) : rien à attendre
 * au lancement d'un jeu, et le réseau peut tomber ensuite. Rend chemin → adresse locale.
 */
export function useFondsDeLaSoiree(chemins: readonly string[]): ReadonlyMap<string, string> {
  const cle = [...new Set(chemins)].sort().join('|');
  const [fonds, setFonds] = useState<ReadonlyMap<string, string>>(() => new Map());
  // Déjà téléchargés ou en cours : une relecture de l'état ne relance rien.
  const vus = useRef(new Map<string, string | null>());
  // Un téléchargement fini après un changement de liste reste utile : seul le démontage l'ignore.
  const monte = useRef(true);
  // Un téléchargement raté se retente : la soirée ne doit pas rester sans sa photo.
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    const nouveaux = cle ? cle.split('|').filter((c) => !vus.current.has(c)) : [];
    if (nouveaux.length === 0) return;
    for (const chemin of nouveaux) vus.current.set(chemin, null);
    void (async () => {
      const { data } = await supabaseNavigateur()
        .storage.from('fonds')
        .createSignedUrls(nouveaux, SIGNATURE_S);
      await Promise.all(
        nouveaux.map(async (chemin, i) => {
          const url = data?.[i]?.signedUrl;
          const blob = url
            ? await fetch(url)
                .then((r) => (r.ok ? r.blob() : null))
                .catch(() => null)
            : null;
          if (!blob) {
            vus.current.delete(chemin);
            setTimeout(() => {
              if (monte.current) setEssai((n) => n + 1);
            }, NOUVEL_ESSAI_MS);
            return;
          }
          const local = URL.createObjectURL(blob);
          vus.current.set(chemin, local);
          if (monte.current) setFonds((avant) => new Map(avant).set(chemin, local));
          else URL.revokeObjectURL(local);
        }),
      );
    })();
  }, [cle, essai]);

  // Les adresses locales sont libérées quand l'écran se ferme.
  useEffect(() => {
    const cache = vus.current;
    monte.current = true;
    return () => {
      monte.current = false;
      for (const local of cache.values()) if (local) URL.revokeObjectURL(local);
      cache.clear();
    };
  }, []);

  return fonds;
}
