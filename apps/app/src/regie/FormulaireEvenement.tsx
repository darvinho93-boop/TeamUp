'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import { creerEvenement } from '@/app/regie/actions';
import { NOMS_LANGUES } from '@/lib/langue-navigateur';
import { LANGUES } from '@/lib/partie';

/** Créer un événement : le minimum pour préparer le programme. */
export function FormulaireEvenement() {
  const t = useTranslations('regie.evenements');
  const [etat, action, envoi] = useActionState(creerEvenement, undefined);
  return (
    <form action={action} className="tu-regie__section">
      <div className="tu-regie__form">
        <TextField label={t('client')} name="client" required maxLength={200} />
        <label className="tu-field">
          <span className="tu-field__label">{t('type')}</span>
          <select name="type" defaultValue="particulier">
            <option value="particulier">{t('particulier')}</option>
            <option value="entreprise">{t('entreprise')}</option>
          </select>
        </label>
        <TextField label={t('date')} name="date" type="date" required />
        <TextField
          label={t('creneauChamp')}
          name="creneau"
          type="number"
          min={10}
          max={240}
          step={5}
          defaultValue={40}
          required
        />
        <TextField
          label={t('equipes')}
          name="equipes"
          type="number"
          min={2}
          max={8}
          defaultValue={4}
          required
        />
      </div>
      <fieldset className="tu-regie__choices">
        <legend className="tu-field__label">{t('langues')}</legend>
        {LANGUES.map((l) => (
          <label key={l} lang={l}>
            <input type="checkbox" name="langues" value={l} defaultChecked={l === 'fr'} />
            {NOMS_LANGUES[l]}
          </label>
        ))}
      </fieldset>
      {etat?.erreur && (
        <p className="tu-regie__alert" role="alert">
          {etat.erreur}
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
