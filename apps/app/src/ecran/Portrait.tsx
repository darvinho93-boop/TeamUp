'use client';

import { useContext, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { cx, teamModifier } from '@teamup/ui/react';
import {
  pointsPortrait,
  repereCarte,
  resultatPortraitDe,
  TOURS_PORTRAIT,
  type EtapePortrait,
  type ResultatPortrait,
} from '@teamup/game';
import type { Langue } from '@/lib/partie';
import { chronoTourPortrait, nomDeCarte, statutsDesEquipes } from '@/lib/portrait';
import { passageCourant, texteParLangue, type EtatSalle, type MancheSalle } from '@/lib/salle';
import { Celebration, useArrivee } from './Celebration';
import { Chrono } from './Chrono';
import { Multilingue } from './Multilingue';
import { SonsContexte } from './sons/useSons';
import { useAjusterTexte } from './useAjusterTexte';

/**
 * Le Portrait mystère à l'écran commun (2026-11-18). En haut, la cible et les indices déjà
 * donnés, dans les langues de la soirée ; au milieu, la grille de 25 noms (repères A1 à E5), les
 * cibles déjà trouvées retournées ; en bas, l'état de chaque équipe (a voté, a trouvé, éliminée).
 * La fin d'un tour s'annonce en plein écran : qui a trouvé, qui est tombé sur la carte noire, sans
 * jamais dire laquelle c'était. La cible se retourne à la révélation ; la carte noire, à la fin.
 */
export function Portrait({
  etat,
  decalageMs,
  manche,
}: {
  etat: EtatSalle;
  decalageMs: number;
  manche: MancheSalle;
}) {
  const t = useTranslations('ecran.portrait');
  const passage = passageCourant(etat);
  const etape = etat.pilotage.etape as EtapePortrait | null;
  const tour = etat.pilotage.indices;
  const resultat = resultatPortraitDe(passage?.resultat);
  const langues = etat.evenement.langues;
  const premiere: Langue = langues[0] ?? 'fr';
  const corps = useRef<HTMLDivElement>(null);
  const grille = useRef<HTMLOListElement>(null);
  const cle = `${passage?.id ?? ''}:${etape ?? ''}:${tour}`;
  useAjusterTexte(corps, cle, '--tu-portrait-echelle');
  useAjusterTexte(grille, cle, '--tu-portrait-noms');
  const trouveeAuTour = useArrivee(etape === 'tour' && resultat.verdict.trouvees.length > 0);
  const fete = useArrivee(etape === 'revele' && Object.keys(resultat.trouvees).length > 0);
  useSonDuTour(etape === 'tour' ? `${passage?.id}:${tour}` : null, resultat);

  if (!passage || !etape || !manche.grille) return null;

  const equipe = (numero: number) => etat.equipes.find((e) => e.numero === numero);
  const numero = (
    <p className="tu-stage__m">{t('cible', { n: passage.ordre, total: manche.passages.length })}</p>
  );

  if (etape === 'tour') {
    const { trouvees, eliminees } = resultat.verdict;
    const noire = eliminees.length > 0;
    return (
      <div
        className={cx(
          'tu-stage__body tu-stage-centre tu-stage-reveal',
          // Plein écran, comme un verdict : la marque du coin passe en clair dessus. Personne n'a
          // trouvé : le beige, sans verdict.
          noire && cx('tu-stage-verdict tu-stage-portrait__noire', teamModifier(eliminees[0]!)),
          !noire && trouvees.length > 0 && 'tu-stage-verdict tu-stage-verdict--vert',
        )}
        data-scene="portrait"
        data-etape={etape}
        data-testid="portrait-verdict"
      >
        {numero}
        {noire && (
          <>
            <p className="tu-stage__giant">{t('noireTitre')}</p>
            {eliminees.map((n) => (
              <p key={n} className="tu-stage__xl" data-testid="portrait-eliminee">
                {t('eliminee', { equipe: equipe(n)?.nom ?? '' })}
              </p>
            ))}
          </>
        )}
        {trouvees.length > 0 && (
          <>
            {!noire && <p className="tu-stage__giant">{t('trouveTitre')}</p>}
            {trouvees.map((n) => (
              <p key={n} className="tu-stage__xl" data-testid="portrait-trouvee">
                {t('trouvePar', { equipe: equipe(n)?.nom ?? '', points: pointsPortrait(tour) })}
              </p>
            ))}
          </>
        )}
        {!noire && trouvees.length === 0 && (
          <>
            <p className="tu-stage__giant">{t('personne')}</p>
            {tour < TOURS_PORTRAIT && <p className="tu-stage__xl">{t('suivant')}</p>}
          </>
        )}
        {trouveeAuTour && <Celebration force={tour === 1 ? 3 : 1} />}
      </div>
    );
  }

  const cartes = manche.grille.cartes;
  const retournees = manche.grille.retournees;
  const positionCible = retournees[passage.id];
  const dejaTrouvees = new Set(
    Object.entries(retournees).flatMap(([id, position]) => (id === passage.id ? [] : [position])),
  );
  const noire = etape === 'noire' ? manche.grille.noire : null;
  const indices = Array.from({ length: Math.min(tour, TOURS_PORTRAIT) }, (_, i) =>
    langues.flatMap((langue) => {
      const liste = passage.secret?.[langue]?.['indices'];
      const texte: unknown = Array.isArray(liste) ? (liste as unknown[])[i] : undefined;
      return typeof texte === 'string' && texte ? [{ langue, texte }] : [];
    }),
  );
  const statuts = statutsDesEquipes(etat.equipes, manche, passage);
  const enJeu = etat.equipes.filter((e) => e.joueurs > 0);

  return (
    <div
      ref={corps}
      className="tu-stage__body tu-stage-portrait"
      data-scene="portrait"
      data-etape={etape}
    >
      <div className="tu-stage-portrait__tete">
        {numero}
        {etape === 'vote' && (
          <Chrono
            departMs={etat.pilotage.chrono_depart_ms}
            dureeS={etat.pilotage.chrono_duree_s ?? chronoTourPortrait(manche)}
            decalageMs={decalageMs}
            className="tu-stage-portrait__chrono"
          />
        )}
      </div>

      {etape === 'pret' && <p className="tu-stage__xl tu-stage-portrait__pret">{t('pret')}</p>}
      {indices.length > 0 && etape !== 'revele' && etape !== 'noire' && (
        <ol className="tu-stage-portrait__indices" data-testid="portrait-indices">
          {indices.map((textes, i) => (
            <li
              key={i}
              className={cx(
                'tu-stage-portrait__indice',
                i === indices.length - 1 && 'tu-stage-portrait__indice--dernier',
              )}
            >
              <span className="tu-stage-portrait__rang">{i + 1}</span>
              <Multilingue textes={textes} />
            </li>
          ))}
        </ol>
      )}
      {etape === 'revele' && (
        <div className="tu-stage-portrait__reponse" data-testid="portrait-reponse">
          <p className="tu-stage__l">{t('cetait')}</p>
          <Multilingue textes={texteParLangue(passage.public, 'nom', langues)} />
        </div>
      )}
      {etape === 'noire' && noire !== null && (
        <div className="tu-stage-portrait__reponse" data-testid="portrait-noire">
          <p className="tu-stage__l">{t('noireEtait')}</p>
          <p className="tu-stage__xl">{nomDeCarte(cartes[noire], premiere, langues)}</p>
        </div>
      )}

      <ol ref={grille} className="tu-stage-portrait__grille" data-testid="portrait-grille">
        {cartes.map((carte, position) => (
          <li
            key={position}
            className={cx(
              'tu-stage-portrait__carte',
              dejaTrouvees.has(position) && 'tu-stage-portrait__carte--trouvee',
              position === positionCible && 'tu-stage-portrait__carte--cible',
              position === noire && 'tu-stage-portrait__carte--noire',
            )}
          >
            <span className="tu-stage-portrait__repere">{repereCarte(position)}</span>
            <span className="tu-stage-portrait__nom" lang={premiere}>
              {nomDeCarte(carte, premiere, langues)}
            </span>
          </li>
        ))}
      </ol>

      <ul className="tu-stage-portrait__equipes" data-testid="portrait-equipes">
        {enJeu.map((e) => {
          const s = statuts[e.numero];
          return (
            <li
              key={e.id}
              className={cx(
                'tu-team tu-team--badge',
                teamModifier(e.numero),
                s?.statut === 'eliminee' && 'tu-stage-portrait__equipe--eliminee',
              )}
              data-statut={s?.statut}
            >
              {e.nom}
              {s?.statut === 'a-vote' && ` · ${t('aVote')}`}
              {s?.statut === 'trouvee' && ` · +${pointsPortrait(s.tour)}`}
            </li>
          );
        })}
      </ul>
      {fete && <Celebration force={2} />}
    </div>
  );
}

/**
 * La fin d'un tour sous les yeux de l'écran (pas au chargement) : l'échec si une équipe est tombée
 * sur la carte noire, la réussite si quelqu'un a trouvé, rien sinon.
 */
function useSonDuTour(cle: string | null, resultat: ResultatPortrait) {
  const jouer = useContext(SonsContexte);
  const derniere = useRef(cle);
  const { trouvees, eliminees } = resultat.verdict;
  useEffect(() => {
    const avant = derniere.current;
    derniere.current = cle;
    if (!jouer || cle === null || cle === avant) return;
    if (eliminees.length > 0) jouer('echec');
    else if (trouvees.length > 0) jouer('reussite');
  }, [jouer, cle, trouvees.length, eliminees.length]);
}
