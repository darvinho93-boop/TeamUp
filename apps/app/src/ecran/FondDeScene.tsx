'use client';

import { useState } from 'react';

/**
 * La photo de fond du jeu en cours (2026-11-15), derrière la scène et sous le voile beige. Elle
 * fond à l'arrivée ; au départ, la dernière reste posée le temps de son fondu de sortie.
 */
export function FondDeScene({ url }: { url: string | null }) {
  const [dernier, setDernier] = useState(url);
  if (url && url !== dernier) setDernier(url);
  if (!dernier) return null;
  return (
    <div
      className="tu-stage__fond"
      data-visible={url ? 'true' : 'false'}
      data-testid="fond"
      aria-hidden="true"
    >
      {/* Adresse locale (blob:) d'une photo déjà à la taille de la scène : rien à optimiser. */}
      <img key={dernier} src={dernier} alt="" />
    </div>
  );
}
