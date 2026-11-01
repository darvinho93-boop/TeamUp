'use client';

import { useTransition } from 'react';
import { choisirContenu } from '@/app/regie/[code]/preparation/actions';

export interface OptionContenu {
  id: string;
  libelle: string;
}

/**
 * Choix du contenu d'un passage dans la banque ; enregistré dès qu'il change. Avec `enregistrer`
 * (une action serveur déjà liée), il écrit ailleurs : une ligne de la réserve (lot 14).
 */
export function SelectContenu({
  code,
  passageId,
  enregistrer,
  valeur,
  options,
  desactive,
  libelle,
  aucun,
}: {
  code: string;
  passageId?: string;
  enregistrer?: (contenu: string) => Promise<void>;
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
        demarrer(() =>
          enregistrer
            ? enregistrer(contenu)
            : passageId
              ? choisirContenu(code, passageId, contenu)
              : Promise.resolve(),
        );
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
