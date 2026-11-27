'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, cx, teamModifier } from '@teamup/ui/react';
import {
  aleaDepuis,
  bornerGobelets,
  chronoDuelS,
  dimensionsTableau,
  GOBELETS_MAX,
  GOBELETS_MIN,
  PART_TRANSITIONS,
  pointsTournoi,
  prochaineSequence,
  SEQUENCE_TOURNOI_S,
  sequenceGobelet,
  sequencesDuTournoi,
  tirerTableau,
  type Duelliste,
  type EtapeTournoi,
} from '@teamup/game';
import { Chrono } from '@/ecran/Chrono';
import type { Commande } from '@/lib/pilotage';
import { passageCourant, type EtatSalle, type MancheSalle } from '@/lib/salle';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';
import {
  COLONNES_MATCH,
  matchDepuisLigne,
  matchsDuPrenom,
  nomDuTour,
  type LigneMatch,
  type MatchSalle,
} from '@/lib/tournoi';
import type { Json } from '@/types/base';

/** Un hasard sûr, celui du navigateur, comme le tirage de l'ordre (lot 13). */
function aleaCrypto(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
}

async function lireMatchs(mancheId: string): Promise<MatchSalle[] | null> {
  const { data, error } = await supabaseNavigateur()
    .from('matchs_tournoi')
    .select(COLONNES_MATCH)
    .eq('manche_id', mancheId);
  if (error) return null;
  return (data as LigneMatch[]).map(matchDepuisLigne);
}

/**
 * Le tournoi du gobelet (2026-11-21) : tirer le tableau, appeler une séquence, la lancer, puis
 * noter les perdants qui viennent à la régie. Un résultat est une touche, sans confirmation, et
 * reste corrigeable jusqu'à la séquence suivante.
 */
