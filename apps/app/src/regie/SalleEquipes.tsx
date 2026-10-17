'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { cx, teamModifier } from '@teamup/ui/react';
import {
  autoriserAjout,
  designerCapitaine,
  figerNom,
  renommerEquipe,
  retirerCapitaine,
  retirerJoueur,
} from '@/app/regie/[code]/salle/actions';
import { correspond, trierMembres } from '@/lib/membres';
import { BoutonConfirme } from './BoutonConfirme';
import { ChoixEquipe } from './ChoixEquipe';
import { useSignalSalle } from './SignalSalle';

export interface JoueurDeLaSalle {
  id: string;
  prenom: string;
  capitaine: boolean;
  equipe_id: string | null;
  enLigne: boolean;
  /** Ajouté à la main : ni session, ni capitaine, spectateur au quiz par téléphone. */
  sansTelephone: boolean;
  /** Autorisé à ajouter des invités sans téléphone depuis le sien. */
  peutAjouter: boolean;
  /** S'est proposé comme capitaine à l'arrivée. */
  volontaire: boolean;
}

export interface EquipeDeLaSalle {
  id: string;
  numero: number;
  nom: string;
  /** Répartition des groupes à l'arrivée (lot 11), déjà mise en forme ; vide sans groupes. */
  groupes: string;
  /** Nom bloqué par la régie : le capitaine ne peut plus le changer. */
  nomFige: boolean;
}

/**
 * Toute la salle d'un coup d'œil : une carte par équipe, ses membres en étiquettes (capitaine en
 * tête, puis ordre alphabétique). La recherche estompe ceux qui ne correspondent pas ; les
 * commandes d'un invité (changer d'équipe, capitaine, autorisation d'ajouter, retrait) ne
 * s'ouvrent qu'au clic sur son prénom. Chaque carte se renomme sur place, et son nom peut être
 * bloqué (le capitaine ne le change plus). Chaque commande prévient l'écran commun aussitôt.
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
  const [renomme, setRenomme] = useState<string | null>(null);
  const [nouveauNom, setNouveauNom] = useState('');
  const [enCours, demarrer] = useTransition();
  const signaler = useSignalSalle();
  /** Une commande de la fiche, puis le signal à l'écran. */
  const agir = (action: () => Promise<void>, fermer = false) =>
    demarrer(async () => {
      await action();
      signaler();
      if (fermer) setOuvert(null);
    });
  const cherche = recherche.trim() !== '';
  const trouves = cherche ? joueurs.filter((j) => correspond(j.prenom, recherche)).length : 0;
  const etatDe = (j: JoueurDeLaSalle) =>
    j.sansTelephone ? t('sansTelephone') : j.enLigne ? t('connecte') : t('horsLigne');

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
          {equipe?.nomFige && <span className="tu-regie__muted"> · {t('nomFige')}</span>}
        </h2>
        {equipe &&
          (renomme === equipe.id ? (
            <form
              className="tu-cluster"
              onSubmit={(e) => {
                e.preventDefault();
                agir(() => renommerEquipe(code, equipe.id, nouveauNom));
                setRenomme(null);
              }}
            >
              <input
                className="tu-field__control"
                aria-label={t('nomEquipe', { nom: equipe.nom })}
                value={nouveauNom}
                maxLength={60}
                required
                onChange={(e) => setNouveauNom(e.target.value)}
              />
              <button type="submit" className="tu-btn tu-btn--primary" disabled={enCours}>
                {t('enregistrer')}
              </button>
              <button
                type="button"
                className="tu-btn tu-btn--ghost"
                onClick={() => setRenomme(null)}
              >
                {t('annuler')}
              </button>
            </form>
          ) : (
            <div className="tu-cluster">
              <button
                type="button"
                className="tu-btn tu-btn--ghost"
                onClick={() => {
                  setNouveauNom(equipe.nom);
                  setRenomme(equipe.id);
                }}
              >
                {t('renommer')}
              </button>
              <button
                type="button"
                className="tu-btn tu-btn--ghost"
                disabled={enCours}
                onClick={() => agir(() => figerNom(code, equipe.id, !equipe.nomFige))}
              >
                {equipe.nomFige ? t('defiger') : t('figer')}
              </button>
            </div>
          ))}
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
                  className={cx(
                    'tu-regie-chip__etat',
                    j.enLigne && 'tu-regie-chip__etat--on',
                    j.sansTelephone && 'tu-regie-chip__etat--sans',
                  )}
                  aria-hidden="true"
                />
                {j.capitaine && <span aria-hidden="true">★</span>}
                {j.prenom}
                {j.peutAjouter && <span aria-hidden="true">+</span>}
                <span className="tu-visually-hidden">
                  {j.capitaine && ` · ${t('capitaine')}`}
                  {j.peutAjouter && ` · ${t('peutAjouter')}`} · {etatDe(j)}
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
              {choisi.volontaire && ` · ${t('volontaire')}`}
              <span
                className={cx(
                  'tu-regie-player__state',
                  choisi.enLigne && 'tu-regie-player__state--on',
                )}
              >
                {' · '}
                {etatDe(choisi)}
              </span>
            </p>
            <ChoixEquipe
              code={code}
              joueurId={choisi.id}
              equipeId={choisi.equipe_id}
              equipes={equipes.map((e) => ({ id: e.id, nom: e.nom }))}
              libelle={t('deplacer', { prenom: choisi.prenom })}
            />
            {choisi.capitaine ? (
              <button
                type="button"
                className="tu-btn tu-btn--ghost"
                disabled={enCours}
                onClick={() => agir(() => retirerCapitaine(code, choisi.id))}
              >
                {t('retirerCapitaine')}
              </button>
            ) : (
              choisi.equipe_id &&
              !choisi.sansTelephone && (
                <button
                  type="button"
                  className="tu-btn tu-btn--ghost"
                  disabled={enCours}
                  onClick={() => agir(() => designerCapitaine(code, choisi.id))}
                >
                  {t('nommerCapitaine')}
                </button>
              )
            )}
            {!choisi.sansTelephone && (
              <button
                type="button"
                className="tu-btn tu-btn--ghost"
                disabled={enCours}
                onClick={() => agir(() => autoriserAjout(code, choisi.id, !choisi.peutAjouter))}
              >
                {choisi.peutAjouter ? t('retirerAjout') : t('autoriserAjout')}
              </button>
            )}
            <BoutonConfirme
              variant="ghost"
              disabled={enCours}
              confirmation={t('retirerConfirmer', { prenom: choisi.prenom })}
              onConfirm={() => agir(() => retirerJoueur(code, choisi.id), true)}
            >
              {t('retirer')}
            </BoutonConfirme>
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
