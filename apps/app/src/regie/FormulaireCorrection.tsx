'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import { corriger } from '@/app/regie/[code]/scores/actions';

/** Correction manuelle d'un score : des points en plus ou en moins, avec un motif. */
export function FormulaireCorrection({
  code,
  equipes,
}: {
  code: string;
  equipes: { id: string; nom: string }[];
}) {
  const t = useTranslations('regie.scores');
  const [etat, action, envoi] = useActionState(corriger.bind(null, code), undefined);
  return (
    <form action={action} className="tu-regie__section">
      <div className="tu-regie__form">
        <label className="tu-field">
          <span className="tu-field__label">{t('equipe')}</span>
          <select name="equipe" required>
            {equipes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label={t('points')}
          name="points"
          type="number"
          min={-1000}
          max={1000}
          step={1}
          hint={t('pointsAide')}
          required
        />
        <TextField label={t('motif')} name="motif" maxLength={200} required />
      </div>
      {etat?.erreur && (
        <p className="tu-regie__alert" role="alert">
          {etat.erreur}
        </p>
      )}
      <div>
        <Button type="submit" disabled={envoi}>
          {t('ajouter')}
        </Button>
      </div>
    </form>
  );
}