export function PanneauTournoi({
  etat,
  manche,
  decalageMs,
  agir,
  apresTirage,
  apresResultat,
}: {
  etat: EtatSalle;
  manche: MancheSalle;
  decalageMs: number;
  agir: (commande: Commande) => void;
  /** Le tableau a changé : l'écran et les téléphones relisent. */
  apresTirage: () => Promise<void>;
  /** Un résultat : l'écran et la régie relisent, pas les cent téléphones. */
  apresResultat: () => Promise<void>;
}) {
  const t = useTranslations('regie.pilotage.tournoi');
  const tp = useTranslations('regie.pilotage');
  const td = useTranslations('regie.pilotage.duel');
  const [gobelets, setGobelets] = useState(bornerGobelets(manche.options['gobelets']));
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<'personne' | 'impossible' | null>(null);
  const [recherche, setRecherche] = useState('');
  // Le résultat paraît sous le doigt, sans attendre l'aller-retour vers la base.
  const [saisis, setSaisis] = useState<Record<string, 0 | 1 | null>>({});
  const champ = useRef<HTMLInputElement>(null);

  const passage = passageCourant(etat);
  const tournoi = etat.tournoi ?? null;
  const etape = etat.pilotage.etape as EtapeTournoi;
  if (!passage) return null;

  const tire = (tournoi?.tours ?? null) !== null;
  const participants = tournoi?.joueurs ?? etat.equipes.reduce((n, e) => n + e.joueurs, 0);
  const assezDeJoueurs = participants >= 2;
  const matchs = tournoi?.matchs ?? [];
  const gagnantDe = (m: MatchSalle) => (m.id in saisis ? saisis[m.id]! : m.gagnant);
  const faits = matchs.filter((m) => gagnantDe(m) !== null).length;
  const juge = matchs.length > 0 && faits === matchs.length;
  const numero = tournoi?.sequence ?? 0;
  const sequence = numero > 0 ? sequenceGobelet(aleaDepuis(`${passage.id}:${numero}`)) : [];

  const libelleTour = () => {
    if (!tournoi?.tour || !tournoi.tours) return '';
    return t(`tours.${nomDuTour(tournoi.tour, tournoi.tours)}`);
  };

  const executer = async (action: () => Promise<boolean>) => {
    setOccupe(true);
    setErreur(null);
    try {
      if (!(await action())) setErreur('impossible');
    } catch {
      setErreur('impossible');
    } finally {
      setOccupe(false);
    }
  };

  /** Tous les joueurs qui ont une équipe, lus à l'instant : les retardataires comptent. */
  const tirer = () =>
    executer(async () => {
      const supabase = supabaseNavigateur();
      const { data, error } = await supabase
        .from('joueurs')
        .select('id, prenom, equipe_id')
        .eq('evenement_id', etat.evenement.id);
      if (error) return false;
      const numeroDe = new Map(etat.equipes.map((e) => [e.id, e.numero]));
      const joueurs: Duelliste[] = data.flatMap((j) => {
        const equipe = numeroDe.get(j.equipe_id ?? '');
        return equipe ? [{ joueur_id: j.id, prenom: j.prenom, equipe }] : [];
      });
      const tableau = tirerTableau(joueurs, aleaCrypto);
      if (!tableau) {
        setErreur('personne');
        return true;
      }
      const premier = tableau
        .filter((m) => m.tour === 1)
        .map((m) => ({ rang: m.rang, a: m.a?.joueur_id, b: m.b?.joueur_id ?? null }));
      const { error: refus } = await supabase.rpc('poser_tableau', {
        p_manche: manche.id,
        p_premier_tour: premier as unknown as Json,
        p_gobelets: gobelets,
      });
      if (refus) return false;
      await apresTirage();
      return true;
    });

  /** La séquence se calcule sur le tableau relu : la régie peut avoir une lecture de retard. */
  const appeler = () =>
    executer(async () => {
      const lus = await lireMatchs(manche.id);
      const suite = lus && prochaineSequence(lus, gobelets);
      if (!suite) return false;
      setSaisis({});
      setRecherche('');
      agir({
        type: 'tournoi',
        action: 'appeler',
        sequence: {
          manche_id: manche.id,
          numero: suite.numero,
          matchs: suite.matchs.map((m) => m.id),
          gobelets,
        },
      });
      return true;
    });

  const conclure = () =>
    executer(async () => {
      const lus = await lireMatchs(manche.id);
      const points = lus && pointsTournoi(lus);
      if (!points) return false;
      agir({ type: 'tournoi', action: 'conclure', points });
      return true;
    });

  const noter = async (m: MatchSalle, gagnant: 0 | 1 | null) => {
    setSaisis((s) => ({ ...s, [m.id]: gagnant }));
    setErreur(null);
    // Le suivant est déjà là : le champ se vide et reprend la main.
    if (recherche) {
      setRecherche('');
      champ.current?.focus();
    }
    const { error } = await supabaseNavigateur().rpc('resultat_match', {
      p_match: m.id,
      // Le type généré ne connaît pas null : la fonction l'accepte (annuler le résultat).
      p_gagnant: gagnant as number,
    });
    if (error) setErreur('impossible');
    await apresResultat();
    setSaisis((s) => {
      const reste = { ...s };
      delete reste[m.id];
      return reste;
    });
  };

  const estimation = assezDeJoueurs ? sequencesDuTournoi(participants, gobelets) : null;
  // Ce que la touche va lancer, d'après le tableau : « Jouer les X prochains matchs ».
  const suite = tournoi ? prochaineSequence(tournoi.tableau, gobelets) : null;
  const aLancer = suite?.matchs.length ?? gobelets;
  const restants = suite
    ? tournoi!.tableau.filter((m) => m.tour === suite.tour && m.gagnant === null).length
    : 0;
  const nomSuite =
    suite && tournoi?.tours ? t(`tours.${nomDuTour(suite.tour, tournoi.tours)}`) : '';
  // Demi-finales et finale se jouent une à une, sur scène : rien à choisir.
  const reglageGobelets = !suite?.surScene && (
    <div className="tu-regie-tournoi__choix">
      <label className="tu-field tu-regie-tournoi__gobelets">
        <span className="tu-field__label">{t('matchsAJouer')}</span>
        <input
          className="tu-field__control"
          type="number"
          min={GOBELETS_MIN}
          max={GOBELETS_MAX}
          value={gobelets}
          onChange={(e) => setGobelets(bornerGobelets(Number(e.target.value)))}
          data-testid="tournoi-gobelets"
        />
      </label>
      {suite && (
        <>
          <Button variant="ghost" onClick={() => setGobelets(bornerGobelets(restants))}>
            {t('tous', { n: restants })}
          </Button>
          <p className="tu-regie__muted" data-testid="tournoi-restants">
            {t('restants', { tour: nomSuite, n: restants })}
          </p>
        </>
      )}
    </div>
  );
  const resultatsOuverts = etape === 'jeu' || etape === 'resultats';
  const visibles = matchsDuPrenom(matchs, recherche);

  return (
    <section className="tu-regie__section" aria-label={t('titre')} data-testid="panneau-tournoi">
      {erreur && (
        <p className="tu-regie__alert" role="alert">
          {t(erreur)}
        </p>
      )}

      {etape === 'tirage' && (
        <>
          <p className="tu-regie__muted" data-testid="tournoi-joueurs">
            {tire
              ? t('tire', {
                  joueurs: participants,
                  exemptes: dimensionsTableau(participants).exemptes,
                })
              : t('joueurs', { n: participants })}
          </p>
          {reglageGobelets}
          {estimation !== null && (
            <p className="tu-regie__muted" data-testid="tournoi-estimation">
              {t('estimation', {
                sequences: estimation,
                minutes: Math.round(
                  (estimation * SEQUENCE_TOURNOI_S * (1 + PART_TRANSITIONS)) / 60,
                ),
              })}
            </p>
          )}
          <div className="tu-regie-keys">
            <Button
              variant={tire ? 'ghost' : 'accent'}
              className="tu-regie-keys__wide"
              disabled={occupe || !assezDeJoueurs}
              onClick={() => void tirer()}
            >
              {tire ? t('retirer') : t('tirer')}
            </Button>
            {tire && (
              <Button
                variant="accent"
                className="tu-regie-keys__wide"
                disabled={occupe}
                onClick={() => void appeler()}
              >
                {t('jouerPremiers', { n: aLancer })}
              </Button>
            )}
          </div>
        </>
      )}

      {etape !== 'tirage' && etape !== 'vainqueur' && (
        <p className="tu-regie-item__title" data-testid="tournoi-sequence">
          {libelleTour()} · {t('sequence', { numero })}
        </p>
      )}

      {(etape === 'appel' || etape === 'jeu') && (
        <div className="tu-regie-secret" data-testid="sequence">
          <p className="tu-regie__muted">{td('sequence')}</p>
          <p className="tu-regie-item__title">
            {sequence.map((mot) => td(`mots.${mot}`)).join(' · ')}
          </p>
        </div>
      )}

      {etape === 'jeu' && (
        <Chrono
          departMs={etat.pilotage.chrono_depart_ms}
          dureeS={chronoDuelS('cup')}
          decalageMs={decalageMs}
          className="tu-regie-timer"
        />
      )}

      <div className="tu-regie-keys">
        {etape === 'appel' && (
          <Button
            variant="accent"
            className="tu-regie-keys__wide"
            onClick={() => agir({ type: 'tournoi', action: 'lancer' })}
          >
            {t('lancer')}
          </Button>
        )}
        {etape === 'jeu' && (
          <Button
            className="tu-regie-keys__wide"
            onClick={() => agir({ type: 'tournoi', action: 'fin' })}
          >
            {t('finSequence')}
          </Button>
        )}
        {etape === 'resultats' && juge && tournoi?.reste && (
          <Button
            variant="accent"
            className="tu-regie-keys__wide"
            disabled={occupe || Object.keys(saisis).length > 0}
            onClick={() => void appeler()}
          >
            {t('jouerProchains', { n: aLancer })}
          </Button>
        )}
        {etape === 'resultats' && juge && !tournoi?.reste && (
          <Button
            variant="accent"
            className="tu-regie-keys__wide"
            disabled={occupe || Object.keys(saisis).length > 0}
            onClick={() => void conclure()}
          >
            {t('voirVainqueur')}
          </Button>
        )}
        {etape === 'vainqueur' && (
          <Button
            variant="accent"
            className="tu-regie-keys__wide"
            onClick={() => agir({ type: 'terminer' })}
          >
            {tp('terminer')}
          </Button>
        )}
      </div>

      {etape === 'resultats' && juge && tournoi?.reste && reglageGobelets}

      {matchs.length > 0 && etape !== 'tirage' && etape !== 'vainqueur' && (
        <>
          {resultatsOuverts && (
            <>
              <p className="tu-regie__muted" role="status" data-testid="tournoi-compteur">
                {t('consigne')} {t('compteur', { faits, total: matchs.length })}
              </p>
              {matchs.length > 1 && (
                <label className="tu-field">
                  <span className="tu-field__label">{t('recherche')}</span>
                  <input
                    ref={champ}
                    className="tu-field__control"
                    type="search"
                    autoComplete="off"
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    data-testid="tournoi-recherche"
                  />
                </label>
              )}
            </>
          )}
          {visibles.length === 0 && <p className="tu-regie__muted">{t('aucun')}</p>}
          <ul className="tu-regie-tournoi" data-testid="tournoi-matchs">
            {visibles.map((m) => {
              const gagnant = gagnantDe(m);
              return (
                <li key={m.id} className="tu-regie-tournoi__match" data-juge={gagnant !== null}>
                  {/* La question posée au-dessus des prénoms : on touche celui qui a PERDU, au
                      contraire du duel (audit du 2026-11-26) ; noté, qui passe au tour suivant. */}
                  <p className="tu-regie-tournoi__question" data-testid="tournoi-question">
                    {gagnant === null
                      ? t('quiAPerdu', { poste: m.poste ?? 0 })
                      : t('auTourSuivant', {
                          poste: m.poste ?? 0,
                          prenom: (gagnant === 0 ? m.a : m.b)?.prenom ?? '—',
                        })}
                  </p>
                  {([0, 1] as const).map((cote) => {
                    const joueur = cote === 0 ? m.a : m.b;
                    if (!joueur) return null;
                    const perdu = gagnant !== null && gagnant !== cote;
                    return (
                      <button
                        key={cote}
                        type="button"
                        className={cx('tu-regie-tournoi__joueur', teamModifier(joueur.equipe))}
                        aria-pressed={perdu}
                        aria-label={t('aPerdu', { prenom: joueur.prenom })}
                        data-etat={gagnant === null ? 'attente' : perdu ? 'perdu' : 'gagne'}
                        disabled={!resultatsOuverts || perdu}
                        // Toucher celui qui a perdu : son adversaire passe au tour suivant.
                        onClick={() => void noter(m, cote === 0 ? 1 : 0)}
                      >
                        {joueur.prenom}
                      </button>
                    );
                  })}
                  {gagnant !== null && resultatsOuverts && (
                    <button
                      type="button"
                      className="tu-regie-tournoi__annuler"
                      aria-label={t('annulerResultat', { poste: m.poste ?? 0 })}
                      onClick={() => void noter(m, null)}
                    >
                      {t('annuler')}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
