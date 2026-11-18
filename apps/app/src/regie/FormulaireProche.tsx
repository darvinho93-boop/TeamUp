'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import { ajouterProche } from '@/app/regie/[code]/preparation/actions';
import { NOMS_LANGUES } from '@/lib/langue-navigateur';
import type { Langue } from '@/lib/partie';

/**
 * Portrait mystère (2026-11-18) : ajouter un proche de la soirée (le marié, la grand-mère, la
 * directrice…), son nom et trois indices dans chaque langue de la soirée. Il rejoint les portraits
 * proposés à cette soirée seulement ; les autres soirées et le back-office ne le voient pas.
 */
export function FormulaireProche({
  code,
  langues,
  proches,
}: {
  code: string;
  langues: readonly Langue[];
  /** Les noms des proches déjà ajoutés. */
  proches: readonly string[];
}) {
  const t = useTranslations('regie.preparation.portrait');
  const [etat, action, envoi] = useActionState(ajouterProche.bind(null, code), undefined);

  return (
    <details className="tu-regie__section" data-testid="proches">
      <summary className="tu-regie-item__title">{t('proches', { n: proches.length })}</summary>
      {proches.length > 0 && <p className="tu-regie__muted">{proches.join(' · ')}</p>}
      <p className="tu-regie__muted">{t('procheAide')}</p>
      {/* Remonté à chaque réponse : vide après un ajout, les valeurs rendues après une erreur. */}
      <form key={etat?.instant} action={action} className="tu-regie__form" noValidate>
        {langues.map((langue) => (
          <fieldset key={langue} className="tu-admin-langue">
            {langues.length > 1 && <legend lang={langue}>{NOMS_LANGUES[langue]}</legend>}
            <div className="tu-admin-champs">
              <TextField
                label={t('procheNom')}
                name={`${langue}.nom`}
                defaultValue={etat?.valeurs?.[`${langue}.nom`] ?? ''}
                maxLength={60}
                autoComplete="off"
                lang={langue}
                className="tu-admin-champs__large"
              />
              {[1, 2, 3].map((n) => (
                <TextField
                  key={n}
                  label={t('procheIndice', { n })}
                  name={`${langue}.indice${n}`}
                  defaultValue={etat?.valeurs?.[`${langue}.indice${n}`] ?? ''}
                  maxLength={200}
                  autoComplete="off"
                  lang={langue}
                  multiline
                  className="tu-admin-champs__large"
                />
              ))}
            </div>
          </fieldset>
        ))}
        {etat?.erreur && (
          <p className="tu-regie__alert" role="alert">
            {t(etat.erreur === 'champs' ? 'procheIncomplet' : 'procheErreur')}
          </p>
        )}
        {etat?.ok && (
          <p className="tu-regie__muted" role="status">
            {t('procheAjoute')}
          </p>
        )}
        <div>
          <Button type="submit" variant="ghost" disabled={envoi}>
            {t('procheAjouter')}
          </Button>
        </div>
      </form>
    </details>
  );
}
