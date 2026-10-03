'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import { enregistrerContenu } from '@/app/admin/contenus/actions';
import {
  CHAMPS,
  ETIQUETTES,
  nomChamp,
  TEXTE_MAX,
  type Champ,
  type JeuContenu,
} from '@/lib/contenus';
import { NOMS_LANGUES } from '@/lib/langue-navigateur';
import { LANGUES } from '@/lib/partie';

const LETTRES = ['A', 'B', 'C', 'D'] as const;

const estProposition = (champ: Champ): champ is Extract<Champ, `proposition${number}`> =>
  champ.startsWith('proposition');

/**
 * Un contenu, un bloc par langue. Le français est obligatoire ; l'anglais et le tamoul se
 * laissent vides ou se remplissent en entier. Les erreurs s'affichent en face de leur champ.
 */
export function FormulaireContenu({
  jeu,
  id,
  valeurs: initiales,
}: {
  jeu: JeuContenu;
  id: string | null;
  valeurs: Record<string, string>;
}) {
  const t = useTranslations('admin.formulaire');
  const tEtiquettes = useTranslations('admin.etiquettes');
  const [etat, action, envoi] = useActionState(enregistrerContenu.bind(null, jeu, id), undefined);
  const valeurs = etat?.valeurs ?? initiales;
  const erreur = (nom: string) => {
    const code = etat?.erreurs[nom];
    return code ? t(`erreurs.${code}`, { max: TEXTE_MAX }) : undefined;
  };

  return (
    // Remonté à chaque réponse : React vide le formulaire après un envoi, les valeurs rendues
    // reviennent ainsi par defaultValue, listes déroulantes comprises.
    <form key={etat?.instant} action={action} className="tu-regie__section" noValidate>
      <div className="tu-regie__form">
        <label className="tu-field">
          <span className="tu-field__label">{t('etiquette')}</span>
          <select name="etiquette" defaultValue={valeurs['etiquette'] ?? 'tout_public'}>
            {ETIQUETTES.map((e) => (
              <option key={e} value={e}>
                {tEtiquettes(e)}
              </option>
            ))}
          </select>
        </label>
        {jeu === 'qcm2' && (
          <label className="tu-field">
            <span className="tu-field__label">{t('bonne')}</span>
            <select
              name="bonne"
              defaultValue={valeurs['bonne'] ?? ''}
              aria-invalid={erreur('bonne') !== undefined}
            >
              <option value="">—</option>
              {LETTRES.map((lettre, i) => (
                <option key={lettre} value={i}>
                  {t('proposition', { lettre })}
                </option>
              ))}
            </select>
            {erreur('bonne') && <span className="tu-field__error">{erreur('bonne')}</span>}
          </label>
        )}
      </div>

      {LANGUES.map((langue) => (
        <fieldset key={langue} className="tu-admin-langue">
          <legend lang={langue}>{NOMS_LANGUES[langue]}</legend>
          <p className="tu-admin-langue__aide">
            {langue === 'fr' ? t('obligatoire') : t('facultative')}
          </p>
          <div className="tu-regie__form">
            {CHAMPS[jeu].map((champ: Champ) => {
              const nom = nomChamp(langue, champ);
              const message = erreur(nom);
              return (
                <TextField
                  key={nom}
                  // Le libellé suit la langue de l'interface, la saisie celle du bloc.
                  label={
                    estProposition(champ)
                      ? t('proposition', { lettre: LETTRES[Number(champ.slice(-1)) - 1]! })
                      : t(`champs.${champ}`)
                  }
                  name={nom}
                  defaultValue={valeurs[nom] ?? ''}
                  maxLength={TEXTE_MAX}
                  required={langue === 'fr'}
                  {...(message ? { error: message } : {})}
                  lang={langue}
                  autoComplete="off"
                />
              );
            })}
          </div>
        </fieldset>
      ))}

      {etat?.erreur && (
        <p className="tu-regie__alert" role="alert">
          {etat.erreur}
        </p>
      )}
      <div>
        <Button type="submit" size="lg" disabled={envoi}>
          {t('enregistrer')}
        </Button>
      </div>
    </form>
  );
}
