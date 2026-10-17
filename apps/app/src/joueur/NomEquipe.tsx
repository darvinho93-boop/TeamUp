'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import type { EtatJoueur } from '@/lib/partie';

type Erreur = 'vide' | 'fige' | 'capitaine' | 'serveur';

/**
 * Le capitaine renomme son équipe (24 caractères au plus : la carte de l'écran commun le loge
 * en entier). Le nouveau nom paraît aussitôt à l'écran ; la régie peut le corriger ou le figer.
 */
export function NomEquipe({
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
  const t = useTranslations('nomEquipe');
  const [nom, setNom] = useState(nomActuel);
  const [erreur, setErreur] = useState<Erreur>();
  const [envoi, setEnvoi] = useState(false);

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) return setErreur('vide');
    setEnvoi(true);
    setErreur(undefined);
    try {
      const reponse = await fetch(`/api/partie/${code}/equipe`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nom }),
      });
      if (reponse.ok) {
        remplacer((await reponse.json()) as EtatJoueur);
        return retour();
      }
      const { erreur: refus } = (await reponse.json().catch(() => ({}))) as { erreur?: string };
      setErreur(refus === 'fige' || refus === 'capitaine' ? refus : 'serveur');
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
