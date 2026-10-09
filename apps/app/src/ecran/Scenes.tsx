'use client';

import { useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { cx, teamModifier, Wordmark } from '@teamup/ui/react';
import {
  CHRONO_MIME_S,
  CHRONO_POINTS_COMMUNS_S,
  CHRONO_QUESTION_S,
  CHRONO_SURENCHERE_DEFAUT_S,
  chronoDuelS,
  etatPaliers,
  PALIERS,
  POINTS_PAR_SURVIVANT,
  tempsDeJeu,
} from '@teamup/game';
import {
  classement,
  equipeDe,
  mancheCourante,
  passageCourant,
  texteParLangue,
  type EquipeSalle,
  type EtatSalle,
  type MancheSalle,
  indicesMsDe,
} from '@/lib/salle';
import { duellistesDe, ETAPE_TIRAGE_ORDRE, scriptEnCours } from '@/lib/pilotage';
import { Pictogramme } from '@/marque/Pictogramme';
import { grilleDesEquipes, membresTries, pageA, pagesDe } from '@/lib/membres';
import { Chrono, useMaintenant } from './Chrono';
import { SonsContexte } from './sons/useSons';
import { Explication } from './Explication';
import { OrdreTire, ordreDesEquipes, TirageOrdre } from './TirageOrdre';
import { Multilingue } from './Multilingue';
import { usePhotosSignees } from './usePhotosSignees';

interface Props {
  etat: EtatSalle;
  decalageMs: number;
  /** QR code de l'adresse de la partie, en SVG (rendu côté serveur). */
  qrSvg: string;
  adresse: string;
}

/** La scène que la régie a choisie : c'est tout ce que l'écran commun montre. */
export function Scene(props: Props) {
  const { etat } = props;
  switch (etat.pilotage.scene) {
    case 'accueil':
      return <Accueil {...props} />;
    case 'equipes':
      return <Equipes etat={etat} decalageMs={props.decalageMs} />;
    case 'programme':
      return <Programme etat={etat} />;
    case 'intro':
      return <Intro etat={etat} decalageMs={props.decalageMs} />;
    case 'jeu':
      return <Jeu {...props} />;
    case 'scores':
      return <Scores etat={etat} />;
    case 'podium':
      return <Podium etat={etat} />;
  }
}

function Pastille({ equipe, grande }: { equipe: EquipeSalle; grande?: boolean }) {
  return (
    <span
      className={cx(
        'tu-team tu-team--badge',
        teamModifier(equipe.numero),
        grande && 'tu-stage-badge--grand',
      )}
    >
      {equipe.nom}
    </span>
  );
}

function Accueil({ etat, qrSvg, adresse }: Props) {
  const t = useTranslations('ecran');
  return (
    <div className="tu-stage__body tu-stage-accueil" data-scene="accueil">
      <div className="tu-stage-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      <div className="tu-stage-accueil__texte">
        <span className="tu-marque">
          <Pictogramme taille="coin" />
          <Wordmark className="tu-stage-accueil__logo" />
        </span>
        <p className="tu-stage__l">{t('rejoindre')}</p>
        <p className="tu-stage-code" data-testid="code">
          {etat.evenement.code}
        </p>
        <p className="tu-stage__m tu-stage__muted">{t('adresse', { adresse })}</p>
        <p className="tu-stage__m" data-testid="joueurs">
          {t('joueurs', { n: etat.joueurs })}
        </p>
      </div>
    </div>
  );
}

/**
 * Toutes les équipes et tous leurs membres, capitaine en tête. Une équipe trop nombreuse pour
 * sa carte passe par pages, qui tournent seules et toutes ensemble : la page se déduit de
 * l'heure de la base, donc deux écrans montrent la même.
 */
function Equipes({ etat, decalageMs }: { etat: EtatSalle; decalageMs: number }) {
  const t = useTranslations('ecran');
  const { colonnes, parPage } = grilleDesEquipes(etat.equipes.length);
  const equipes = etat.equipes.map((e) => ({
    ...e,
    pages: pagesDe(membresTries(e.prenoms, e.capitaine), parPage),
  }));
  const maintenant = useMaintenant(equipes.some((e) => e.pages.length > 1)) + decalageMs;
  // Au premier rendu, la première page : le serveur et le navigateur n'ont pas la même heure.
  const monte = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return (
    <div className="tu-stage__body" data-scene="equipes">
      <h1 className="tu-stage__xl">{t('equipes')}</h1>
      <ul className={cx('tu-stage-teams', `tu-stage-teams--${colonnes}`)}>
        {equipes.map((e) => {
          const page = monte ? pageA(maintenant, e.pages.length) : 0;
          return (
            <li key={e.id} className={cx('tu-stage-team', teamModifier(e.numero))}>
              <span className="tu-stage-team__nom">{e.nom}</span>
              <span className="tu-stage-team__nombre">{t('joueurs', { n: e.joueurs })}</span>
              <ul
                key={page}
                className={cx(
                  'tu-stage-membres tu-stage-reveal',
                  parPage > 10 && 'tu-stage-membres--haute',
                )}
                data-testid={`membres-${e.numero}`}
                data-page={page}
              >
                {(e.pages[page] ?? []).map((m, i) => (
                  <li key={i} className="tu-stage-membre">
                    {m.capitaine && (
                      <>
                        <span className="tu-stage-membre__capitaine" aria-hidden="true">
                          ★
                        </span>
                        <span className="tu-visually-hidden">{t('capitaine')} : </span>
                      </>
                    )}
                    {m.prenom}
                  </li>
                ))}
              </ul>
              {e.pages.length > 1 && (
                <span className="tu-stage-points" aria-hidden="true">
                  {e.pages.map((_, i) => (
                    <span
                      key={i}
                      className={cx('tu-stage-point', i === page && 'tu-stage-point--actif')}
                    />
                  ))}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Programme({ etat }: { etat: EtatSalle }) {
  const t = useTranslations();
  return (
    <div className="tu-stage__body" data-scene="programme">
      <h1 className="tu-stage__xl">{t('ecran.programme')}</h1>
      <ol className="tu-stage-list">
        {etat.programme
          .filter((m) => m.statut !== 'annulee')
          .map((m) => (
            <li
              key={m.id}
              className={cx(
                'tu-stage-list__item',
                (m.statut === 'en_cours' || m.id === etat.pilotage.manche_id) &&
                  'tu-stage-list__item--courant',
                m.statut === 'terminee' && 'tu-stage-list__item--fait',
              )}
            >
              {t(`jeux.${m.jeu}`)}
            </li>
          ))}
      </ol>
    </div>
  );
}

function Intro({ etat, decalageMs }: { etat: EtatSalle; decalageMs: number }) {
  const t = useTranslations();
  const manche = mancheCourante(etat);
  if (!manche) return null;
  const script = scriptEnCours(manche.jeu, 'intro', etat.pilotage.etape);
  if (script) {
    return (
      <Explication
        jeu={manche.jeu}
        script={script}
        langues={etat.evenement.langues}
        departMs={etat.pilotage.chrono_depart_ms}
        decalageMs={decalageMs}
      />
    );
  }
  if (etat.pilotage.etape === ETAPE_TIRAGE_ORDRE) {
    return (
      <TirageOrdre
        jeu={manche.jeu}
        mancheId={manche.id}
        ordre={ordreDesEquipes(etat, manche)}
        departMs={etat.pilotage.chrono_depart_ms}
        decalageMs={decalageMs}
      />
    );
  }
  return (
    <div className="tu-stage__body tu-stage-centre tu-stage-reveal" data-scene="intro">
      <h1 className="tu-stage__giant">{t(`jeux.${manche.jeu}`)}</h1>
      <p className="tu-stage__l">{t(`ecran.regles.${manche.jeu}`)}</p>
      {manche.options['ordre_tire'] === true && <OrdreTire ordre={ordreDesEquipes(etat, manche)} />}
    </div>
  );
}

function Jeu(props: Props) {
  const manche = mancheCourante(props.etat);
  if (manche?.jeu === 'list2') return <PointsCommuns {...props} />;
  if (manche?.jeu === 'enchere2') return <Surenchere {...props} manche={manche} />;
  if (manche?.jeu === 'qcm2') return <Quiz {...props} manche={manche} />;
  if (manche?.jeu === 'mime2') return <Mime {...props} />;
  if (manche?.jeu === 'photo2') return <Photo {...props} manche={manche} />;
  if (manche?.jeu === 'grab' || manche?.jeu === 'cup') return <Duel {...props} jeu={manche.jeu} />;
  return null;
}

/** Le chrono vient de s'arrêter à un palier : un carillon appelle l'indice. */
function SonDeLArret({ palier }: { palier: number | null }) {
  const jouer = useContext(SonsContexte);
  const dernier = useRef(palier);
  useEffect(() => {
    const avant = dernier.current;
    dernier.current = palier;
    if (jouer && palier !== null && palier !== avant) jouer('indice');
  }, [jouer, palier]);
  return null;
}

function PointsCommuns({ etat, decalageMs }: Props) {
  const t = useTranslations('ecran');
  const passage = passageCourant(etat);
  const equipe = equipeDe(etat, passage?.equipe_id ?? null);
  const { etape, chrono_depart_ms: depart } = etat.pilotage;
  const langues = etat.evenement.langues;
  const maintenant = useMaintenant(etape === 'lance');
  if (!passage || !equipe) return null;

  const ecoule =
    typeof passage.resultat['ecoule_ms'] === 'number'
      ? passage.resultat['ecoule_ms']
      : depart === null
        ? 0
        : Math.max(0, maintenant + decalageMs - depart);
  // Le temps de jeu : figé à la fin de chaque palier, jusqu'à l'indice et un peu après.
  const fini = typeof passage.resultat['ecoule_ms'] === 'number';
  const jeu = fini ? { jeuMs: ecoule, arret: null } : tempsDeJeu(ecoule, indicesMsDe(passage));
  const palier = etatPaliers(jeu.jeuMs).palier;
  const palierArrete = etape === 'lance' ? (jeu.arret?.palier ?? null) : null;
  const indices = langues.flatMap((langue) => {
    const liste = passage.secret?.[langue]?.['indices'];
    // La régie reçoit tous les indices : l'aperçu n'en montre pas plus que l'écran.
    return Array.isArray(liste)
      ? [{ langue, liste: (liste as string[]).slice(0, etat.pilotage.indices) }]
      : [];
  });

  return (
    <div className="tu-stage__body" data-scene="list2" data-etape={etape ?? ''}>
      <SonDeLArret palier={palierArrete} />
      <p className="tu-stage__head-line">
        <Pastille equipe={equipe} grande />
      </p>

      {etape === 'pret' && (
        <p className="tu-stage__xl tu-stage-centre">{t('yeuxFermes', { equipe: equipe.nom })}</p>
      )}

      {etape === 'consigne' && (
        <div className="tu-stage-centre tu-stage-reveal">
          <p className="tu-stage__m tu-stage__muted">{t('pointCommun')}</p>
          <Multilingue
            testId="point-commun"
            className="tu-stage-multi--geant"
            textes={texteParLangue(passage.secret, 'reponse', langues)}
          />
        </div>
      )}

      {etape === 'masque' && (
        <div className="tu-stage-centre">
          <p className="tu-stage__xl">{t('ouvrezLesYeux', { equipe: equipe.nom })}</p>
          <Multilingue textes={texteParLangue(passage.public, 'consigne', langues)} />
        </div>
      )}

      {(etape === 'lance' || etape === 'trouve' || etape === 'echec') && (
        <div className="tu-stage-jeu">
          <Chrono
            departMs={depart}
            dureeS={CHRONO_POINTS_COMMUNS_S}
            decalageMs={decalageMs}
            className={cx('tu-stage__giant', jeu.arret && 'tu-stage__muted')}
            arret={jeu.jeuMs}
          />
          <ol className="tu-stage-paliers">
            {PALIERS.map((p, i) => (
              <li
                key={i}
                className={cx('tu-stage-palier', i === palier && 'tu-stage-palier--actif')}
              >
                <span>{t('palier', { n: i + 1 })}</span>
                <span className="tu-stage-palier__mult">×{p.multiplicateur}</span>
              </li>
            ))}
          </ol>
          {etape === 'lance' && jeu.arret && (
            <p className="tu-stage__l" data-testid="arret" role="status">
              {jeu.arret.repriseDansMs === null
                ? t('arretIndice')
                : t('reprise', { s: Math.ceil(jeu.arret.repriseDansMs / 1000) })}
            </p>
          )}
          {etat.pilotage.indices > 0 && indices.length > 0 && (
            <div className="tu-stage-indices" data-testid="indices">
              {indices[0]!.liste.map((_, i) => (
                <Multilingue
                  key={i}
                  textes={indices.flatMap(({ langue, liste }) =>
                    liste[i] ? [{ langue, texte: liste[i] }] : [],
                  )}
                />
              ))}
            </div>
          )}
          {etape !== 'lance' && (
            <p
              className={cx(
                'tu-stage__xl tu-stage-reveal',
                etape === 'trouve' ? 'tu-stage-gagne' : 'tu-stage-perdu',
              )}
              data-testid="verdict"
            >
              {etape === 'trouve' ? t('trouve') : t('rate')} ·{' '}
              {t('points', { points: passage.points ?? 0 })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Surenchere({ etat, decalageMs, manche }: Props & { manche: MancheSalle }) {
  const t = useTranslations('ecran');
  const { etape, chrono_depart_ms: depart, chrono_duree_s: duree } = etat.pilotage;
  const langues = etat.evenement.langues;
  const passage = passageCourant(etat);
  const chronoS =
    typeof manche.options['chrono_s'] === 'number'
      ? manche.options['chrono_s']
      : CHRONO_SURENCHERE_DEFAUT_S;

  if (etape === 'themes' || !passage) {
    return (
      <div className="tu-stage__body" data-scene="enchere2" data-etape="themes">
        <h1 className="tu-stage__xl">{t('themes')}</h1>
        <ul className="tu-stage-themes">
          {manche.passages.map((p) => {
            const champion = etat.equipes.find((e) => e.numero === p.resultat['equipe_champion']);
            return (
              <li
                key={p.id}
                className={cx('tu-stage-theme', p.statut === 'termine' && 'tu-stage-theme--joue')}
              >
                <Multilingue textes={texteParLangue(p.public, 'theme', langues)} />
                {p.statut === 'termine' && (
                  <>
                    <Multilingue textes={texteParLangue(p.secret, 'sujet', langues)} />
                    {champion && (
                      <p className="tu-stage__m">
                        {p.resultat['tenu'] ? t('tenu') : t('perdu')} · {champion.nom}
                      </p>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const champion = etat.equipes.find((e) => e.numero === passage.resultat['equipe_champion']);
  return (
    <div className="tu-stage__body" data-scene="enchere2" data-etape={etape ?? ''}>
      <Multilingue
        className="tu-stage-multi--titre"
        textes={texteParLangue(passage.public, 'theme', langues)}
      />
      <div className="tu-stage-centre tu-stage-reveal">
        <p className="tu-stage__m tu-stage__muted">{t('sujet')}</p>
        <Multilingue
          testId="sujet"
          className="tu-stage-multi--geant"
          textes={texteParLangue(passage.secret, 'sujet', langues)}
        />
      </div>
      {etape === 'chrono' && (
        <Chrono
          departMs={depart}
          dureeS={duree ?? chronoS}
          decalageMs={decalageMs}
          className="tu-stage__giant"
        />
      )}
      {(etape === 'tenu' || etape === 'rate') && (
        <p
          className={cx(
            'tu-stage__xl tu-stage-reveal',
            etape === 'tenu' ? 'tu-stage-gagne' : 'tu-stage-perdu',
          )}
          data-testid="verdict"
        >
          {etape === 'tenu' ? t('tenu') : t('perdu')}
          {champion && ` · ${champion.nom}`}
        </p>
      )}
    </div>
  );
}

function Scores({ etat }: { etat: EtatSalle }) {
  const t = useTranslations('ecran');
  const rang = classement(etat);
  const max = Math.max(1, ...rang.map((e) => e.points));
  return (
    <div className="tu-stage__body" data-scene="scores">
      <h1 className="tu-stage__xl">{t('scores')}</h1>
      <ol className="tu-stage-rank">
        {rang.map((e) => (
          <li key={e.id} className={cx('tu-stage-rank__ligne', teamModifier(e.numero))}>
            <span className="tu-stage-rank__nom">{e.nom}</span>
            <span className="tu-stage-rank__barre">
              <span
                className="tu-stage-rank__remplie"
                style={{ inlineSize: `${(e.points / max) * 100}%` }}
              />
            </span>
            <span className="tu-stage-rank__points" data-testid={`points-${e.numero}`}>
              {e.points}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Podium({ etat }: { etat: EtatSalle }) {
  const t = useTranslations('ecran');
  const [premier, deuxieme, troisieme] = classement(etat);
  const marche = (equipe: EquipeSalle | undefined, place: 1 | 2 | 3) =>
    equipe && (
      <li
        className={cx('tu-stage-podium__marche', `tu-stage-podium__marche--${place}`)}
        data-testid={`podium-${place}`}
      >
        <Pastille equipe={equipe} grande />
        <span className="tu-stage-podium__points">{equipe.points}</span>
        <span className="tu-stage-podium__socle">{place}</span>
      </li>
    );
  return (
    <div className="tu-stage__body tu-stage-reveal" data-scene="podium">
      <h1 className="tu-stage__xl">{t('podium')}</h1>
      <ol className="tu-stage-podium">
        {marche(deuxieme, 2)}
        {marche(premier, 1)}
        {marche(troisieme, 3)}
      </ol>
      <p className="tu-stage__l">{t('merci')}</p>
    </div>
  );
}

const LETTRES = ['A', 'B', 'C', 'D'] as const;

/** Survivants validés en fin de manche, ou comptés en direct par la base en mode téléphone. */
function survivantsDe(manche: MancheSalle): Record<string, number> | null {
  const valides = manche.options['survivants'];
  if (valides && typeof valides === 'object') return valides as Record<string, number>;
  return manche.survivants ?? null;
}

function Quiz({ etat, decalageMs, manche }: Props & { manche: MancheSalle }) {
  const t = useTranslations('ecran');
  const { etape, chrono_depart_ms: depart, chrono_duree_s: duree } = etat.pilotage;
  const langues = etat.evenement.langues;
  const passage = passageCourant(etat);
  const telephone = manche.options['mode'] === 'telephone';

  if (etape === 'survivants' || etape === 'resultat') {
    const survivants = survivantsDe(manche);
    const valide = etape === 'resultat';
    return (
      <div className="tu-stage__body" data-scene="qcm2" data-etape={etape}>
        <h1 className="tu-stage__xl">{t('finQuiz')}</h1>
        {survivants && (telephone || valide) && (
          <ul className="tu-stage-teams" data-testid="survivants">
            {etat.equipes.map((e) => {
              const n = survivants[String(e.numero)] ?? 0;
              return (
                <li key={e.id} className={cx('tu-stage-team', teamModifier(e.numero))}>
                  <span className="tu-stage-team__nom">{e.nom}</span>
                  <span className="tu-stage-team__nombre">{t('survivants', { n })}</span>
                  {valide && (
                    <span className="tu-stage-team__nombre">
                      {t('points', { points: n * POINTS_PAR_SURVIVANT })}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  if (!passage) return null;
  const numero = t('question', { n: passage.ordre, total: manche.passages.length });

  if (etape === 'pret') {
    return (
      <div className="tu-stage__body tu-stage-centre" data-scene="qcm2" data-etape="pret">
        <p className="tu-stage__giant">{numero}</p>
      </div>
    );
  }

  const revelee = etape === 'reponse';
  const bonne = revelee ? passage.secret?.[langues[0] ?? 'fr']?.['bonne'] : undefined;
  const propositions = (i: number) =>
    langues.flatMap((langue) => {
      const liste = passage.public[langue]?.['propositions'];
      const texte: unknown = Array.isArray(liste) ? liste[i] : undefined;
      return typeof texte === 'string' ? [{ langue, texte }] : [];
    });

  return (
    <div className="tu-stage__body" data-scene="qcm2" data-etape={etape ?? ''}>
      <div className="tu-stage-quiz__tete">
        <p className="tu-stage__m tu-stage__muted">
          {numero}
          {etape === 'question' &&
            (telephone ? ` · ${t('reponses', { n: passage.reponses ?? 0 })}` : ` · ${t('croix')}`)}
        </p>
        {etape === 'question' && (
          <Chrono
            departMs={depart}
            dureeS={duree ?? CHRONO_QUESTION_S}
            decalageMs={decalageMs}
            className="tu-stage__xl"
          />
        )}
      </div>
      <Multilingue
        testId="question"
        className="tu-stage-multi--titre"
        textes={texteParLangue(passage.public, 'question', langues)}
      />
      <ol className="tu-stage-quiz">
        {LETTRES.map((lettre, i) => (
          <li
            key={lettre}
            className={cx(
              'tu-stage-quiz__zone',
              revelee &&
                (i === bonne ? 'tu-stage-quiz__zone--bonne' : 'tu-stage-quiz__zone--fausse'),
            )}
            data-testid={i === bonne ? 'bonne-reponse' : undefined}
          >
            <span className="tu-stage-quiz__lettre">{lettre}</span>
            <Multilingue textes={propositions(i)} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Mime({ etat, decalageMs }: Props) {
  const t = useTranslations('ecran');
  const passage = passageCourant(etat);
  const equipe = equipeDe(etat, passage?.equipe_id ?? null);
  const { etape, chrono_depart_ms: depart } = etat.pilotage;
  if (!passage || !equipe) return null;

  if (etape === 'trouve' || etape === 'rate') {
    // Plein écran vert si le mot est trouvé, rouge sinon (spec v3, jeu 04).
    return (
      <div
        className={cx(
          'tu-stage__body tu-stage-centre tu-stage-reveal tu-stage-verdict',
          etape === 'trouve' ? 'tu-stage-verdict--vert' : 'tu-stage-verdict--rouge',
        )}
        data-scene="mime2"
        data-etape={etape}
      >
        <Pastille equipe={equipe} grande />
        <p className="tu-stage__m">{t('leMot')}</p>
        <Multilingue
          testId="mot"
          className="tu-stage-multi--geant"
          textes={texteParLangue(passage.secret, 'mot', etat.evenement.langues)}
        />
        <p className="tu-stage__xl" data-testid="verdict">
          {etape === 'trouve' ? t('trouve') : t('rate')} ·{' '}
          {t('points', { points: passage.points ?? 0 })}
        </p>
      </div>
    );
  }

  return (
    <div className="tu-stage__body" data-scene="mime2" data-etape={etape ?? ''}>
      <p className="tu-stage__head-line">
        <Pastille equipe={equipe} grande />
      </p>
      {etape === 'pret' && (
        <p className="tu-stage__xl tu-stage-centre">{t('mimeFile', { equipe: equipe.nom })}</p>
      )}
      {etape === 'secret' && (
        <p className="tu-stage__xl tu-stage-centre tu-stage-reveal">{t('mimeJ1')}</p>
      )}
      {etape === 'lance' && (
        <div className="tu-stage-jeu">
          <Chrono
            departMs={depart}
            dureeS={CHRONO_MIME_S}
            decalageMs={decalageMs}
            className="tu-stage__giant"
          />
          <p className="tu-stage__l">{t('mimeChaine')}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Diffusion photo (spec v3, jeu 05) : un thème à la fois, toutes les photos côte à côte. La
 * gagnante, désignée à l'oral, passe au premier plan ; les autres s'effacent.
 */
function Photo({ etat, manche }: Props & { manche: MancheSalle }) {
  const t = useTranslations('ecran');
  const passage = passageCourant(etat);
  const urls = usePhotosSignees(
    manche.passages.flatMap((p) => (p.photos ?? []).map((ph) => ph.chemin)),
  );
  if (!passage) return null;

  const { etape } = etat.pilotage;
  const photos = passage.photos ?? [];
  const numeroGagnant = passage.resultat['equipe_gagnante'];
  const verdict = etape === 'gagnante';

  return (
    <div className="tu-stage__body" data-scene="photo2" data-etape={etape ?? ''}>
      <p className="tu-stage__m">
        {t('themePhoto', { n: passage.ordre, total: manche.passages.length })}
      </p>
      <Multilingue
        testId="theme-photo"
        textes={texteParLangue(passage.public, 'theme', etat.evenement.langues)}
      />
      {photos.length === 0 ? (
        <p className="tu-stage__l tu-stage-centre">{t('aucunePhoto')}</p>
      ) : (
        <ul className="tu-stage-photos">
          {photos.map((ph) => {
            const equipe = equipeDe(etat, ph.equipe_id);
            const gagnante = verdict && equipe?.numero === numeroGagnant;
            const url = urls[ph.chemin];
            return (
              <li
                key={ph.chemin}
                className={cx(
                  'tu-stage-photo',
                  gagnante && 'tu-stage-photo--gagnante tu-stage-reveal',
                  verdict && !gagnante && 'tu-stage-photo--eteinte',
                )}
                data-testid={gagnante ? 'photo-gagnante' : 'photo'}
              >
                {url ? (
                  // Image d'une URL signée, déjà préchargée : rien à optimiser côté Next.
                  <img
                    className="tu-stage-photo__image"
                    src={url}
                    alt={t('photoDe', { equipe: equipe?.nom ?? '' })}
                  />
                ) : (
                  <span className="tu-stage-photo__image tu-stage-photo__image--attente" />
                )}
                {equipe && <Pastille equipe={equipe} grande={gagnante} />}
                {gagnante && (
                  <p className="tu-stage__xl" data-testid="verdict-photo">
                    {t('gagnante')} · {t('points', { points: passage.points ?? 0 })}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Duel en bêta (cahier des charges § 5.2) : les noms des deux duellistes et le chrono. Rien
 * avant « Présenter » : la régie peut encore retirer un duelliste absent.
 */
function Duel({ etat, decalageMs, jeu }: Props & { jeu: 'grab' | 'cup' }) {
  const t = useTranslations('ecran');
  const passage = passageCourant(etat);
  const { etape, chrono_depart_ms: depart } = etat.pilotage;
  const duellistes = passage ? duellistesDe(passage.resultat) : null;
  const equipe = (numero: number) => etat.equipes.find((e) => e.numero === numero);

  if (etape === 'tirage' || !duellistes) {
    return (
      <div className="tu-stage__body tu-stage-centre" data-scene="duel" data-etape="tirage">
        <p className="tu-stage__xl">{t('duelProchain')}</p>
      </div>
    );
  }

  const gagnant = passage?.resultat['gagnant'];
  const face = (i: 0 | 1) => {
    const d = duellistes[i];
    const e = equipe(d.equipe);
    return (
      <div
        key={d.joueur_id}
        className={cx(
          'tu-stage-duel__joueur',
          etape === 'gagne' && gagnant !== i && 'tu-stage-duel__joueur--efface',
        )}
      >
        <p className="tu-stage-duel__prenom">{d.prenom}</p>
        {e && <Pastille equipe={e} grande />}
      </div>
    );
  };

  return (
    <div
      className="tu-stage__body tu-stage-centre tu-stage-reveal"
      data-scene="duel"
      data-etape={etape ?? ''}
    >
      <div className="tu-stage-duel" data-testid="duel">
        {face(0)}
        <p className="tu-stage__l">{t('contre')}</p>
        {face(1)}
      </div>
      {etape === 'chrono' && (
        <Chrono
          departMs={depart}
          dureeS={chronoDuelS(jeu)}
          decalageMs={decalageMs}
          className="tu-stage__giant"
        />
      )}
      {etape === 'gagne' && (
        <p className="tu-stage__xl" data-testid="verdict-duel">
          {t('points', { points: passage?.points ?? 0 })}
        </p>
      )}
    </div>
  );
}
