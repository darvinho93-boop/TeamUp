'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import { connecter } from '@/app/regie/actions';

export function FormulaireConnexion({ suite }: { suite: string | undefined }) {
  const t = useTranslations('regie.connexion');
  const [etat, action, envoi] = useActionState(connecter, undefined);
  return (
    <form action={action} className="tu-regie__section">
      <TextField label={t('email')} name="email" type="email" autoComplete="username" required />
      <TextField
        label={t('motDePasse')}
        name="motDePasse"
        type="password"
        autoComplete="current-password"
        required
      />
      {suite && <input type="hidden" name="suite" value={suite} />}
      {etat?.erreur && (
        <p className="tu-regie__alert" role="alert">
          {etat.erreur}
        </p>
      )}
      <Button type="submit" size="lg" disabled={envoi}>
        {t('bouton')}
      </Button>
    </form>
  );
}
