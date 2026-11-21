'use client';

import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cx, teamModifier } from '@teamup/ui/react';
import {
  chronoDuelS,
  classementTournoi,
  POINTS_DEMI_TOURNOI,
  POINTS_FINALISTE_TOURNOI,
  POINTS_VAINQUEUR_TOURNOI,
  surScene,
  type Duelliste,
  type EtapeTournoi,
} from '@teamup/game';
import { MATCHS_MAX_AVEC_NOMS } from '@/lib/arbre';
import type { EtatSalle } from '@/lib/salle';
import { affichesDuTour, grilleDesPostes, nomDuTour, type MatchSalle } from '@/lib/tournoi';
import { ArbreTournoi } from './ArbreTournoi';
import { Celebration, useArrivee } from './Celebration';
import { Chrono } from './Chrono';
import { Recompense } from './Recompense';
import { useTenirEnLargeur } from './useTenirEnLargeur';
import { Verdict } from './Verdict';

type EtatJoueur = 'attente' | 'gagne' | 'perdu';

const etatDuCote = (m: MatchSalle, cote: 0 | 1): EtatJoueur =>
  m.gagnant === null ? 'attente' : m.gagnant === cote ? 'gagne' : 'perdu';

function Nom({ joueur, etat }: { joueur: Duelliste | null; etat: EtatJoueur }) {
  return (
    <span
      className={cx('tu-stage-poste__prenom', joueur && teamModifier(joueur.equipe))}
      data-etat={etat}
    >
      {joueur?.prenom ?? '?'}
    </span>
  );
}

/**
 * Un grand tour (32es, 64es, 128es) en entier, trop dense pour l'arbre en toutes lettres : chaque
 * match est une branche, deux prénoms reliés à un crochet. Ceux que la régie a lancés sont
 * encadrés et portent leur poste, ceux déjà joués leur résultat ; les exemptés sont dessous.
 */
function TableauDuTour({ matchs, sequence }: { matchs: MatchSalle[]; sequence: number | null }) {
  const t = useTranslations('ecran.tournoi');
  const ref = useRef<HTMLDivElement>(null);
  const { matchs: affiches, exemptes } = affichesDuTour(matchs);
  const { colonnes, rangees } = grilleDesPostes(affiches.length);
  useTenirEnLargeur(
    ref,
    affiches.map((m) => `${m.id}:${m.a?.prenom}:${m.b?.prenom}`).join(),
    '.tu-stage-poste__prenom',
  );
  return (
    <div ref={ref} className="tu-stage-tour">
      <ol
        className="tu-stage-postes"
        data-aere={rangees <= 2}
        style={
          { '--tu-postes-colonnes': colonnes, '--tu-postes-rangees': rangees } as CSSProperties
        }
        data-testid="tournoi-postes"
      >
        {affiches.map((m) => {
          const appele = sequence !== null && m.sequence === sequence;
          return (
            <li
              key={m.id}
              className="tu-stage-poste"
              data-appele={appele}
              data-juge={m.gagnant !== null}
              data-testid={appele ? `poste-${m.poste}` : undefined}
            >
              <span className="tu-stage-poste__noms">
                <Nom joueur={m.a} etat={etatDuCote(m, 0)} />
                <Nom joueur={m.b} etat={etatDuCote(m, 1)} />
              </span>
              <span className="tu-stage-poste__numero">{appele ? m.poste : ''}</span>
            </li>
          );
        })}
      </ol>
      {exemptes.length > 0 && (
        <p
          className="tu-stage-exemptes"
          data-taille={exemptes.length <= 40 ? 'l' : exemptes.length <= 64 ? 'm' : 's'}
          data-testid="tournoi-exemptes"
        >
          <strong>{t('exemptes', { n: exemptes.length })}</strong>{' '}
          {exemptes.map((j) => j.prenom).join(' · ')}
        </p>
      )}
    </div>
  );
}

/**
 * Le tournoi du gobelet à l'écran commun (2026-11-21). L'arbre du tableau au tirage et entre deux
 * séquences ; les matchs appelés dessus dès que leur tour tient en toutes lettres, sinon leurs
 * branches en grand ; demi-finales et finale en face-à-face, avec le verdict commun ; puis le
 * podium des joueurs. La séquence à annoncer reste sur la régie.
 */
