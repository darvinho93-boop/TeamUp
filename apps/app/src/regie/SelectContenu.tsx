'use client';

import { useTransition } from 'react';
import { choisirContenu } from '@/app/regie/[code]/preparation/actions';

export interface OptionContenu {
  id: string;
  libelle: string;
}

/** Choix du contenu d'un passage dans la banque ; enregistré dès qu'il change. */
export function SelectContenu({
  code,
  passageId,
  valeur,
  options,
  desactive,
  libelle,
  aucun,
}: {
  code: string;
  passageId: string;
  valeur: string | null;
  options: OptionContenu[];
  desactive: boolean;
  libelle: string;
  aucun: string;
}) {
  const [enCours, demarrer] = useTransition();
  return (
    <select
      aria-label={libelle}
      defaultValue={valeur ?? ''}
      disabled={desactive || enCours}
      onChange={(e) => {
        const contenu = e.target.value;
        demarrer(() => choisirContenu(code, passageId, contenu));
      }}
    >
      <option value="">{aucun}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.libelle}
        </option>
      ))}
    </select>
  );
}
