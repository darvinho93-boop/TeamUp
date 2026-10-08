'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cx, teamModifier } from '@teamup/ui/react';
import { designerCapitaine } from '@/app/regie/[code]/salle/actions';
import { correspond, trierMembres } from '@/lib/membres';
import { ChoixEquipe } from './ChoixEquipe';

export interface JoueurDeLaSalle {
  id: string;
  prenom: string;
  capitaine: boolean;
  equipe_id: string | null;
  enLigne: boolean;
}

export interface EquipeDeLaSalle {
  id: string;
  numero: number;
  nom: string;
  /** Répartition des groupes à l'arrivée (lot 11), déjà mise en forme ; vide sans groupes. */
  groupes: string;
}

/**
 * Toute la salle d'un coup d'œil : une carte par équipe, ses membres en étiquettes (capitaine en
 * tête, puis ordre alphabétique). La recherche estompe ceux qui ne correspondent pas ; les
 * commandes d'un invité (changer d'équipe, capitaine) ne s'ouvrent qu'au clic sur son prénom.
 */
export function SalleEquipes({
  code,
  equipes,
  joueurs,
}: {
  code: string;
  equipes: EquipeDeLaSalle[];
  joueurs: JoueurDeLaSalle[];
}) {
  const t = useTranslations('regie.salle');
  const [recherche, setRecherche] = useState('');
  const [ouvert, setOuvert] = useState<string | null>(null);
  const cherche = recherche.trim() !== '';
  const trouves = cherche ? joueurs.filter((j) => correspond(j.prenom, recherche)).length : 0;

  const carte = (equipe: EquipeDeLaSalle | null) => {
    const membres = trierMembres(joueurs.filter((j) => j.equipe_id === (equipe?.id ?? null)));
    if (!equipe && membres.length === 0) return null;
    const choisi = membres.find((j) => j.id === ouvert);
    return (
      <section
        key={equipe?.id ?? 'sans'}
        className={cx('tu-regie-team', equipe && teamModifier(equipe.numero))}
      >
        <h2 className="tu-regie__section-title">
          {equipe ? `${equipe.nom} · ${membres.length}` : t('sansEquipe')}
        </h2>
        {equipe?.groupes && (
          <p className="tu-regie__muted" data-testid="groupes">
            {t('groupes', { detail: equipe.groupes })}
          </p>
        )}
        <ul className="tu-regie-chips">
          {membres.map((j) => (
            <li key={j.id}>
              <button
                type="button"
                className={cx(
                  'tu-regie-chip',
                  j.id === ouvert && 'tu-regie-chip--ouvert',
                  cherche && !correspond(j.prenom, recherche) && 'tu-regie-chip--estompe',
                )}
                aria-expanded={j.id === ouvert}
                onClick={() => setOuvert(j.id === ouvert ? null : j.id)}
              >
                <span
                  className={cx('tu-regie-chip__etat', j.enLigne && 'tu-regie-chip__etat--on')}
                  aria-hidden="true"
                />
                {j.capitaine && <span aria-hidden="true">★</span>}
                {j.prenom}
                <span className="tu-visually-hidden">
                  {j.capitaine && ` · ${t('capitaine')}`} ·{' '}
                  {j.enLigne ? t('connecte') : t('horsLigne')}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {choisi && (
          <div className="tu-regie-fiche" data-testid="fiche-joueur">
            <p className="tu-regie-fiche__nom">
              {choisi.prenom}
              {choisi.capitaine && ` · ${t('capitaine')}`}
              <span
                className={cx(
                  'tu-regie-player__state',
                  choisi.enLigne && 'tu-regie-player__state--on',
                )}
              >
                {' · '}
                {choisi.enLigne ? t('connecte') : t('horsLigne')}
              </span>
            </p>
            <ChoixEquipe
              code={code}
              joueurId={choisi.id}
              equipeId={choisi.equipe_id}
              equipes={equipes.map((e) => ({ id: e.id, nom: e.nom }))}
              libelle={t('deplacer', { prenom: choisi.prenom })}
            />
            {choisi.equipe_id && !choisi.capitaine && (
              <form action={designerCapitaine.bind(null, code, choisi.id)}>
                <button type="submit" className="tu-btn tu-btn--ghost">
                  {t('nommerCapitaine')}
                </button>
              </form>
            )}
            <button type="button" className="tu-btn tu-btn--ghost" onClick={() => setOuvert(null)}>
              {t('fermer')}
            </button>
          </div>
        )}
      </section>
    );
  };

  return (
    <>
      <div className="tu-regie-recherche">
        <label className="tu-field">
          <span className="tu-field__label">{t('rechercher')}</span>
          <input
            type="search"
            className="tu-field__control"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            autoComplete="off"
          />
        </label>
        <p className="tu-regie__muted" role="status" data-testid="resultats">
          {cherche ? t('resultats', { n: trouves }) : ''}
        </p>
      </div>
      <div className="tu-regie-teams">
        {equipes.map(carte)}
        {carte(null)}
      </div>
    </>
  );
}
