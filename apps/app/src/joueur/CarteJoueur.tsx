'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import {
  CARTE_ANECDOTE_MAX,
  CARTE_METIER_MAX,
  carteVide,
  restants,
  saisieCarte,
  type CarteDuJoueur,
  type CarteSaisie,
  type ErreurCarte,
} from '@/lib/cartes';
import type { EtatJoueur } from '@/lib/partie';

type Etape = 'saisie' | 'merci';
type Erreur = ErreurCarte | 'vide' | 'termine' | 'serveur';

/** Sous ce reste, le champ dit combien de caractères il reste. */
const SEUIL_RESTANTS = 20;

/**
 * La carte « Faisons connaissance » du joueur (2026-11-18, audit du même jour) : son âge, son
 * métier, une anecdote, chacun facultatif, et l'accord d'affichage (décoché par défaut). Si son
 * équipe gagne un jeu, la régie peut la tirer au sort et la présenter sur le grand écran. Un
 * aperçu montre ce qui serait affiché ; tout vider supprime la carte.
 */
export function CarteJoueur({
  code,
  prenom,
  carte,
  remplacer,
  retour,
}: {
  code: string;
  prenom: string;
  carte: CarteDuJoueur | null;
  remplacer: (etat: EtatJoueur) => void;
  retour: () => void;
}) {
  const t = useTranslations('maCarte');
  const [etape, setEtape] = useState<Etape>(carte ? 'merci' : 'saisie');
  const [age, setAge] = useState(carte?.age?.toString() ?? '');
  const [metier, setMetier] = useState(carte?.metier ?? '');
  const [anecdote, setAnecdote] = useState(carte?.anecdote ?? '');
  const [accord, setAccord] = useState(carte?.accord ?? false);
  const [erreur, setErreur] = useState<Erreur>();
  const [envoi, setEnvoi] = useState(false);
  const [supprimee, setSupprimee] = useState(false);

  const envoyer = async (saisie: CarteSaisie) => {
    setEnvoi(true);
    setErreur(undefined);
    try {
      const reponse = await fetch(`/api/partie/${code}/carte`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(saisie),
      });
      if (reponse.ok) {
        remplacer((await reponse.json()) as EtatJoueur);
        return true;
      }
      const { erreur: refus } = (await reponse.json().catch(() => ({}))) as { erreur?: string };
      setErreur(refus === 'termine' ? 'termine' : 'serveur');
    } catch {
      setErreur('serveur');
    } finally {
      setEnvoi(false);
    }
    return false;
  };

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault();
    const saisie = saisieCarte({ age, metier, anecdote, accord });
    if (!saisie.ok) return setErreur(saisie.erreur);
    // Tout vide : une carte existante se supprime, une nouvelle n'a rien à enregistrer.
    if (carteVide(saisie.carte) && !carte) return setErreur('vide');
    if (await envoyer(saisie.carte)) {
      setSupprimee(carteVide(saisie.carte));
      setEtape('merci');
    }
  };

  const supprimer = async () => {
    if (await envoyer({ age: null, metier: null, anecdote: null, accord: false })) {
      setAge('');
      setMetier('');
      setAnecdote('');
      setAccord(false);
      setSupprimee(true);
    }
  };

  const message = erreur ? (
    <p className="tu-player__error" role="alert">
      {t(`erreur.${erreur}`)}
    </p>
  ) : null;

  if (etape === 'merci') {
    return (
      <div className="tu-player__body" data-testid="carte-merci">
        <h1 className="tu-player__title">{supprimee ? t('supprimee') : t('merci')}</h1>
        {!supprimee && (
          <>
            <p className="tu-player__lead">{accord ? t('merciAide') : t('sansAccord')}</p>
            {carte?.tiree && <p className="tu-player__lead">{t('tiree')}</p>}
          </>
        )}
        {message}
        <div className="tu-player__actions">
          <Button
            variant="outline"
            size="lg"
            block
            onClick={() => {
              setErreur(undefined);
              setEtape('saisie');
            }}
          >
            {supprimee ? t('ouvrir') : t('modifier')}
          </Button>
          {!supprimee && (
            <Button
              variant="ghost"
              size="lg"
              block
              disabled={envoi}
              onClick={() => void supprimer()}
            >
              {t('supprimer')}
            </Button>
          )}
          <Button variant="ghost" size="lg" block onClick={retour}>
            {t('retour')}
          </Button>
        </div>
      </div>
    );
  }

  const ageNombre = Number(age.trim());
  const ageAffiche = age.trim() !== '' && Number.isInteger(ageNombre) ? ageNombre : null;
  const metierPropre = metier.trim();
  const anecdotePropre = anecdote.trim();
  const restantsMetier = restants(metier, CARTE_METIER_MAX);
  const restantsAnecdote = restants(anecdote, CARTE_ANECDOTE_MAX);

  return (
    <form
      className="tu-player__body"
      onSubmit={(e) => void enregistrer(e)}
      noValidate
      data-testid="carte-saisie"
    >
      <h1 className="tu-player__title">{t('titre')}</h1>
      <p className="tu-player__lead">{t('intro')}</p>
      <TextField
        label={t('age')}
        value={age}
        onChange={(e) => {
          setAge(e.target.value);
          setErreur(undefined);
        }}
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="next"
        {...(erreur === 'age' ? { error: t('erreur.age') } : {})}
      />
      <TextField
        label={t('metier')}
        value={metier}
        onChange={(e) => {
          setMetier(e.target.value);
          setErreur(undefined);
        }}
        autoComplete="off"
        enterKeyHint="next"
        {...(erreur === 'metierLong'
          ? { error: t('erreur.metierLong') }
          : restantsMetier <= SEUIL_RESTANTS
            ? { hint: t('restants', { n: Math.max(0, restantsMetier) }) }
            : {})}
      />
      <TextField
        label={t('anecdote')}
        multiline
        value={anecdote}
        onChange={(e) => {
          setAnecdote(e.target.value);
          setErreur(undefined);
        }}
        autoComplete="off"
        enterKeyHint="done"
        {...(erreur === 'anecdoteLong'
          ? { error: t('erreur.anecdoteLong') }
          : restantsAnecdote <= SEUIL_RESTANTS
            ? { hint: t('restants', { n: Math.max(0, restantsAnecdote) }) }
            : { hint: t('exemple') })}
      />

      {(ageAffiche !== null || metierPropre || anecdotePropre) && (
        <section className="tu-ma-carte" aria-label={t('apercu')} data-testid="carte-apercu">
          <p className="tu-ma-carte__titre">{t('apercu')}</p>
          <p className="tu-ma-carte__prenom">{prenom}</p>
          {(ageAffiche !== null || metierPropre) && (
            <p className="tu-ma-carte__ligne">
              {[ageAffiche !== null ? t('ans', { age: ageAffiche }) : null, metierPropre || null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {anecdotePropre && <p className="tu-ma-carte__anecdote">{anecdotePropre}</p>}
        </section>
      )}

      <label className="tu-avis__case">
        <input
          type="checkbox"
          checked={accord}
          onChange={(e) => setAccord(e.target.checked)}
          data-testid="carte-accord"
        />
        <span>{t('accord')}</span>
      </label>
      {erreur &&
        erreur !== 'age' &&
        erreur !== 'metierLong' &&
        erreur !== 'anecdoteLong' &&
        message}
      <div className="tu-player__actions">
        <Button type="submit" variant="accent" size="lg" block disabled={envoi}>
          {t('enregistrer')}
        </Button>
        <Button variant="ghost" size="lg" block onClick={retour}>
          {t('plusTard')}
        </Button>
      </div>
    </form>
  );
}
