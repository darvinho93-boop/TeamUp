'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import { ajouterInvite } from '@/app/regie/[code]/salle/actions';

/**
 * Ajouter un invité sans téléphone : un prénom, et son groupe si la soirée en a. L'équipe se
 * tire comme à l'arrivée ; le formulaire se vide après chaque ajout.
 */
export function FormulaireInvite({
  code,
  groupes,
}: {
  code: string;
  groupes: { id: string; nom: string }[];
}) {
  const t = useTranslations('regie.salle');
  const [etat, action, envoi] = useActionState(ajouterInvite.bind(null, code), undefined);
  return (
    <form action={action} className="tu-regie__section" data-testid="ajout-invite">
      <h2 className="tu-regie__section-title">{t('ajoutTitre')}</h2>
      <p className="tu-regie__muted">{t('ajoutAide')}</p>
      <div className="tu-regie__form">
        <TextField label={t('prenom')} name="prenom" maxLength={40} autoComplete="off" required />
        {groupes.length > 0 && (
          <label className="tu-field">
            <span className="tu-field__label">{t('groupe')}</span>
            <select name="groupe" defaultValue="">
              <option value="">{t('sansGroupe')}</option>
              {groupes.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nom}
                </option>
              ))}
            </select>
          </label>
        )}
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
        <Button type="submit" disabled={envoi}>
          {t('ajouter')}
        </Button>
      </div>
    </form>
  );
}
