'use client';

import { useTranslations } from 'next-intl';
import { Button, cx, teamModifier } from '@teamup/ui/react';
import {
  actionsPortrait,
  CARTES_PORTRAIT,
  pointsPortrait,
  repereCarte,
  resultatPortraitDe,
  type EtapePortrait,
} from '@teamup/game';
import type { Commande } from '@/lib/pilotage';
import {
  chronoTourPortrait,
  elimineesDeLaManche,
  nomDeCarte,
  positionsDuPassage,
  statutsDesEquipes,
  votesDuTour,
} from '@/lib/portrait';
import { passageCourant, type EtatSalle, type MancheSalle } from '@/lib/salle';
import { Chrono } from '@/ecran/Chrono';

/**
 * Portrait mystère (2026-11-18), à la régie : la cible et ses trois indices, la carte noire (pour
 * l'animateur seul), les touches du déroulé, et le vote de chaque équipe. En mode à voix, la
 * régie saisit le vote que chaque équipe lui annonce ; au téléphone, elle peut le faire en secours.
 */
export function PanneauPortrait({
  etat,
  manche,
  decalageMs,
  agir,
  voter,
}: {
  etat: EtatSalle;
  manche: MancheSalle;
  decalageMs: number;
  agir: (commande: Commande) => void;
  /** Le vote d'une équipe pour le tour en cours ; `null` le retire. */
  voter: (passageId: string, equipeId: string, carte: number | null) => void;
}) {
  const t = useTranslations('regie.pilotage');
  const tp = useTranslations('regie.pilotage.portrait');
  const passage = passageCourant(etat);
  if (!passage) return null;

  const langue = etat.evenement.langues[0] ?? 'fr';
  const langues = etat.evenement.langues;
  const cartes = manche.grille?.cartes ?? [];
  const nom = (position: number) => nomDeCarte(cartes[position], langue, langues);
  const carte = (position: number) => `${repereCarte(position)} · ${nom(position)}`;
  const positions = positionsDuPassage(manche, passage);
  if (!positions) {
    return (
      <p className="tu-regie__alert" role="alert">
        {tp('grilleIncomplete')}
      </p>
    );
  }

  const etape = etat.pilotage.etape as EtapePortrait;
  const tour = etat.pilotage.indices;
  const resultat = resultatPortraitDe(passage.resultat);
  const equipes = etat.equipes.filter((e) => e.joueurs > 0);
  const reste = manche.passages.some((x) => x.id !== passage.id && x.statut !== 'termine');
  const permises = actionsPortrait({
    etape,
    tour,
    resultat,
    equipes: equipes.map((e) => e.numero),
    elimineesAvant: elimineesDeLaManche(manche, passage.id),
    cible: positions.cible,
    noire: positions.noire,
    votes: votesDuTour(passage),
    derniere: !reste,
    chronoTourS: chronoTourPortrait(manche),
  });
  const statuts = statutsDesEquipes(etat.equipes, manche, passage);
  const votes = votesDuTour(passage);
  const liste = (passage.secret?.[langue]?.['indices'] ?? []) as unknown[];
  const retournees = new Set(Object.values(manche.grille?.retournees ?? {}));
  const choix = Array.from({ length: CARTES_PORTRAIT }, (_, i) => i).filter(
    (i) => !retournees.has(i),
  );
  const ouvert = etape === 'vote';

  return (
    <section className="tu-regie__section" aria-label={tp('titre')} data-testid="panneau-portrait">
      <p className="tu-regie__muted">
        {tp('cible', { n: passage.ordre, total: manche.passages.length })}
        {tour > 0 && ` · ${tp('tour', { n: tour })}`}
      </p>

      <div className="tu-regie-secret">
        <p className="tu-regie__muted">{tp('reponse')}</p>
        <p className="tu-regie-item__title" data-testid="portrait-cible">
          {carte(positions.cible)}
        </p>
        <ol className="tu-regie-indices">
          {liste.map((indice, i) => (
            <li
              key={i}
              className={cx(
                'tu-regie-indices__indice',
                i < tour && 'tu-regie-indices__indice--donne',
              )}
            >
              {typeof indice === 'string' ? indice : ''}
            </li>
          ))}
        </ol>
        <p className="tu-regie__muted" data-testid="portrait-noire">
          {tp('noire', { carte: carte(positions.noire) })}
        </p>
      </div>

      {ouvert && (
        <Chrono
          departMs={etat.pilotage.chrono_depart_ms}
          dureeS={etat.pilotage.chrono_duree_s ?? chronoTourPortrait(manche)}
          decalageMs={decalageMs}
          className="tu-regie-timer"
        />
      )}

      <ul className="tu-regie-list" data-testid="portrait-equipes">
        {equipes.map((e) => {
          const statut = statuts[e.numero];
          const vote = votes[e.numero];
          return (
            <li key={e.id} className="tu-regie-item tu-regie-item--portrait">
              <span className={cx('tu-team tu-team--badge', teamModifier(e.numero))}>{e.nom}</span>
              <span className="tu-regie-item__main">
                {statut?.statut === 'eliminee' ? (
                  <span className="tu-regie-player__state tu-regie-player__state--alerte">
                    {tp('eliminee')}
                  </span>
                ) : statut?.statut === 'trouvee' ? (
                  <span className="tu-regie-player__state tu-regie-player__state--on">
                    {tp('trouvee', { tour: statut.tour, points: pointsPortrait(statut.tour) })}
                  </span>
                ) : ouvert ? (
                  <select
                    aria-label={tp('voteDe', { equipe: e.nom })}
                    value={vote ?? ''}
                    onChange={(ev) =>
                      voter(
                        passage.id,
                        e.id,
                        ev.target.value === '' ? null : Number(ev.target.value),
                      )
                    }
                    data-testid={`vote-${e.numero}`}
                  >
                    <option value="">{tp('pasDeVote')}</option>
                    {choix.map((i) => (
                      <option key={i} value={i}>
                        {carte(i)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="tu-regie__muted">
                    {vote === undefined ? tp('pasDeVote') : carte(vote)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="tu-regie-keys">
        {permises.includes('indice') && (
          <Button
            variant="accent"
            size="lg"
            className="tu-regie-keys__wide"
            onClick={() => agir({ type: 'portrait', action: { type: 'indice' } })}
          >
            {tp('indice', { n: tour + 1 })}
          </Button>
        )}
        {permises.includes('cloturer') && (
          <Button
            variant="accent"
            size="lg"
            className="tu-regie-keys__wide"
            onClick={() => agir({ type: 'portrait', action: { type: 'cloturer' } })}
          >
            {tp('cloturer')}
          </Button>
        )}
        {permises.includes('reveler') && (
          <Button
            variant={permises.includes('indice') ? 'ghost' : 'accent'}
            size="lg"
            className="tu-regie-keys__wide"
            onClick={() => agir({ type: 'portrait', action: { type: 'reveler' } })}
          >
            {tp('reveler')}
          </Button>
        )}
        {etape === 'revele' && reste && (
          <Button
            variant="accent"
            size="lg"
            className="tu-regie-keys__wide"
            onClick={() => agir({ type: 'suivant' })}
          >
            {tp('suivante')}
          </Button>
        )}
        {permises.includes('noire') && (
          <Button
            variant="accent"
            size="lg"
            className="tu-regie-keys__wide"
            onClick={() => agir({ type: 'portrait', action: { type: 'noire' } })}
          >
            {tp('montrerNoire')}
          </Button>
        )}
        {etape === 'noire' && (
          <Button
            variant="accent"
            size="lg"
            className="tu-regie-keys__wide"
            onClick={() => agir({ type: 'terminer' })}
          >
            {t('terminer')}
          </Button>
        )}
      </div>
    </section>
  );
}