export function Tournoi({ etat, decalageMs }: { etat: EtatSalle; decalageMs: number }) {
  const t = useTranslations('ecran.tournoi');
  const tEcran = useTranslations('ecran');
  const tJeux = useTranslations('jeux');
  const tournoi = etat.tournoi ?? null;
  const etape = etat.pilotage.etape as EtapeTournoi | null;
  const matchs = tournoi?.matchs ?? [];
  const tours = tournoi?.tours ?? 0;
  const tour = tournoi?.tour ?? 0;
  const duel = tour > 0 && surScene(tour, tours) && matchs.length === 1 ? matchs[0]! : null;
  const gagnantDuel = duel && duel.gagnant !== null ? (duel.gagnant === 0 ? duel.a : duel.b) : null;
  const verdictVu = useArrivee(etape === 'resultats' && gagnantDuel !== null);
  const podiumVu = useArrivee(etape === 'vainqueur');
  const marches = useRef<HTMLOListElement>(null);
  const classement = etape === 'vainqueur' ? classementTournoi(tournoi?.tableau ?? []) : null;
  useTenirEnLargeur(
    marches,
    classement ? `${classement.vainqueur.prenom}/${classement.finaliste.prenom}` : '',
    '.tu-team--badge',
  );

  const libelleTour = (n: number) => (n && tours ? t(`tours.${nomDuTour(n, tours)}`) : '');
  const equipe = (numero: number) => etat.equipes.find((e) => e.numero === numero) ?? null;

  if (etape === 'vainqueur' && classement) {
    const badge = (j: Duelliste) => (
      <span
        key={j.joueur_id || j.prenom}
        className={cx('tu-team tu-team--badge tu-stage-badge--grand', teamModifier(j.equipe))}
      >
        {j.prenom}
      </span>
    );
    const marche = (joueurs: Duelliste[], place: 1 | 2 | 3, points: number) =>
      joueurs.length > 0 && (
        <li
          className={cx('tu-stage-podium__marche', `tu-stage-podium__marche--${place}`)}
          style={{ '--tu-podium-rang': 3 - place } as CSSProperties}
          data-testid={`tournoi-podium-${place}`}
        >
          <Recompense place={place} className="tu-stage-podium__recompense" />
          {joueurs.map(badge)}
          <span className="tu-stage-podium__points">+{points}</span>
          <span className="tu-stage-podium__socle">{place}</span>
        </li>
      );
    return (
      <div className="tu-stage__body" data-scene="tournoi" data-etape="vainqueur">
        <h1 className="tu-visually-hidden">{t('vainqueur')}</h1>
        <ol ref={marches} className="tu-stage-podium">
          {marche([classement.finaliste], 2, POINTS_FINALISTE_TOURNOI)}
          {marche([classement.vainqueur], 1, POINTS_VAINQUEUR_TOURNOI)}
          {marche(classement.demis, 3, POINTS_DEMI_TOURNOI)}
        </ol>
        {podiumVu && <Celebration force={3} className="tu-celebration--podium" />}
      </div>
    );
  }

  const joueurs = tournoi?.joueurs ?? etat.equipes.reduce((n, e) => n + e.joueurs, 0);

  // Avant le tirage : le nom du jeu et la salle qui attend son tableau.
  if (!tournoi?.tours || !etape) {
    return (
      <div
        className="tu-stage__body tu-stage-centre tu-stage-reveal"
        data-scene="tournoi"
        data-etape="tirage"
      >
        <p className="tu-stage__l tu-stage__muted">{t('prepare')}</p>
        <h1 className="tu-stage__giant tu-stage-intro__jeu">{tJeux('cup')}</h1>
        <p className="tu-stage__l" data-testid="tournoi-compte">
          {t('joueurs', { joueurs })}
        </p>
      </div>
    );
  }

  const tete = (titre: string, info: ReactNode) => (
    <header className="tu-stage-tournoi__tete">
      <h1 className="tu-stage-tournoi__titre" data-testid="tournoi-tour">
        {titre}
      </h1>
      <p className="tu-stage-tournoi__info">{info}</p>
    </header>
  );
  const duTour = (n: number) => tournoi.tableau.filter((m) => m.tour === n);
  // Un tour de plus de 16 matchs ne tient pas en toutes lettres dans l'arbre : il a son tableau.
  const grandTour = (n: number) => 2 ** (tours - n) > MATCHS_MAX_AVEC_NOMS;
  const reels = affichesDuTour(duTour(tour)).matchs;
  const enCours = [
    t('sequence', { numero: tournoi.sequence ?? 1 }),
    t('matchsJoues', {
      joues: reels.filter((m) => m.gagnant !== null).length,
      total: reels.length,
    }),
    ...(tournoi.en_lice !== null ? [t('enLice', { n: tournoi.en_lice })] : []),
  ].join(' · ');
  const arbre = <ArbreTournoi matchs={tournoi.tableau} sequence={tournoi.sequence} />;

  // Le tableau tiré : tous les matchs du premier tour, ou l'arbre s'il les montre déjà.
  if (etape === 'tirage' || !tournoi.sequence) {
    return (
      <div className="tu-stage__body tu-stage-tournoi" data-scene="tournoi" data-etape="tirage">
        {tete(
          t('tire'),
          <span data-testid="tournoi-compte">
            {libelleTour(1)} · {t('joueurs', { joueurs })}
          </span>,
        )}
        {grandTour(1) ? <TableauDuTour matchs={duTour(1)} sequence={null} /> : arbre}
      </div>
    );
  }

  if (duel) {
    if (etape === 'resultats' && gagnantDuel) {
      const perdant = duel.gagnant === 0 ? duel.b : duel.a;
      const finale = tour === tours;
      const sonEquipe = equipe(gagnantDuel.equipe);
      return (
        <Verdict
          scene="tournoi"
          etape="resultats"
          ton={sonEquipe ? 'equipe' : 'vert'}
          equipe={sonEquipe}
          titre={
            finale
              ? t('gagneTournoi', { prenom: gagnantDuel.prenom })
              : t('qualifie', { prenom: gagnantDuel.prenom })
          }
          detail={
            <p className="tu-verdict__detail">
              {tEcran('duelContre', { prenom: perdant?.prenom ?? '' })}
            </p>
          }
          points={null}
          fete={finale ? 3 : 1}
          enDirect={verdictVu}
        />
      );
    }
    // L'appel d'une demi-finale ou de la finale : le match, à sa place dans l'arbre.
    if (etape === 'appel') {
      return (
        <div className="tu-stage__body tu-stage-tournoi" data-scene="tournoi" data-etape="appel">
          {tete(
            libelleTour(tour),
            `${duel.a?.prenom ?? '?'} ${tEcran('contre')} ${duel.b?.prenom ?? '?'}`,
          )}
          {arbre}
        </div>
      );
    }
    const face = (j: Duelliste | null) => {
      const sonEquipe = j ? equipe(j.equipe) : null;
      return (
        <div className="tu-stage-duel__joueur">
          <p className="tu-stage-duel__prenom">{j?.prenom ?? '?'}</p>
          {sonEquipe && (
            <span
              className={cx(
                'tu-team tu-team--badge tu-stage-badge--grand',
                teamModifier(sonEquipe.numero),
              )}
            >
              {sonEquipe.nom}
            </span>
          )}
        </div>
      );
    };
    return (
      <div
        className="tu-stage__body tu-stage-centre tu-stage-reveal"
        data-scene="tournoi"
        data-etape={etape}
      >
        <p className="tu-stage__l tu-stage__muted" data-testid="tournoi-tour">
          {libelleTour(tour)}
        </p>
        <div className="tu-stage-duel" data-testid="duel">
          {face(duel.a)}
          <p className="tu-stage__l">{tEcran('contre')}</p>
          {face(duel.b)}
        </div>
        {etape === 'jeu' && (
          <Chrono
            departMs={etat.pilotage.chrono_depart_ms}
            dureeS={chronoDuelS('cup')}
            decalageMs={decalageMs}
            className="tu-stage__giant tu-stage-chrono"
          />
        )}
      </div>
    );
  }

  if (etape === 'jeu') {
    return (
      <div
        className="tu-stage__body tu-stage-centre tu-stage-reveal"
        data-scene="tournoi"
        data-etape="jeu"
      >
        {tete(libelleTour(tour), enCours)}
        <Chrono
          departMs={etat.pilotage.chrono_depart_ms}
          dureeS={chronoDuelS('cup')}
          decalageMs={decalageMs}
          className="tu-stage__giant tu-stage-chrono"
        />
        <p className="tu-stage-tournoi__consigne">{t('ecoutez')}</p>
      </div>
    );
  }

  const faits = matchs.filter((m) => m.gagnant !== null).length;
  const tousJuges = faits === matchs.length;
  const tourFini = duTour(tour).every((m) => m.gagnant !== null);
  // Un grand tour reste affiché en entier jusqu'à son dernier match ; l'arbre revient ensuite.
  const enTableau = grandTour(tour) && !tourFini;
  return (
    <div className="tu-stage__body tu-stage-tournoi" data-scene="tournoi" data-etape={etape}>
      {tete(libelleTour(tour), enCours)}
      {!(etape === 'resultats' && tousJuges) && (
        <p className="tu-stage-tournoi__consigne">
          {etape === 'appel'
            ? enTableau
              ? t('rejoindreN', { n: matchs.length })
              : t('rejoindre')
            : `${t('perdants')} ${t('resultats', { faits, total: matchs.length })}`}
        </p>
      )}
      {enTableau ? <TableauDuTour matchs={duTour(tour)} sequence={tournoi.sequence} /> : arbre}
    </div>
  );
}
