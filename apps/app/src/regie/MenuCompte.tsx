'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Menu replié de l'en-tête (compte, langue, déconnexion). L'en-tête vit dans un gabarit qui ne se
 * remonte pas d'une page à l'autre : le menu se referme au changement de page et au toucher hors
 * de lui.
 */
export function MenuCompte({ libelle, children }: { libelle: string; children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const chemin = usePathname();

  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [chemin]);

  useEffect(() => {
    const fermer = (e: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(e.target as Node)) menu.current.open = false;
    };
    document.addEventListener('pointerdown', fermer);
    return () => document.removeEventListener('pointerdown', fermer);
  }, []);

  return (
    <details ref={menu} className="tu-regie__menu">
      <summary className="tu-btn tu-btn--ghost">{libelle}</summary>
      <div className="tu-regie__tools">{children}</div>
    </details>
  );
}
