'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, cx, teamModifier } from '@teamup/ui/react';
import type { EtatJoueur, GroupePublic } from '@/lib/partie';
import { AjoutInvite } from './AjoutInvite';
import { Cadre } from './Cadre';
import { NomEquipe } from './NomEquipe';
import { Photos } from './Photos';
import { Quiz } from './Quiz';
import { useEtatJoueur } from './useEtatJoueur';
import { useFilePhotos } from './useFilePhotos';

type Vue = 'equipe' | 'attente' | 'photos' | 'ajout' | 'nom';

/** Le joueur a rejoint : « Mon équipe », puis l'attente, tenus à jour en continu. */
export function EcranJoueur({
  code,
  etatInitial,
  vueInitiale = 'attente',
  groupes = [],
}: {
  code: string;
  etatInitial: EtatJoueur;
  vueInitiale?: Vue;
  /** Les groupes de la soirée : un invité ajouté depuis ce téléphone peut en choisir un. */
  groupes?: GroupePublic[];
}) {
  const t = useTranslations();
  const { etat, horsLigne, decalageMs, remplacer, relire } = useEtatJoueur(code, etatInitial);
  const [vue, setVue] = useState<Vue>(vueInitiale);
  // La file vit ici, pas dans la vue Photos : elle se vide même quand le capitaine en sort.
  const file = useFilePhotos(code, remplacer);

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

  const { joueur, equipe, manche, prochaine, evenement, quiz, photos } = etat;

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

  // L'autorisation peut être retirée pendant la saisie : la vue se ferme d'elle-même.
  if (vue === 'ajout' && joueur.peut_ajouter && evenement.statut !== 'termine') {
    return (
      <Cadre bandeau={bandeau}>
        <AjoutInvite code={code} groupes={groupes} retour={() => setVue('attente')} />
      </Cadre>
    );
  }

  // Le capitaine renomme son équipe ; s'il perd le rôle ou que la régie fige le nom pendant la
  // saisie, la vue se ferme d'elle-même.
  const peutRenommer =
    joueur.capitaine && !!equipe && !equipe.nom_fige && evenement.statut !== 'termine';
  if (vue === 'nom' && peutRenommer) {
    return (
      <Cadre bandeau={bandeau}>
        <NomEquipe
          code={code}
          nomActuel={equipe.nom}
          remplacer={remplacer}
          retour={() => setVue('attente')}
        />
      </Cadre>
    );
  }

  if (vue === 'photos' && photos) {
    return (
      <Cadre bandeau={bandeau}>
        <div className="tu-player__body">
          <Photos
            photos={photos}
            capitaine={joueur.capitaine}
            sorts={file.sorts}
            apercus={file.apercus}
            ajouter={file.ajouter}
            retour={() => setVue('attente')}
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
            {joueur.capitaine && equipe && (
              <p className="tu-player__lead" data-testid="capitaine">
                {t('attente.capitaine')}
              </p>
            )}
            {photos && equipe && (
              <Button
                variant={joueur.capitaine && !photos.closes ? 'accent' : 'outline'}
                size="lg"
                block
                onClick={() => setVue('photos')}
              >
                {t('photos.ouvrir', {
                  envoyees: photos.themes.filter((th) => th.envoyee_le !== null).length,
                  total: photos.themes.length,
                })}
              </Button>
            )}
            {peutRenommer && (
              <Button variant="outline" size="lg" block onClick={() => setVue('nom')}>
                {t('nomEquipe.ouvrir')}
              </Button>
            )}
            {joueur.peut_ajouter && (
              <Button variant="outline" size="lg" block onClick={() => setVue('ajout')}>
                {t('ajout.ouvrir')}
              </Button>
            )}
          </div>
        )}
      </div>
    </Cadre>
  );
}
