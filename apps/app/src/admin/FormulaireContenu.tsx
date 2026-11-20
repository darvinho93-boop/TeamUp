'use client';

import { startTransition, useActionState, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import { enregistrerContenu } from '@/app/admin/contenus/actions';
import {
  CHAMPS,
  ETIQUETTES,
  longueurMax,
  nomChamp,
  type Champ,
  type JeuContenu,
} from '@/lib/contenus';
import {
  cheminExtrait,
  refusExtrait,
  type ExtraitDuPassage,
  type RefusExtrait,
} from '@/lib/extraits';
import { NOMS_LANGUES } from '@/lib/langue-navigateur';
import { LANGUES } from '@/lib/partie';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';
import { ChampExtrait, type ExtraitChoisi } from './ChampExtrait';

const LETTRES = ['A', 'B', 'C', 'D'] as const;

const estProposition = (champ: Champ): champ is Extract<Champ, `proposition${number}`> =>
  champ.startsWith('proposition');

/**
 * Un contenu, un bloc par langue. Le français est obligatoire ; l'anglais et le tamoul se
 * laissent vides ou se remplissent en entier. Les erreurs s'affichent en face de leur champ.
 *
 * Ciné-mime (2026-11-20) : la vidéo de la scène part d'abord du navigateur droit vers le stockage
 * (une fonction Vercel plafonne une requête à 4,5 Mo), puis le contenu s'enregistre avec son
 * chemin ; le serveur retire le fichier si l'enregistrement échoue.
 */
export function FormulaireContenu({
  jeu,
  id,
  valeurs: initiales,
  extrait = null,
}: {
  jeu: JeuContenu;
  id: string | null;
  valeurs: Record<string, string>;
  extrait?: ExtraitDuPassage | null;
}) {
  const t = useTranslations('admin.formulaire');
  const tEtiquettes = useTranslations('admin.etiquettes');
  const [etat, action, envoi] = useActionState(enregistrerContenu.bind(null, jeu, id), undefined);
  const valeurs = etat?.valeurs ?? initiales;
  const [choisi, setChoisi] = useState<ExtraitChoisi | null>(null);
  const [refusVideo, setRefusVideo] = useState<RefusExtrait | 'envoi' | null>(null);
  const [depot, setDepot] = useState(false);

  const choisir = (suivant: ExtraitChoisi | null) => {
    if (choisi) URL.revokeObjectURL(choisi.adresse);
    setChoisi(suivant);
    setRefusVideo(null);
  };

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    if (jeu !== 'cinemime') return;
    e.preventDefault();
    const donnees = new FormData(e.currentTarget);
    donnees.delete('video');
    setRefusVideo(null);
    if (choisi) {
      const debut = new Uint8Array(await choisi.fichier.slice(0, 8).arrayBuffer());
      const refus = refusExtrait({ taille: choisi.fichier.size, debut, dureeMs: choisi.dureeMs });
      if (refus) return setRefusVideo(refus);
      setDepot(true);
      const chemin = cheminExtrait(crypto.randomUUID());
      const { error } = await supabaseNavigateur()
        .storage.from('extraits')
        .upload(chemin, choisi.fichier, { contentType: 'video/mp4', upsert: false });
      setDepot(false);
      if (error) return setRefusVideo('envoi');
      donnees.set('extrait_chemin', chemin);
      donnees.set('extrait_duree_ms', String(Math.round(choisi.dureeMs ?? 0)));
    } else if (!extrait) {
      return setRefusVideo('vide');
    }
    startTransition(() => action(donnees));
  }
  const erreur = (nom: string) => {
    const code = etat?.erreurs[nom];
    return code
      ? t(`erreurs.${code}`, { max: longueurMax(jeu, nom.split('.').pop() ?? '') })
      : undefined;
  };

  return (
    // Remonté à chaque réponse : React vide le formulaire après un envoi, les valeurs rendues
    // reviennent ainsi par defaultValue, listes déroulantes comprises.
    <form
      key={etat?.instant}
      action={action}
      onSubmit={(e) => void envoyer(e)}
      className="tu-regie__section"
      noValidate
    >
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
          <div className="tu-admin-champs">
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
                  maxLength={longueurMax(jeu, champ)}
                  required={langue === 'fr'}
                  {...(message ? { error: message } : {})}
                  lang={langue}
                  autoComplete="off"
                  multiline
                  // Les quatre réponses deux par deux, comme à l'écran ; tout le reste en pleine largeur.
                  {...(estProposition(champ) ? {} : { className: 'tu-admin-champs__large' })}
                />
              );
            })}
          </div>
        </fieldset>
      ))}

      {jeu === 'cinemime' && (
        <ChampExtrait
          existant={extrait}
          choisi={choisi}
          onChoisir={choisir}
          erreur={refusVideo ? t(`extrait.erreurs.${refusVideo}`) : null}
          desactive={depot || envoi}
        />
      )}

      {etat?.erreur && (
        <p className="tu-regie__alert" role="alert">
          {etat.erreur}
        </p>
      )}
      <div>
        <Button type="submit" size="lg" disabled={envoi || depot}>
          {depot ? t('extrait.envoi') : t('enregistrer')}
        </Button>
      </div>
    </form>
  );
}
