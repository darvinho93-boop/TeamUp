'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { EtatSalle } from '@/lib/salle';
import { Salle } from '@/ecran/Salle';

/**
 * L'écran commun en réduction, dans la régie : les mêmes composants que l'écran projeté,
 * à sa taille de référence (1 920 × 1 080), mis à l'échelle de la place disponible.
 */
export function Apercu(props: {
  etat: EtatSalle;
  decalageMs: number;
  qrSvg: string;
  adresse: string;
}) {
  const cadre = useRef<HTMLDivElement>(null);
  const [echelle, setEchelle] = useState(0.4);

  useEffect(() => {
    const element = cadre.current;
    if (!element) return;
    const mesurer = () => {
      const scene = element.firstElementChild as HTMLElement | null;
      if (scene?.offsetWidth) setEchelle(element.clientWidth / scene.offsetWidth);
    };
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(element);
    mesurer();
    return () => observateur.disconnect();
  }, []);

  return (
    <div
      ref={cadre}
      className="tu-regie-preview"
      style={{ '--tu-stage-echelle': echelle } as CSSProperties}
    >
      <Salle {...props} apercu />
    </div>
  );
}
