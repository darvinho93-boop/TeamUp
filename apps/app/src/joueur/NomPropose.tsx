'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import type { EtatJoueur } from '@/lib/partie';

type Erreur = 'formees' | 'serveur';

/**
 * Le volontaire change le nom d'équipe qu'il propose, tant que la régie n'a pas formé les équipes
 * (lot 14). S'il est tiré capitaine, son équipe portera ce nom. Vide : il n'en propose plus.
 */
export function NomPropose({
  code,
  nomActuel,
  remplacer,
  retour,
}: {
  code: string;
  nomActuel: string;
  remplacer: (etat: EtatJoueur) => void;
  retour: () => void;
}) {
  const t = useTranslations('proposition');
  const [nom, setNom] = useState(nomActuel);
  const [erreur, setErreur] = useState<Erreur>();
  const [envoi, setEnvoi] = useState(false);

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(undefined);
    try {
      const reponse = await fetch(`/api/partie/${code}/nom-propose`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nom }),
      });
      if (reponse.ok) {
        remplacer((await reponse.json()) as EtatJoueur);
        return retour();
      }
      const { erreur: refus } = (await reponse.json().catch(() => ({}))) as { erreur?: string };
      setErreur(refus === 'formees' ? 'formees' : 'serveur');
    } catch {
      setErreur('serveur');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form className="tu-player__body" onSubmit={(e) => void enregistrer(e)} noValidate>
      <h1 className="tu-player__title">{t('titre')}</h1>
      <p className="tu-player__lead">{t('aide')}</p>
      <TextField
        label={t('champ')}
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        maxLength={24}
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="done"
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
