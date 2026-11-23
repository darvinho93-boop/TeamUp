'use client';

import { useTranslations } from 'next-intl';
import { cx, teamModifier } from '@teamup/ui/react';
import type { EtatJoueur } from '@/lib/partie';

/**
 * L'onglet Classement : rien tant que le grand écran n'a pas fini de dévoiler le podium (la base
 * en décide), puis les mêmes rangs et les mêmes totaux que lui, l'équipe du joueur repérée.
 */
export function OngletClassement({ etat }: { etat: EtatJoueur }) {
  const t = useTranslations('parcours.classement');
  const lignes = etat.classement ?? [];

  if (lignes.length === 0) {
    return (
      <div className="tu-player__body" data-testid="classement-attente">
        <section className="tu-ticket">
          <h1 className="tu-ticket__titre">{t('titre')}</h1>
          <p>{t('attente')}</p>
        </section>
      </div>
    );
  }

  const numero = etat.equipe?.numero;
  const mienne = lignes.find((l) => l.numero === numero);
  return (
    <div className="tu-player__body" data-testid="classement">
      <section className="tu-ticket">
        <p className="tu-ticket__surtitre">{t('final')}</p>
        <h1 className="tu-ticket__titre">
          {mienne ? t('place', { rang: mienne.rang }) : t('titre')}
        </h1>
      </section>
      <ol className="tu-membres">
        {lignes.map((l) => (
          <li
            key={l.numero}
            className={cx('tu-membres__ligne', l.numero === numero && 'tu-membres__ligne--mienne')}
            aria-current={l.numero === numero ? 'true' : undefined}
            data-testid={`rang-${l.rang}`}
          >
            <span className={cx('tu-membres__initiale', teamModifier(l.numero))}>{l.rang}</span>
            <span className="tu-membres__nom">
              <strong>{l.nom}</strong>
              {(l.numero === numero || l.ex_aequo) && (
                <small>
                  {[l.numero === numero ? t('vous') : null, l.ex_aequo ? t('exAequo') : null]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              )}
            </span>
            <small>{t('points', { points: l.points })}</small>
          </li>
        ))}
      </ol>
    </div>
  );
}
