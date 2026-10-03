'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import { creerAnimateur } from '@/app/admin/animateurs/actions';
import { MOT_DE_PASSE_MIN } from '@/lib/comptes';

/** Nouveau compte : l'admin pose un mot de passe provisoire et le transmet lui-même. */
export function FormulaireAnimateur() {
  const t = useTranslations('admin.animateurs');
  const [etat, action, envoi] = useActionState(creerAnimateur, undefined);
  return (
    // Un compte créé vide le formulaire : la clé change avec le message de réussite.
    <form key={etat?.ok} action={action} className="tu-regie__section">
      <div className="tu-regie__form">
        <TextField label={t('nom')} name="nom" required maxLength={100} autoComplete="off" />
        <TextField label={t('email')} name="email" type="email" required autoComplete="off" />
        <TextField
          label={t('motDePasse')}
          hint={t('aideMotDePasse', { min: MOT_DE_PASSE_MIN })}
          name="motDePasse"
          // En clair : l'admin doit pouvoir le relire avant de le transmettre.
          type="text"
          minLength={MOT_DE_PASSE_MIN}
          maxLength={72}
          required
          autoComplete="off"
          spellCheck={false}
        />
        <label className="tu-field">
          <span className="tu-field__label">{t('role')}</span>
          <select name="role" defaultValue="animateur">
            <option value="animateur">{t('roles.animateur')}</option>
            <option value="admin">{t('roles.admin')}</option>
          </select>
        </label>
      </div>
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
          {t('creer')}
        </Button>
      </div>
    </form>
  );
}
