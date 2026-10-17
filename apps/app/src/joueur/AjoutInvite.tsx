'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import type { GroupePublic } from '@/lib/partie';

type Erreur = 'vide' | 'complet' | 'interdit' | 'close' | 'serveur';

/**
 * Un joueur autorisé par la régie ajoute un invité sans téléphone : son prénom, son groupe si la
 * soirée en a, puis l'équipe tirée, à lui annoncer. Comme à l'arrivée, le groupe ne sert qu'au
 * tirage.
 */
export function AjoutInvite({
  code,
  groupes,
  retour,
}: {
  code: string;
  groupes: GroupePublic[];
  retour: () => void;
}) {
  const t = useTranslations('ajout');
  const tGroupe = useTranslations('groupe');
  const [prenom, setPrenom] = useState('');
  const [etapeGroupe, setEtapeGroupe] = useState(false);
  const [erreur, setErreur] = useState<Erreur>();
  const [envoi, setEnvoi] = useState(false);
  const [ajoute, setAjoute] = useState<{ prenom: string; equipe: string | null } | null>(null);

  const recommencer = () => {
    setPrenom('');
    setEtapeGroupe(false);
    setErreur(undefined);
    setAjoute(null);
  };

  const validerPrenom = (e: FormEvent) => {
    e.preventDefault();
    if (!prenom.trim()) return setErreur('vide');
    setErreur(undefined);
    if (groupes.length > 0) return setEtapeGroupe(true);
    void envoyer(null);
  };

  const envoyer = async (groupe: string | null) => {
    setEnvoi(true);
    setErreur(undefined);
    try {
      const reponse = await fetch(`/api/partie/${code}/invite`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prenom, groupe }),
      });
      if (reponse.ok) return setAjoute((await reponse.json()) as typeof ajoute);
      const { erreur: code_ } = (await reponse.json().catch(() => ({}))) as { erreur?: string };
      setErreur(
        code_ === 'complet' || code_ === 'interdit' || code_ === 'close' ? code_ : 'serveur',
      );
      setEtapeGroupe(false);
    } catch {
      setErreur('serveur');
    } finally {
      setEnvoi(false);
    }
  };

  if (ajoute) {
    return (
      <div className="tu-player__body">
        <h1 className="tu-player__title">
          {ajoute.equipe
            ? t('fait', { prenom: ajoute.prenom, equipe: ajoute.equipe })
            : t('faitSansEquipe', { prenom: ajoute.prenom })}
        </h1>
        <p className="tu-player__lead">{t('faitAide')}</p>
        <div className="tu-player__actions">
          <Button variant="accent" size="lg" block onClick={recommencer}>
            {t('encore')}
          </Button>
          <Button variant="ghost" size="lg" block onClick={retour}>
            {t('retour')}
          </Button>
        </div>
      </div>
    );
  }

  if (etapeGroupe) {
    return (
      <div className="tu-player__body">
        <h1 className="tu-player__title">{t('groupeTitre', { prenom: prenom.trim() })}</h1>
        <p className="tu-player__lead">{tGroupe('aide')}</p>
        <ul className="tu-choices">
          {groupes.map((g) => (
            <li key={g.id}>
              <Button
                variant="outline"
                size="lg"
                block
                disabled={envoi}
                onClick={() => void envoyer(g.id)}
              >
                {g.nom}
              </Button>
            </li>
          ))}
          <li>
            <Button
              variant="ghost"
              size="lg"
              block
              disabled={envoi}
              onClick={() => void envoyer(null)}
            >
              {tGroupe('sansReponse')}
            </Button>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <form className="tu-player__body" onSubmit={validerPrenom} noValidate>
      <h1 className="tu-player__title">{t('titre')}</h1>
      <p className="tu-player__lead">{t('aide')}</p>
      <TextField
        label={t('champ')}
        value={prenom}
        onChange={(e) => setPrenom(e.target.value)}
        maxLength={40}
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="go"
        required
        {...(erreur ? { error: t(erreur) } : {})}
      />
      <div className="tu-player__actions">
        <Button type="submit" variant="accent" size="lg" block disabled={envoi}>
          {t('bouton')}
        </Button>
        <Button variant="ghost" size="lg" block onClick={retour}>
          {t('retour')}
        </Button>
      </div>
    </form>
  );
}
