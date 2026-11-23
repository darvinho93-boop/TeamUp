'use client';

import { useTranslations } from 'next-intl';
import { Button, cx, teamModifier } from '@teamup/ui/react';
import type { EtatJoueur } from '@/lib/partie';
import { INSTAGRAM } from '@/marque/instagram';
import type { Outil } from './EcranJoueur';
import type { Onglet } from './NavigationJoueur';

/**
 * « Ma partie » : une consigne et une action selon le moment, puis la carte, l'avis et Instagram.
 * Pendant un jeu, la vue du jeu tient lieu de consigne (`avecJeu`).
 */
export function MaPartie({
  etat,
  avecJeu,
  cartesActives,
  avisOuverts,
  allerA,
  ouvrirOutil,
}: {
  etat: EtatJoueur;
  avecJeu: boolean;
  cartesActives: boolean;
  avisOuverts: boolean;
  allerA: (onglet: Onglet) => void;
  ouvrirOutil: (outil: Outil) => void;
}) {
  const t = useTranslations();
  const { joueur, equipe, evenement, manche, prochaine, photos } = etat;
  const termine = evenement.statut === 'termine';
  const podiumMontre = (etat.classement?.length ?? 0) > 0;
  const photosAEnvoyer = joueur.capitaine && !!equipe && !!photos && !photos.closes && !termine;
  const capitaine = equipe?.membres?.find((m) => m.capitaine);
  // Le numéro reste lisible sous un nom choisi : la couleur ne suffit pas à tout le monde.
  const numeroDansLeNom = equipe ? equipe.nom.includes(String(equipe.numero)) : false;

  const moment = termine
    ? null
    : manche
      ? t('attente.enCours', { jeu: t(`jeux.${manche.jeu}`) })
      : prochaine
        ? t('attente.prochain', { jeu: t(`jeux.${prochaine.jeu}`) })
        : null;

  return (
    <div className={cx('tu-player__body', avecJeu && 'tu-player__body--suite')}>
      {!avecJeu && (
        <section className="tu-ticket">
          {termine ? (
            <>
              <p className="tu-ticket__surtitre">{t('parcours.partie.termine')}</p>
              <h1 className="tu-ticket__titre">
                {t('parcours.partie.merci', { prenom: joueur.prenom })}
              </h1>
            </>
          ) : equipe ? (
            <>
              <p className="tu-ticket__surtitre">
                <span className={cx('tu-ticket__pastille', teamModifier(equipe.numero))} />
                <span>
                  {numeroDansLeNom
                    ? t('equipe.surtitre')
                    : t('equipe.numero', { numero: equipe.numero })}
                </span>
                <span className="tu-ticket__points" data-testid="points">
                  {t('attente.points', { points: equipe.points })}
                </span>
              </p>
              <h1 className="tu-ticket__titre">{equipe.nom}</h1>
              {/* Une seule consigne, la plus utile à cet instant. */}
              <p>
                {t('attente.salut', { prenom: joueur.prenom })}.{' '}
                {joueur.capitaine ? (
                  <span data-testid="capitaine">{t('attente.capitaine')}</span>
                ) : manche ? (
                  t('attente.regarde')
                ) : capitaine ? (
                  t('parcours.partie.rejoindre', { capitaine: capitaine.prenom })
                ) : (
                  <span data-testid="attente-lancement">{t('attente.lancement')}</span>
                )}
              </p>
              {moment && <p>{moment}</p>}
            </>
          ) : (
            <>
              <p className="tu-ticket__surtitre">{t('parcours.partie.confirmee')}</p>
              <h1 className="tu-ticket__titre">{t('attente.salut', { prenom: joueur.prenom })}</h1>
              <p data-testid="sans-equipe">{t('parcours.partie.formation')}</p>
              {moment && <p>{moment}</p>}
            </>
          )}
        </section>
      )}

      {podiumMontre ? (
        <Button variant="accent" size="lg" block onClick={() => allerA('classement')}>
          {t('parcours.partie.voirPodium')}
        </Button>
      ) : photosAEnvoyer ? (
        <Button variant="accent" size="lg" block onClick={() => ouvrirOutil('photos')}>
          {t('photos.ouvrir', {
            envoyees: photos.themes.filter((th) => th.envoyee_le !== null).length,
            total: photos.themes.length,
          })}
        </Button>
      ) : equipe ? (
        <Button variant="accent" size="lg" block onClick={() => allerA('equipe')}>
          {t('parcours.partie.voirEquipe')}
        </Button>
      ) : (
        <Button variant="accent" size="lg" block onClick={() => allerA('jeux')}>
          {t('parcours.partie.voirRegles')}
        </Button>
      )}

      <section className="tu-liens" aria-label={t('parcours.partie.liens')}>
        {cartesActives && (
          <button type="button" className="tu-liens__ligne" onClick={() => ouvrirOutil('carte')}>
            {etat.carte ? t('maCarte.revoir') : t('maCarte.ouvrir')}
            <span aria-hidden="true">→</span>
          </button>
        )}
        {avisOuverts && (
          <button type="button" className="tu-liens__ligne" onClick={() => ouvrirOutil('avis')}>
            {etat.avis ? t('avis.revoir') : t('avis.ouvrir')}
            <span aria-hidden="true">→</span>
          </button>
        )}
        <a
          className="tu-liens__ligne"
          href={INSTAGRAM.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('parcours.partie.instagram')}
          <small>{INSTAGRAM.pseudo} ↗</small>
        </a>
      </section>
    </div>
  );
}
