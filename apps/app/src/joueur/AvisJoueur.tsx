'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import {
  AVIS_POSITIFS_MAX,
  negatifValide,
  positifsValides,
  restantsNegatif,
  restantsPositif,
  type AvisDuJoueur,
} from '@/lib/avis';
import type { EtatJoueur } from '@/lib/partie';

type Etape = 'aime' | 'moins' | 'merci';
type Erreur = 'aimeVide' | 'aimeLong' | 'moinsVide' | 'moinsLong' | 'fermes' | 'serveur';

/** Sous ce reste, le champ dit combien de caractères il reste. */
const SEUIL_RESTANTS = 30;

const troisChamps = (positifs: readonly string[] = []) =>
  Array.from({ length: AVIS_POSITIFS_MAX }, (_, i) => positifs[i] ?? '');

/**
 * L'avis du joueur sur la soirée (2026-11-18), en deux temps : d'abord ce qu'il a aimé (une à
 * trois choses), puis ce qui lui a moins plu, ou « Rien à redire ». La case témoignage autorise
 * Team Up! à citer ses mots avec son prénom ; sinon l'avis reste anonyme. Un avis par
 * téléphone : le renvoyer le remplace.
 */
export function AvisJoueur({
  code,
  avis,
  remplacer,
  retour,
}: {
  code: string;
  avis: AvisDuJoueur | null;
  remplacer: (etat: EtatJoueur) => void;
  retour: () => void;
}) {
  const t = useTranslations('avis');
  const [etape, setEtape] = useState<Etape>(avis ? 'merci' : 'aime');
  const [positifs, setPositifs] = useState(() => troisChamps(avis?.positifs));
  const [negatif, setNegatif] = useState(avis?.negatif ?? '');
  const [citable, setCitable] = useState(avis?.citable ?? false);
  const [erreur, setErreur] = useState<Erreur>();
  const [envoi, setEnvoi] = useState(false);

  const aller = (suivante: Etape) => {
    setErreur(undefined);
    setEtape(suivante);
  };

  const suivant = (e: FormEvent) => {
    e.preventDefault();
    if (positifsValides(positifs)) return aller('moins');
    setErreur(positifs.some((p) => restantsPositif(p) < 0) ? 'aimeLong' : 'aimeVide');
  };

  const envoyer = async (rienARedire: boolean) => {
    const aime = positifsValides(positifs);
    if (!aime) return aller('aime');
    const moins = rienARedire ? null : negatifValide(negatif);
    if (!rienARedire && !moins) {
      return setErreur(restantsNegatif(negatif) < 0 ? 'moinsLong' : 'moinsVide');
    }
    setEnvoi(true);
    setErreur(undefined);
    try {
      const corps: AvisDuJoueur = {
        positifs: aime,
        negatif: moins,
        rien_a_redire: rienARedire,
        citable,
      };
      const reponse = await fetch(`/api/partie/${code}/avis`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corps),
      });
      if (reponse.ok) {
        remplacer((await reponse.json()) as EtatJoueur);
        if (rienARedire) setNegatif('');
        return aller('merci');
      }
      const { erreur: refus } = (await reponse.json().catch(() => ({}))) as { erreur?: string };
      setErreur(refus === 'fermes' ? 'fermes' : 'serveur');
    } catch {
      setErreur('serveur');
    } finally {
      setEnvoi(false);
    }
  };

  const message = erreur ? (
    <p className="tu-player__error" role="alert">
      {t(`erreur.${erreur}`)}
    </p>
  ) : null;

  if (etape === 'merci') {
    return (
      <div className="tu-player__body" data-testid="avis-merci">
        <h1 className="tu-player__title">{t('merci.titre')}</h1>
        <p className="tu-player__lead">{t('merci.aide')}</p>
        <div className="tu-player__actions">
          <Button variant="outline" size="lg" block onClick={() => aller('aime')}>
            {t('merci.modifier')}
          </Button>
          <Button variant="ghost" size="lg" block onClick={retour}>
            {t('retour')}
          </Button>
        </div>
      </div>
    );
  }

  if (etape === 'moins') {
    const restants = restantsNegatif(negatif);
    return (
      <form
        className="tu-player__body"
        onSubmit={(e) => {
          e.preventDefault();
          void envoyer(false);
        }}
        noValidate
        data-testid="avis-moins"
      >
        <p className="tu-avis__etape">{t('etape', { n: 2 })}</p>
        <h1 className="tu-player__title">{t('moins.titre')}</h1>
        <p className="tu-player__lead">{t('moins.aide')}</p>
        <TextField
          label={t('moins.champ')}
          multiline
          value={negatif}
          onChange={(e) => {
            setNegatif(e.target.value);
            setErreur(undefined);
          }}
          autoComplete="off"
          enterKeyHint="done"
          {...(restants <= SEUIL_RESTANTS
            ? { hint: t('restants', { n: Math.max(0, restants) }) }
            : {})}
        />
        {message}
        <div className="tu-player__actions">
          <Button type="submit" variant="accent" size="lg" block disabled={envoi}>
            {t('moins.envoyer')}
          </Button>
          <Button
            variant="outline"
            size="lg"
            block
            disabled={envoi}
            onClick={() => void envoyer(true)}
          >
            {t('moins.rien')}
          </Button>
          <Button variant="ghost" size="lg" block onClick={() => aller('aime')}>
            {t('precedent')}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form className="tu-player__body" onSubmit={suivant} noValidate data-testid="avis-aime">
      <p className="tu-avis__etape">{t('etape', { n: 1 })}</p>
      <h1 className="tu-player__title">{t('aime.titre')}</h1>
      <p className="tu-player__lead">{t('aime.aide')}</p>
      {positifs.map((texte, i) => {
        const restants = restantsPositif(texte);
        return (
          <TextField
            key={i}
            label={t('aime.champ', { n: i + 1 })}
            multiline
            value={texte}
            onChange={(e) => {
              const suivants = [...positifs];
              suivants[i] = e.target.value;
              setPositifs(suivants);
              setErreur(undefined);
            }}
            autoComplete="off"
            enterKeyHint={i < positifs.length - 1 ? 'next' : 'done'}
            {...(restants <= SEUIL_RESTANTS
              ? { hint: t('restants', { n: Math.max(0, restants) }) }
              : {})}
          />
        );
      })}
      <label className="tu-avis__case">
        <input
          type="checkbox"
          checked={citable}
          onChange={(e) => setCitable(e.target.checked)}
          data-testid="avis-citable"
        />
        <span>{t('aime.citable')}</span>
      </label>
      {message}
      <div className="tu-player__actions">
        <Button type="submit" variant="accent" size="lg" block>
          {t('aime.suivant')}
        </Button>
        <Button variant="ghost" size="lg" block onClick={retour}>
          {t('retour')}
        </Button>
      </div>
    </form>
  );
}
