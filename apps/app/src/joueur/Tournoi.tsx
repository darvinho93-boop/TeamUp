'use client';

import { useTranslations } from 'next-intl';
import { cx, teamModifier } from '@teamup/ui/react';
import { nomDuTour, vueDuTournoi, type TournoiJoueur } from '@/lib/tournoi';
import { useVibration, VIBRATION_JUSTE } from './useApresSuspense';

/**
 * Le tournoi du gobelet au téléphone (2026-11-21), en lecture seule : où aller, contre qui, et si
 * l'on est encore en lice. On joue en salle, et le perdant va le dire à la régie.
 */
export function Tournoi({ tournoi }: { tournoi: TournoiJoueur }) {
  const t = useTranslations('tournoi');
  const tTours = useTranslations('ecran.tournoi.tours');
  const vue = vueDuTournoi(tournoi);
  // Un petit signal quand son match est appelé : le téléphone est souvent dans la poche.
  useVibration(vue.cas === 'appele', VIBRATION_JUSTE);
  // Son tour : « Tour des 64 », « Quarts de finale »…
  const nomTour =
    tournoi.match && tournoi.tours ? tTours(nomDuTour(tournoi.match.tour, tournoi.tours)) : null;
  const surtitre = nomTour && (
    <p className="tu-tournoi__tour" data-testid="tournoi-nom-tour">
      {nomTour}
    </p>
  );

  if (vue.cas === 'appele') {
    return (
      <div className="tu-quiz tu-tournoi" data-testid="tournoi-joueur" data-cas="appele">
        {surtitre}
        <p className="tu-tournoi__poste" data-testid="tournoi-poste">
          {t('poste', { poste: vue.poste })}
        </p>
        {vue.adversaire && (
          <p
            className={cx('tu-tournoi__adversaire', teamModifier(vue.adversaire.equipe))}
            data-testid="tournoi-adversaire"
          >
            {t('contre', { prenom: vue.adversaire.prenom })}
          </p>
        )}
        <p className="tu-quiz__statut" role="status">
          {vue.etape === 'appel' ? t('rejoindre') : t('jeu')}
        </p>
        {vue.etape !== 'appel' && <p className="tu-player__lead">{t('perdu')}</p>}
      </div>
    );
  }

  if (vue.cas === 'attente') {
    return (
      <div className="tu-quiz tu-tournoi" data-testid="tournoi-joueur" data-cas="attente">
        {surtitre}
        {vue.passe && (
          <p className="tu-quiz__statut tu-quiz__statut--in" role="status">
            {vue.passe === 'exempte' ? t('exempte') : t('qualifie')}
          </p>
        )}
        <p className="tu-quiz__statut" role={vue.passe ? undefined : 'status'}>
          {t('attente')}
        </p>
        <p className="tu-player__lead" data-testid="tournoi-adversaire">
          {vue.adversaire
            ? t('adversaire', { prenom: vue.adversaire.prenom })
            : t('adversaireInconnu')}
        </p>
      </div>
    );
  }

  return (
    <div className="tu-quiz tu-tournoi" data-testid="tournoi-joueur" data-cas={vue.cas}>
      <p
        className={cx(
          'tu-quiz__statut',
          vue.cas === 'champion' && 'tu-quiz__statut--verdict tu-quiz__statut--in',
          vue.cas === 'elimine' && 'tu-quiz__statut--out',
        )}
        role="status"
      >
        {t(vue.cas)}
      </p>
    </div>
  );
}
