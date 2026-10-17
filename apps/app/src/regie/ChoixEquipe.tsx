'use client';

import { useTransition } from 'react';
import { deplacerJoueur } from '@/app/regie/[code]/salle/actions';
import { useSignalSalle } from './SignalSalle';

/** Change l'équipe d'un joueur dès que le choix change. */
export function ChoixEquipe({
  code,
  joueurId,
  equipeId,
  equipes,
  libelle,
}: {
  code: string;
  joueurId: string;
  equipeId: string | null;
  equipes: { id: string; nom: string }[];
  libelle: string;
}) {
  const [enCours, demarrer] = useTransition();
  const signaler = useSignalSalle();
  return (
    <select
      aria-label={libelle}
      value={equipeId ?? ''}
      disabled={enCours}
      onChange={(e) => {
        const cible = e.target.value;
        if (cible)
          demarrer(async () => {
            await deplacerJoueur(code, joueurId, cible);
            signaler();
          });
      }}
    >
      {!equipeId && <option value="">—</option>}
      {equipes.map((e) => (
        <option key={e.id} value={e.id}>
          {e.nom}
        </option>
      ))}
    </select>
  );
}
