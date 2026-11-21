'use client';

import { useRef, type CSSProperties } from 'react';
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
import type { EtatSalle } from '@/lib/salle';
import { grilleDesPostes, nomDuTour, type MatchSalle } from '@/lib/tournoi';
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

/** Qui va à quel poste : jusqu'à 32 matchs dans le cadre, les noms barrés à mesure. */
function Postes({ matchs }: { matchs: MatchSalle[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const { colonnes, rangees } = grilleDesPostes(matchs.length);
  useTenirEnLargeur(ref, matchs.map((m) => m.id).join(), '.tu-stage-poste__prenom');
  return (
    <ol
      ref={ref}
      className="tu-stage-postes"
      // Peu de postes : les prénoms au milieu de leur carte, plutôt que collés à gauche.
      data-aere={rangees <= 2}
      style={{ '--tu-postes-colonnes': colonnes, '--tu-postes-rangees': rangees } as CSSProperties}
      data-testid="tournoi-postes"
    >
      {matchs.map((m) => (
        <li
          key={m.id}
          className="tu-stage-poste"
          data-juge={m.gagnant !== null}
          data-testid={`poste-${m.poste}`}
        >
          <span className="tu-stage-poste__numero">{m.poste}</span>
          <span className="tu-stage-poste__noms">
            <Nom joueur={m.a} etat={etatDuCote(m, 0)} />
            <Nom joueur={m.b} etat={etatDuCote(m, 1)} />
          </span>
        </li>
      ))}
    </ol>
  );
}

/** La fin du tableau : quarts, demi-finales, finale, chacun sa colonne. */
function TableauFinal({ matchs }: { matchs: MatchSalle[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const toursVus = [...new Set(matchs.map((m) => m.tour))].sort((a, b) => a - b);
  useTenirEnLargeur(
    ref,
    matchs.map((m) => `${m.a?.prenom}/${m.b?.prenom}/${m.gagnant}`).join(),
    '.tu-stage-poste__prenom',
  );
  return (
    <div
      ref={ref}
      className="tu-stage-tableau"
      style={{ '--tu-tableau-colonnes': toursVus.length } as CSSProperties}
      data-testid="tournoi-tableau"
    >
      {toursVus.map((tour) => (
        <ol key={tour} className="tu-stage-tableau__tour">
          {matchs
            .filter((m) => m.tour === tour)
            .sort((x, y) => x.rang - y.rang)
            .map((m) => (
              <li key={m.id} className="tu-stage-tableau__match">
                <Nom joueur={m.a} etat={etatDuCote(m, 0)} />
                <Nom joueur={m.b} etat={etatDuCote(m, 1)} />
              </li>
            ))}
        </ol>
      ))}
    </div>
  );
}

/**
 * Le tournoi du gobelet à l'écran commun (2026-11-21). Jusqu'aux quarts, la grille des postes de
 * la séquence ; demi-finales et finale en face-à-face, avec le verdict commun ; puis le podium des
 * joueurs. La séquence à annoncer reste sur la régie.
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

  const libelleTour = () => {
    if (!tour || !tours) return '';
    const nom = nomDuTour(tour, tours);
    return nom.cle === 'places' ? t('tours.places', { places: nom.places }) : t(`tours.${nom.cle}`);
  };
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

  if (!tournoi?.sequence || etape === 'tirage' || !etape) {
    const joueurs = tournoi?.joueurs ?? etat.equipes.reduce((n, e) => n + e.joueurs, 0);
    return (
      <div
        className="tu-stage__body tu-stage-centre tu-stage-reveal"
        data-scene="tournoi"
        data-etape="tirage"
      >
        <p className="tu-stage__l tu-stage__muted">{tournoi?.tours ? t('tire') : t('prepare')}</p>
        <h1 className="tu-stage__giant tu-stage-intro__jeu">{tJeux('cup')}</h1>
        <p className="tu-stage__l" data-testid="tournoi-compte">
          {t('joueurs', { joueurs })}
        </p>
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
          {libelleTour()}
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

  const faits = matchs.filter((m) => m.gagnant !== null).length;
  const tete = (
    <header className="tu-stage-tournoi__tete">
      <h1 className="tu-stage-tournoi__titre" data-testid="tournoi-tour">
        {libelleTour()}
      </h1>
      <p className="tu-stage-tournoi__info">
        {t('sequence', { numero: tournoi.sequence })}
        {tournoi.en_lice !== null && ` · ${t('enLice', { n: tournoi.en_lice })}`}
      </p>
    </header>
  );

  if (etape === 'jeu') {
    return (
      <div
        className="tu-stage__body tu-stage-centre tu-stage-reveal"
        data-scene="tournoi"
        data-etape="jeu"
      >
        {tete}
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

  const quartJuge =
    etape === 'resultats' && faits === matchs.length && tours >= 3 && tour === tours - 2;
  return (
    <div className="tu-stage__body tu-stage-tournoi" data-scene="tournoi" data-etape={etape}>
      {tete}
      {quartJuge ? (
        <TableauFinal matchs={tournoi.tableau} />
      ) : (
        <>
          <p className="tu-stage-tournoi__consigne">
            {etape === 'appel'
              ? t('rejoindre')
              : `${t('perdants')} ${t('resultats', { faits, total: matchs.length })}`}
          </p>
          <Postes matchs={matchs} />
        </>
      )}
    </div>
  );
}
