'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import { changerMotDePasse } from '@/app/regie/actions';
import { MOT_DE_PASSE_MIN } from '@/lib/comptes';

export function FormulaireMotDePasse() {
  const t = useTranslations('regie.compte');
  const [etat, action, envoi] = useActionState(changerMotDePasse, undefined);
  return (
    <form action={action} className="tu-regie__section">
      <TextField
        label={t('motDePasse')}
        hint={t('aide', { min: MOT_DE_PASSE_MIN })}
        name="motDePasse"
        type="password"
        autoComplete="new-password"
        minLength={MOT_DE_PASSE_MIN}
        required
      />
      <TextField
        label={t('confirmation')}
        name="confirmation"
        type="password"
        autoComplete="new-password"
        minLength={MOT_DE_PASSE_MIN}
        required
      />
      {etat?.erreur && (
        <p className="tu-regie__alert" role="alert">
          {etat.erreur}
        </p>
      )}
      {etat?.ok && (
        <p className="tu-regie__muted" role="status">
          {etat.ok}
        </p>
      )}
      <div>
        <Button type="submit" size="lg" disabled={envoi}>
          {t('bouton')}
        </Button>
      </div>
    </form>
  );
}
