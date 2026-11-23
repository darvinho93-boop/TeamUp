'use client';

import { useTranslations } from 'next-intl';
import { Button, cx, teamModifier } from '@teamup/ui/react';
import { trierMembres } from '@/lib/membres';
import type { EtatJoueur } from '@/lib/partie';
import type { Outil } from './EcranJoueur';

/** L'onglet Équipe : le numéro, le nom, la couleur, les membres et les outils permis par la régie. */
export function OngletEquipe({
  etat,
  peutRenommer,
  ouvrirOutil,
}: {
  etat: EtatJoueur;
  peutRenommer: boolean;
  ouvrirOutil: (outil: Outil) => void;
}) {
  const t = useTranslations();
  const { joueur, equipe, photos, evenement } = etat;
  const ouverte = evenement.statut !== 'termine';

  const outils = (
    <div className="tu-player__actions">
      {photos && equipe && (
        <Button
          variant={joueur.capitaine && !photos.closes ? 'accent' : 'outline'}
          size="lg"
          block
          onClick={() => ouvrirOutil('photos')}
        >
          {t('photos.ouvrir', {
            envoyees: photos.themes.filter((th) => th.envoyee_le !== null).length,
            total: photos.themes.length,
          })}
        </Button>
      )}
      {peutRenommer && (
        <Button variant="outline" size="lg" block onClick={() => ouvrirOutil('nom')}>
          {t('nomEquipe.ouvrir')}
        </Button>
      )}
      {joueur.peut_ajouter && ouverte && (
        <Button variant="outline" size="lg" block onClick={() => ouvrirOutil('ajout')}>
          {t('ajout.ouvrir')}
        </Button>
      )}
      {joueur.volontaire && !equipe && (
        <Button variant="outline" size="lg" block onClick={() => ouvrirOutil('propose')}>
          {t('proposition.ouvrir')}
        </Button>
      )}
    </div>
  );

  if (!equipe) {
    return (
      <div className="tu-player__body" data-testid="onglet-equipe-vide">
        <section className="tu-ticket">
          <h1 className="tu-ticket__titre">{t('parcours.equipe.formation')}</h1>
          <p>{t('parcours.equipe.attente')}</p>
        </section>
        {joueur.volontaire && (
          <p className="tu-player__lead" data-testid="nom-propose">
            {joueur.nom_propose
              ? t('proposition.actuel', { nom: joueur.nom_propose })
              : t('proposition.aucun')}
          </p>
        )}
        {outils}
      </div>
    );
  }

  const membres = trierMembres(equipe.membres ?? []);
  const numeroDansLeNom = equipe.nom.includes(String(equipe.numero));
  return (
    <div className="tu-player__body" data-testid="onglet-equipe">
      <section className={cx('tu-equipe', teamModifier(equipe.numero))}>
        <p className="tu-equipe__surtitre">
          {numeroDansLeNom ? t('equipe.surtitre') : t('equipe.numero', { numero: equipe.numero })}
        </p>
        <h1 className="tu-equipe__nom">{equipe.nom}</h1>
      </section>
      {membres.length > 0 && (
        <section aria-label={t('equipe.membres')}>
          <ul className="tu-membres" data-testid="coequipiers">
            {membres.map((membre) => (
              <li key={membre.prenom} className="tu-membres__ligne">
                <span
                  className={cx('tu-membres__initiale', teamModifier(equipe.numero))}
                  aria-hidden="true"
                >
                  {membre.prenom.slice(0, 1).toUpperCase()}
                </span>
                <strong>{membre.prenom}</strong>
                <small>
                  {[
                    membre.prenom === joueur.prenom ? t('parcours.equipe.vous') : null,
                    membre.capitaine ? t('equipe.capitaine') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="tu-player__lead">{t('equipe.aide', { numero: equipe.numero })}</p>
      {outils}
    </div>
  );
}
