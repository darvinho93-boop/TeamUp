'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, cx, teamModifier } from '@teamup/ui/react';
import type { EtatJoueur } from '@/lib/partie';
import { Cadre } from './Cadre';
import { Quiz } from './Quiz';
import { useEtatJoueur } from './useEtatJoueur';

type Vue = 'equipe' | 'attente';

/** Le joueur a rejoint : « Mon équipe », puis l'attente, tenus à jour en continu. */
export function EcranJoueur({
  code,
  etatInitial,
  vueInitiale = 'attente',
}: {
  code: string;
  etatInitial: EtatJoueur;
  vueInitiale?: Vue;
}) {
  const t = useTranslations();
  const { etat, horsLigne, decalageMs, remplacer, relire } = useEtatJoueur(code, etatInitial);
  const [vue, setVue] = useState<Vue>(vueInitiale);

  const bandeau = horsLigne ? (
    <p className="tu-banner" role="status">
      {t('horsLigne.bandeau')}
    </p>
  ) : null;

  if (vue === 'equipe' && etat.equipe) {
    return (
      <>
        {bandeau}
        <main className={cx('tu-team-screen', teamModifier(etat.equipe.numero))}>
          <div className="tu-team-screen__main">
            <p className="tu-team-screen__eyebrow">{t('equipe.surtitre')}</p>
            <h1 className="tu-team-screen__name">{etat.equipe.nom}</h1>
            <p className="tu-team-screen__hint">{t('equipe.aide')}</p>
          </div>
          <Button size="lg" onClick={() => setVue('attente')}>
            {t('equipe.bouton')}
          </Button>
        </main>
      </>
    );
  }

  const { joueur, equipe, manche, prochaine, evenement, quiz } = etat;

  // Quiz en mode téléphone : le seul moment où le téléphone sert à jouer (spec v3).
  if (quiz) {
    return (
      <Cadre bandeau={bandeau}>
        <div className="tu-player__body">
          <Quiz
            code={code}
            quiz={quiz}
            decalageMs={decalageMs}
            remplacer={remplacer}
            relire={relire}
          />
        </div>
      </Cadre>
    );
  }

  return (
    <Cadre bandeau={bandeau}>
      <div className="tu-player__body">
        <h1 className="tu-player__title">{t('attente.salut', { prenom: joueur.prenom })}</h1>

        {equipe ? (
          <button
            type="button"
            className={cx('tu-wait-team', teamModifier(equipe.numero))}
            onClick={() => setVue('equipe')}
            aria-label={`${equipe.nom}, ${t('attente.points', { points: equipe.points })}. ${t('attente.voirEquipe')}`}
          >
            <span className="tu-wait-team__name">{equipe.nom}</span>
            <span className="tu-wait-team__points" data-testid="points">
              {t('attente.points', { points: equipe.points })}
            </span>
          </button>
        ) : (
          <p className="tu-player__lead">{t('equipe.sansEquipe')}</p>
        )}

        {evenement.statut === 'termine' ? (
          <p className="tu-wait-game">{t('attente.termine')}</p>
        ) : manche ? (
          <p className="tu-wait-game">{t('attente.enCours', { jeu: t(`jeux.${manche.jeu}`) })}</p>
        ) : prochaine ? (
          <p className="tu-wait-game">
            {t('attente.prochain', { jeu: t(`jeux.${prochaine.jeu}`) })}
          </p>
        ) : null}

        {evenement.statut !== 'termine' && (
          <div className="tu-player__actions">
            <p className="tu-wait-look">{t('attente.regarde')}</p>
          </div>
        )}
      </div>
    </Cadre>
  );
}
