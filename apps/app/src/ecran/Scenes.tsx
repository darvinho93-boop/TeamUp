'use client';

import { useTranslations } from 'next-intl';
import { cx, teamModifier, Wordmark } from '@teamup/ui/react';
import {
  CHRONO_MIME_S,
  CHRONO_POINTS_COMMUNS_S,
  CHRONO_QUESTION_S,
  CHRONO_SURENCHERE_DEFAUT_S,
  etatPaliers,
  PALIERS,
  POINTS_PAR_SURVIVANT,
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
} from '@/lib/salle';
import { Chrono, useMaintenant } from './Chrono';
import { Multilingue } from './Multilingue';

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
      return <Equipes etat={etat} />;
    case 'programme':
      return <Programme etat={etat} />;
    case 'intro':
      return <Intro etat={etat} />;
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
        <Wordmark className="tu-stage-accueil__logo" />
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

function Equipes({ etat }: { etat: EtatSalle }) {
  const t = useTranslations('ecran');
  return (
    <div className="tu-stage__body" data-scene="equipes">
      <h1 className="tu-stage__xl">{t('equipes')}</h1>
      <ul className="tu-stage-teams">
        {etat.equipes.map((e) => (
          <li key={e.id} className={cx('tu-stage-team', teamModifier(e.numero))}>
            <span className="tu-stage-team__nom">{e.nom}</span>
            <span className="tu-stage-team__nombre">{t('joueurs', { n: e.joueurs })}</span>
            <span className="tu-stage-team__prenoms">{e.prenoms.join(' · ')}</span>
          </li>
        ))}
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

function Intro({ etat }: { etat: EtatSalle }) {
  const t = useTranslations();
  const manche = mancheCourante(etat);
  if (!manche) return null;
  return (
    <div className="tu-stage__body tu-stage-centre tu-stage-reveal" data-scene="intro">
      <h1 className="tu-stage__giant">{t(`jeux.${manche.jeu}`)}</h1>
      <p className="tu-stage__l">{t(`ecran.regles.${manche.jeu}`)}</p>
    </div>
  );
}

function Jeu(props: Props) {
  const manche = mancheCourante(props.etat);
  if (manche?.jeu === 'list2') return <PointsCommuns {...props} />;
  if (manche?.jeu === 'enchere2') return <Surenchere {...props} manche={manche} />;
  if (manche?.jeu === 'qcm2') return <Quiz {...props} manche={manche} />;
  if (manche?.jeu === 'mime2') return <Mime {...props} />;
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
  const palier = etatPaliers(ecoule).palier;
  const indices = langues.flatMap((langue) => {
    const liste = passage.secret?.[langue]?.['indices'];
    // La régie reçoit tous les indices : l'aperçu n'en montre pas plus que l'écran.
    return Array.isArray(liste)
      ? [{ langue, liste: (liste as string[]).slice(0, etat.pilotage.indices) }]
      : [];
  });

  return (
    <div className="tu-stage__body" data-scene="list2" data-etape={etape ?? ''}>
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
            className="tu-stage__giant"
            {...(etape === 'lance' ? {} : { arret: ecoule })}
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
