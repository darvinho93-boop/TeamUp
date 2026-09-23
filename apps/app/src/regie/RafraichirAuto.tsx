'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Relit la page serveur à intervalle régulier (suivi des connexions dans la salle). */
export function RafraichirAuto({ intervalleMs }: { intervalleMs: number }) {
  const router = useRouter();
  useEffect(() => {
    const minuterie = setInterval(() => router.refresh(), intervalleMs);
    return () => clearInterval(minuterie);
  }, [router, intervalleMs]);
  return null;
}
