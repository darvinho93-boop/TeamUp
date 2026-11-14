'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import { CADENCE_MESSAGE_S, caracteresRestants, nettoyerMessage } from '@/lib/messages';

type Erreur = 'vide' | 'long' | 'fermes' | 'termine' | 'serveur';

/** Après « C'est à l'écran ! », la fenêtre se referme seule. */
const FERMETURE_MS = 1500;

/**
 * Un message pour le grand écran (2026-11-15) : un bouton en face du logo, qui ouvre une petite
 * fenêtre. Le message paraît aussitôt sur l'écran commun, avec le prénom du joueur. La base
 * tranche (envois ouverts, 100 caractères, un message toutes les 20 s) ; le téléphone le dit.
 */
export function MessageEcran({ code }: { code: string }) {
  const t = useTranslations('messageEcran');
  const dialogue = useRef<HTMLDialogElement>(null);
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState<Erreur>();
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  // Fin de l'attente entre deux messages, à l'heure de ce téléphone.
  const [attenteJusqua, setAttenteJusqua] = useState(0);
  const [maintenant, setMaintenant] = useState(0);

  const attenteS = Math.max(0, Math.ceil((attenteJusqua - maintenant) / 1000));
  useEffect(() => {
    if (attenteJusqua === 0) return;
    const pas = () => setMaintenant(Date.now());
    const premier = setTimeout(pas, 0);
    const minuterie = setInterval(pas, 500);
    return () => {
      clearTimeout(premier);
      clearInterval(minuterie);
    };
  }, [attenteJusqua]);

  const ouvrir = () => {
    setEnvoye(false);
    setErreur(undefined);
    dialogue.current?.showModal();
  };
  const fermer = () => dialogue.current?.close();

  const attendre = (secondes: number) => {
    setAttenteJusqua(Date.now() + secondes * 1000);
    setMaintenant(Date.now());
  };

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    const propre = nettoyerMessage(texte);
    if (!propre) return setErreur(texte.trim() ? 'long' : 'vide');
    setEnvoi(true);
    setErreur(undefined);
    try {
      const reponse = await fetch(`/api/partie/${code}/message`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texte: propre }),
      });
      if (reponse.ok) {
        setTexte('');
        setEnvoye(true);
        attendre(CADENCE_MESSAGE_S);
        setTimeout(fermer, FERMETURE_MS);
        return;
      }
      const { erreur: refus, attente_s } = (await reponse.json().catch(() => ({}))) as {
        erreur?: string;
        attente_s?: number | null;
      };
      if (refus === 'cadence') return attendre(attente_s ?? CADENCE_MESSAGE_S);
      setErreur(
        refus === 'fermes' || refus === 'termine'
          ? refus
          : refus === 'message'
            ? 'long'
            : 'serveur',
      );
    } catch {
      setErreur('serveur');
    } finally {
      setEnvoi(false);
    }
  };

  const restants = caracteresRestants(texte);
  return (
    <>
      <button
        type="button"
        className="tu-player__outil"
        onClick={ouvrir}
        aria-label={t('ouvrir')}
        title={t('ouvrir')}
        data-testid="ouvrir-message"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <dialog ref={dialogue} className="tu-carte-dialogue" aria-labelledby="titre-message">
        <form className="tu-message-ecran" onSubmit={(e) => void envoyer(e)} noValidate>
          <h2 id="titre-message" className="tu-message-ecran__titre">
            {t('titre')}
          </h2>
          <p className="tu-player__lead">{t('aide')}</p>
          <TextField
            label={t('champ')}
            multiline
            value={texte}
            onChange={(e) => {
              setTexte(e.target.value);
              setEnvoye(false);
            }}
            autoComplete="off"
            enterKeyHint="done"
            hint={t('restants', { n: Math.max(0, restants) })}
            {...(erreur ? { error: t(erreur) } : {})}
          />
          <p className="tu-message-ecran__statut" role="status" data-testid="statut-message">
            {envoye ? t('envoye') : attenteS > 0 ? t('attente', { s: attenteS }) : ''}
          </p>
          <div className="tu-player__actions">
            <Button
              type="submit"
              variant="accent"
              size="lg"
              block
              disabled={envoi || attenteS > 0 || restants < 0}
            >
              {t('envoyer')}
            </Button>
            <Button variant="ghost" size="lg" block onClick={fermer}>
              {t('fermer')}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
