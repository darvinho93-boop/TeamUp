'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button, cx, teamModifier } from '@teamup/ui/react';
import {
  actionsMime,
  actionsPointsCommuns,
  actionsQuiz,
  actionsSurenchere,
  CHRONO_MIME_S,
  CHRONO_POINTS_COMMUNS_S,
  CHRONO_QUESTION_S,
  CHRONO_SURENCHERE_DEFAUT_S,
  passageSuivant,
  type ActionPointsCommuns,
  type EtapeMime,
  type EtapePhoto,
  type EtapePointsCommuns,
  type EtapeQuiz,
  type EtapeSurenchere,
  type GameCode,
  ordreDesPassages,
  tirerOrdre,
} from '@teamup/game';
import { calculerEtape, jeuParEquipe, scriptEnCours, type Commande } from '@/lib/pilotage';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';
import type { Json } from '@/types/base';
import {
  ecouleMs,
  equipeDe,
  mancheCourante,
  passageCourant,
  texteParLangue,
  type EtatSalle,
  type MancheSalle,
  type ParLangue,
  type Scene,
} from '@/lib/salle';
import { Chrono, useMaintenant } from '@/ecran/Chrono';
import { useEtatSalle } from '@/ecran/useEtatSalle';
import { Apercu } from './Apercu';
import { BoutonConfirme } from './BoutonConfirme';
import { PanneauDuel } from './PanneauDuel';

/** Jeux que la régie sait piloter (lots 6 à 8, duels en bêta au lot 10). */
const PILOTABLES: readonly GameCode[] = [
  'list2',
  'enchere2',
  'qcm2',
  'mime2',
  'photo2',
  'grab',
  'cup',
];
const LETTRES = ['A', 'B', 'C', 'D'] as const;

const SCENES_LIBRES: Exclude<Scene, 'intro' | 'jeu'>[] = [
  'accueil',
  'equipes',
  'programme',
  'scores',
  'podium',
];

type Agir = (commande: Commande) => void;

/** La régie en soirée : l'aperçu de l'écran à gauche, les grosses touches à droite. */
export function Pilotage({
  code,
  initial,
  qrSvg,
  adresse,
}: {
  code: string;
  initial: EtatSalle;
  qrSvg: string;
  adresse: string;
}) {
  const t = useTranslations('regie.pilotage');
  const tJeux = useTranslations('jeux');
  const { etat, decalageMs, enDirect, relire, signaler } = useEtatSalle(code, initial, true);
  const [occupe, demarrer] = useTransition();
  const [alerte, setAlerte] = useState<string>();

  const agir: Agir = (commande) => {
    // Le temps compté est celui de l'appui, pas celui où la base reçoit l'écriture.
    const ecoule = ecouleMs(etat, decalageMs);
    const ecriture = calculerEtape(etat, commande, ecoule, {
      pointsCommuns: (equipe) => t('motifPointsCommuns', { equipe }),
      tenu: t('motifTenu'),
      rate: t('motifRate'),
      quiz: (survivants) => t('motifQuiz', { survivants }),
      mime: (equipe) => t('motifMime', { equipe }),
      photo: (equipe) => t('motifPhoto', { equipe }),
      duel: (prenom, equipe) => t('motifDuel', { prenom, equipe }),
    });
    if (!ecriture) {
      setAlerte(t('erreur.impossible'));
      return;
    }
    demarrer(async () => {
      const supabase = supabaseNavigateur();
      // L'ordre tiré s'écrit d'abord : l'écran, réveillé par l'étape, le lira déjà rangé.
      if (ecriture.ordre) {
        const { error: refus } = await supabase.rpc('ordonner_passages', {
          p_manche: ecriture.ordre.manche_id,
          p_passages: ecriture.ordre.passages,
        });
        if (refus) {
          setAlerte(t('erreur.impossible'));
          await relire();
          return;
        }
      }
      const { error } = await supabase.rpc('enregistrer_etape', {
        p_evenement: etat.evenement.id,
        p_version: etat.pilotage.version,
        p_pilotage: ecriture.pilotage as unknown as Json,
        p_passage: ecriture.passage as unknown as Json,
        p_manche: ecriture.manche as unknown as Json,
        p_scores: ecriture.scores,
      });
      if (error) {
        setAlerte(t(/périmé/.test(error.message) ? 'erreur.perime' : 'erreur.impossible'));
      } else {
        // L'écran commun relit tout de suite, sans attendre la réplication de la base.
        signaler();
        setAlerte(undefined);
        if (ecriture.ouvrirLaSoiree) {
          await supabase
            .from('evenements')
            .update({ statut: 'en_cours', commence_le: new Date().toISOString() })
            .eq('id', etat.evenement.id);
        }
      }
      await relire();
    });
  };

  const manche = mancheCourante(etat);
  const { scene } = etat.pilotage;

  return (
    <div className="tu-regie-pilot" aria-busy={occupe}>
      <div className="tu-regie__section">
        <Apercu etat={etat} decalageMs={decalageMs} qrSvg={qrSvg} adresse={adresse} />
        <p className="tu-regie__muted" role="status">
          {enDirect ? t('enDirect') : t('reconnexion')} · {t('connectes', { n: etat.connectes })}
          {' · '}
          <a href={`/ecran/${code}`} target="_blank" rel="noopener" className="tu-regie__lien">
            {t('ouvrirEcran')}
          </a>
        </p>
        <div className="tu-cluster" role="group" aria-label={t('scenes')}>
          {SCENES_LIBRES.map((s) => (
            <Button
              key={s}
              variant={scene === s ? 'primary' : 'ghost'}
              aria-pressed={scene === s}
              onClick={() => agir({ type: 'scene', scene: s })}
            >
              {t(`scene.${s}`)}
            </Button>
          ))}
        </div>
        <ol className="tu-regie-list" aria-label={t('programme')}>
          {etat.programme.map((m) => (
            <li
              key={m.id}
              className={cx('tu-regie-item', m.id === manche?.id && 'tu-regie-item--courant')}
            >
              <span className="tu-regie-item__title">
                {tJeux(m.jeu)} · {t(`statut.${m.statut}`)}
              </span>
              {m.statut !== 'terminee' && m.statut !== 'annulee' && PILOTABLES.includes(m.jeu) && (
                <Button variant="ghost" onClick={() => agir({ type: 'intro', mancheId: m.id })}>
                  {t('presenter')}
                </Button>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="tu-regie__section">
        {alerte && (
          <p className="tu-regie__alert" role="alert">
            {alerte}
          </p>
        )}
        {scene === 'intro' && manche && jeuParEquipe(manche.jeu) && manche.statut === 'a_venir' && (
          <PanneauTirage manche={manche} agir={agir} />
        )}
        {scene === 'intro' && manche && (
          <PanneauExplication etat={etat} manche={manche} decalageMs={decalageMs} agir={agir} />
        )}
        {scene === 'intro' && manche && manche.jeu !== 'qcm2' && (
          <Button
            variant="accent"
            size="lg"
            className="tu-regie-keys__wide"
            onClick={() => agir({ type: 'commencer' })}
          >
            {t('commencer', { jeu: tJeux(manche.jeu) })}
          </Button>
        )}
        {scene === 'intro' && manche?.jeu === 'qcm2' && (
          // Le mode se choisit au lancement de la manche ; la croix d'abord, le téléphone
          // seulement quand la salle ne permet pas de tracer une croix (spec v3).
          <div className="tu-regie-keys">
            <Button
              variant="accent"
              size="lg"
              className="tu-regie-keys__wide"
              onClick={() => agir({ type: 'commencer', mode: 'croix' })}
            >
              {t('quiz.commencerCroix')}
            </Button>
            <Button
              variant="ghost"
              className="tu-regie-keys__wide"
              onClick={() => agir({ type: 'commencer', mode: 'telephone' })}
            >
              {t('quiz.commencerTelephone')}
            </Button>
          </div>
        )}
        {scene === 'jeu' && manche?.jeu === 'list2' && (
          <PanneauPointsCommuns etat={etat} manche={manche} decalageMs={decalageMs} agir={agir} />
        )}
        {scene === 'jeu' && manche?.jeu === 'enchere2' && (
          <PanneauSurenchere etat={etat} manche={manche} decalageMs={decalageMs} agir={agir} />
        )}
        {scene === 'jeu' && manche?.jeu === 'qcm2' && (
          <PanneauQuiz etat={etat} manche={manche} decalageMs={decalageMs} agir={agir} />
        )}
        {scene === 'jeu' && manche?.jeu === 'mime2' && (
          <PanneauMime etat={etat} manche={manche} decalageMs={decalageMs} agir={agir} />
        )}
        {scene === 'jeu' && manche?.jeu === 'photo2' && (
          <PanneauPhoto etat={etat} manche={manche} decalageMs={decalageMs} agir={agir} />
        )}
        {scene === 'jeu' && (manche?.jeu === 'grab' || manche?.jeu === 'cup') && (
          <PanneauDuel
            etat={etat}
            manche={manche as MancheSalle & { jeu: 'grab' | 'cup' }}
            decalageMs={decalageMs}
            agir={agir}
          />
        )}
        {scene !== 'jeu' && scene !== 'intro' && (
          <p className="tu-regie__muted">{t('choisirJeu')}</p>
        )}
      </div>
    </div>
  );
}

interface PanneauProps {
  etat: EtatSalle;
  manche: MancheSalle;
  decalageMs: number;
  agir: Agir;
}

/** Un hasard sûr, celui du navigateur : personne ne peut prévoir le tirage. */
function aleaCrypto(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
}

/**
 * Tirage de l'ordre de passage en direct (lot 13) : la régie tire, l'écran anime. Les équipes
 * sont celles des passages de la manche ; chaque tour reprend l'ordre tiré.
 */
function PanneauTirage({ manche, agir }: Pick<PanneauProps, 'manche' | 'agir'>) {
  const t = useTranslations('regie.pilotage.tirage');
  const tirer = () => {
    const equipes = [
      ...new Set(manche.passages.flatMap((p) => (p.equipe_id ? [p.equipe_id] : []))),
    ];
    const ordre = tirerOrdre(equipes, aleaCrypto);
    agir({ type: 'tirerOrdre', passages: ordreDesPassages(manche.passages, ordre) });
  };
  return (
    <div className="tu-cluster">
      <Button variant="ghost" onClick={tirer}>
        {manche.options['ordre_tire'] === true ? t('retirer') : t('tirer')}
      </Button>
    </div>
  );
}

/**
 * Explication animée (lot 12) : facultative, lancée à la demande. La salle la voit sur
 * l'écran, la régie dans son aperçu ; ici, seulement les touches et le temps qui reste.
 */
function PanneauExplication({ etat, manche, decalageMs, agir }: PanneauProps) {
  const t = useTranslations('regie.pilotage.explication');
  const { etape, chrono_depart_ms: depart, chrono_duree_s: duree } = etat.pilotage;
  const enCours = scriptEnCours(manche.jeu, 'intro', etape) !== null;
  if (!enCours) {
    return manche.jeu === 'qcm2' ? (
      <div className="tu-cluster">
        <Button variant="ghost" onClick={() => agir({ type: 'expliquer' })}>
          {t('expliquerCroix')}
        </Button>
        <Button variant="ghost" onClick={() => agir({ type: 'expliquer', telephone: true })}>
          {t('expliquerTelephone')}
        </Button>
      </div>
    ) : (
      <div className="tu-cluster">
        <Button variant="ghost" onClick={() => agir({ type: 'expliquer' })}>
          {t('expliquer')}
        </Button>
      </div>
    );
  }
  return (
    <div className="tu-cluster">
      <span className="tu-regie__muted">
        {t('enCours')} <Chrono departMs={depart} dureeS={duree ?? 0} decalageMs={decalageMs} />
      </span>
      <Button
        variant="ghost"
        onClick={() => agir({ type: 'expliquer', telephone: etape === 'explication-telephone' })}
      >
        {t('rejouer')}
      </Button>
      <Button variant="ghost" onClick={() => agir({ type: 'arreterExplication' })}>
        {t('arreter')}
      </Button>
    </div>
  );
}

function PanneauPointsCommuns({ etat, manche, decalageMs, agir }: PanneauProps) {
  const t = useTranslations('regie.pilotage');
  const passage = passageCourant(etat);
  const equipe = equipeDe(etat, passage?.equipe_id ?? null);
  const etape = etat.pilotage.etape as EtapePointsCommuns;
  const maintenant = useMaintenant(etape === 'lance');
  if (!passage || !equipe) return null;

  const ecoule = ecouleMs(etat, decalageMs, maintenant);
  const permises = actionsPointsCommuns({ etape, indices: etat.pilotage.indices }, ecoule);
  const langue = etat.evenement.langues[0] ?? 'fr';
  const reponse = texteParLangue(passage.secret, 'reponse', [langue])[0]?.texte;
  const indices = passage.secret?.[langue]?.['indices'];
  const fini = etape === 'trouve' || etape === 'echec';
  const suivant = passageSuivant(manche);
  const equipeSuivante = equipeDe(
    etat,
    manche.passages.find((x) => x.id === suivant?.id)?.equipe_id ?? null,
  );

  const touche = (action: ActionPointsCommuns, libelle: string) => (
    <Button
      key={action}
      disabled={!permises.includes(action)}
      onClick={() => agir({ type: 'pointsCommuns', action })}
    >
      {libelle}
    </Button>
  );

  return (
    <section className="tu-regie__section" aria-label={t('pointsCommuns')}>
      <p className={cx('tu-team tu-team--badge tu-team--lg', teamModifier(equipe.numero))}>
        {equipe.nom}
      </p>
      <div className="tu-regie-secret">
        <p className="tu-regie__muted">{t('reponse')}</p>
        <p className="tu-regie-item__title" data-testid="regie-reponse">
          {reponse ?? '—'}
        </p>
        {Array.isArray(indices) && (
          <p className="tu-regie__muted">
            {t('indices')} : {(indices as string[]).join(' · ')}
          </p>
        )}
      </div>
      <Chrono
        departMs={etat.pilotage.chrono_depart_ms}
        dureeS={CHRONO_POINTS_COMMUNS_S}
        decalageMs={decalageMs}
        className="tu-regie-timer"
        {...(etape === 'lance'
          ? {}
          : {
              arret:
                typeof passage.resultat['ecoule_ms'] === 'number'
                  ? passage.resultat['ecoule_ms']
                  : 0,
            })}
      />
      <div className="tu-regie-keys">
        {touche('afficher', t('afficher'))}
        {touche('masquer', t('masquer'))}
        {touche('lancer', t('lancer'))}
        {touche('indice', t('indice', { n: etat.pilotage.indices }))}
        <BoutonConfirme
          disabled={!permises.includes('valider')}
          confirmation={t('confirmer', { action: t('valider') })}
          onConfirm={() => agir({ type: 'pointsCommuns', action: 'valider' })}
        >
          {t('valider')}
        </BoutonConfirme>
        <BoutonConfirme
          variant="ghost"
          disabled={!permises.includes('echec')}
          confirmation={t('confirmer', { action: t('echec') })}
          onConfirm={() => agir({ type: 'pointsCommuns', action: 'echec' })}
        >
          {t('echec')}
        </BoutonConfirme>
        {fini && suivant && (
          <Button
            variant="accent"
            className="tu-regie-keys__wide"
            onClick={() => agir({ type: 'suivant' })}
          >
            {t('suivant', { equipe: equipeSuivante?.nom ?? '' })}
          </Button>
        )}
        {fini && (
          <Button
            variant={suivant ? 'ghost' : 'accent'}
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

function PanneauSurenchere({ etat, manche, decalageMs, agir }: PanneauProps) {
  const t = useTranslations('regie.pilotage');
  const [champion, setChampion] = useState<number | null>(null);
  const etape = etat.pilotage.etape as EtapeSurenchere;
  const permises = actionsSurenchere({ etape, passageId: etat.pilotage.passage_id });
  const passage = passageCourant(etat);
  const langue = etat.evenement.langues[0] ?? 'fr';
  const chronoS =
    typeof manche.options['chrono_s'] === 'number'
      ? manche.options['chrono_s']
      : CHRONO_SURENCHERE_DEFAUT_S;
  const texte = (valeurs: ParLangue | null, cle: string) =>
    texteParLangue(valeurs, cle, [langue])[0]?.texte ?? '—';

  if (etape === 'themes' || !passage) {
    return (
      <section className="tu-regie__section" aria-label={t('surenchere')}>
        <ul className="tu-regie-list">
          {manche.passages.map((p) => (
            <li key={p.id} className="tu-regie-item">
              <div className="tu-regie-item__main">
                <span className="tu-regie-item__title">{texte(p.public, 'theme')}</span>
                <span className="tu-regie-item__meta">{texte(p.secret, 'sujet')}</span>
              </div>
              {p.statut === 'termine' ? (
                <span className="tu-regie__muted">{t('joue')}</span>
              ) : (
                <Button
                  disabled={!permises.includes('devoiler')}
                  onClick={() => agir({ type: 'devoiler', passageId: p.id })}
                >
                  {t('devoiler')}
                </Button>
              )}
            </li>
          ))}
        </ul>
        <Button
          variant={manche.passages.every((p) => p.statut === 'termine') ? 'accent' : 'ghost'}
          onClick={() => agir({ type: 'terminer' })}
        >
          {t('terminer')}
        </Button>
      </section>
    );
  }

  return (
    <section className="tu-regie__section" aria-label={t('surenchere')}>
      <div className="tu-regie-secret">
        <p className="tu-regie__muted">{texte(passage.public, 'theme')}</p>
        <p className="tu-regie-item__title">{texte(passage.secret, 'sujet')}</p>
      </div>
      {etape === 'sujet' && (
        <Button variant="accent" size="lg" onClick={() => agir({ type: 'adjuger' })}>
          {t('adjuger', { secondes: chronoS })}
        </Button>
      )}
      {etape === 'chrono' && (
        <>
          <Chrono
            departMs={etat.pilotage.chrono_depart_ms}
            dureeS={etat.pilotage.chrono_duree_s ?? chronoS}
            decalageMs={decalageMs}
            className="tu-regie-timer"
          />
          <fieldset className="tu-regie__choices">
            <legend className="tu-field__label">{t('champion')}</legend>
            {etat.equipes.map((e) => (
              <Button
                key={e.id}
                variant={champion === e.numero ? 'primary' : 'ghost'}
                aria-pressed={champion === e.numero}
                onClick={() => setChampion(e.numero)}
              >
                {e.nom}
              </Button>
            ))}
          </fieldset>
          <div className="tu-regie-keys">
            <BoutonConfirme
              disabled={champion === null}
              confirmation={t('confirmer', { action: t('tenu') })}
              onConfirm={() => agir({ type: 'verdict', tenu: true, equipeChampion: champion! })}
            >
              {t('tenu')}
            </BoutonConfirme>
            <BoutonConfirme
              variant="ghost"
              disabled={champion === null}
              confirmation={t('confirmer', { action: t('rate') })}
              onConfirm={() => agir({ type: 'verdict', tenu: false, equipeChampion: champion! })}
            >
              {t('rate')}
            </BoutonConfirme>
          </div>
        </>
      )}
      {(etape === 'tenu' || etape === 'rate') && (
        <Button
          variant="accent"
          size="lg"
          onClick={() => {
            setChampion(null);
            agir({ type: 'retour' });
          }}
        >
          {t('retour')}
        </Button>
      )}
    </section>
  );
}

function PanneauQuiz({ etat, manche, decalageMs, agir }: PanneauProps) {
  const t = useTranslations('regie.pilotage');
  const tq = useTranslations('regie.pilotage.quiz');
  const [saisie, setSaisie] = useState<Record<number, string>>({});
  const etape = etat.pilotage.etape as EtapeQuiz;
  const passage = passageCourant(etat);
  const telephone = manche.options['mode'] === 'telephone';
  const langue = etat.evenement.langues[0] ?? 'fr';
  const reste = manche.passages.some((x) => x.id !== passage?.id && x.statut !== 'termine');
  const permises = actionsQuiz({ etape, resteDesQuestions: reste });

  const question = passage?.public[langue];
  const propositions = Array.isArray(question?.['propositions'])
    ? (question['propositions'] as string[])
    : [];
  const bonne = passage?.secret?.[langue]?.['bonne'];

  // Survivants : comptés par la base en mode téléphone, saisis par l'animateur en mode croix.
  const survivants: Record<number, number> = Object.fromEntries(
    etat.equipes.map((e) => [
      e.numero,
      telephone
        ? (manche.survivants?.[String(e.numero)] ?? 0)
        : Math.max(0, Math.trunc(Number(saisie[e.numero] ?? '0')) || 0),
    ]),
  );

  const touche = (action: 'afficher' | 'reveler' | 'suivante' | 'fin', libelle: string) => (
    <Button
      key={action}
      disabled={!permises.includes(action)}
      onClick={() => agir({ type: 'quiz', action })}
    >
      {libelle}
    </Button>
  );

  if (etape === 'survivants' || etape === 'resultat') {
    const fini = etape === 'resultat';
    return (
      <section className="tu-regie__section" aria-label={tq('titre')}>
        <p className="tu-regie-item__title">
          {tq(telephone ? 'survivantsTelephone' : 'survivantsCroix')}
        </p>
        <ul className="tu-regie-list">
          {etat.equipes.map((e) => (
            <li key={e.id} className="tu-regie-item">
              <span className={cx('tu-team tu-team--badge', teamModifier(e.numero))}>{e.nom}</span>
              {telephone || fini ? (
                <span className="tu-regie-item__title" data-testid={`survivants-${e.numero}`}>
                  {tq('survivants', { n: survivants[e.numero] ?? 0 })}
                </span>
              ) : (
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={150}
                  className="tu-field__control tu-regie-survivants"
                  aria-label={tq('survivantsDe', { equipe: e.nom })}
                  value={saisie[e.numero] ?? '0'}
                  onChange={(ev) => setSaisie((s) => ({ ...s, [e.numero]: ev.target.value }))}
                />
              )}
            </li>
          ))}
        </ul>
        {!fini && (
          <BoutonConfirme
            size="lg"
            confirmation={t('confirmer', { action: tq('valider') })}
            onConfirm={() => agir({ type: 'survivants', survivants })}
          >
            {tq('valider')}
          </BoutonConfirme>
        )}
        {fini && (
          <Button variant="accent" size="lg" onClick={() => agir({ type: 'terminer' })}>
            {t('terminer')}
          </Button>
        )}
      </section>
    );
  }

  if (!passage) return null;

  return (
    <section className="tu-regie__section" aria-label={tq('titre')}>
      <p className="tu-regie__muted">
        {tq('numero', { n: passage.ordre, total: manche.passages.length })}
        {' · '}
        {tq(telephone ? 'modeTelephone' : 'modeCroix')}
      </p>
      <div className="tu-regie-secret">
        <p className="tu-regie-item__title">
          {typeof question?.['question'] === 'string' ? question['question'] : '—'}
        </p>
        <ol className="tu-regie-quiz">
          {propositions.map((texte, i) => (
            <li
              key={LETTRES[i]}
              className={cx('tu-regie-quiz__choix', i === bonne && 'tu-regie-quiz__choix--bonne')}
            >
              <span className="tu-regie-quiz__lettre">{LETTRES[i]}</span>
              <span>{texte}</span>
              {i === bonne && <span className="tu-regie-quiz__bonne">{tq('bonne')}</span>}
            </li>
          ))}
        </ol>
      </div>
      {etape === 'question' && (
        <Chrono
          departMs={etat.pilotage.chrono_depart_ms}
          dureeS={etat.pilotage.chrono_duree_s ?? CHRONO_QUESTION_S}
          decalageMs={decalageMs}
          className="tu-regie-timer"
        />
      )}
      {telephone && etape !== 'pret' && (
        <p className="tu-regie__muted" role="status" data-testid="regie-reponses">
          {tq('reponses', { n: passage.reponses ?? 0 })}
        </p>
      )}
      <div className="tu-regie-keys">
        {touche('afficher', tq('afficher'))}
        {touche('reveler', tq('reveler'))}
        {permises.includes('suivante') && touche('suivante', tq('suivante'))}
        {permises.includes('fin') && touche('fin', tq('fin'))}
        <BoutonConfirme
          variant="ghost"
          disabled={!permises.includes('annuler')}
          confirmation={t('confirmer', { action: tq('annuler') })}
          onConfirm={() => agir({ type: 'quiz', action: 'annuler' })}
        >
          {tq('annuler')}
        </BoutonConfirme>
      </div>
    </section>
  );
}

function PanneauMime({ etat, manche, decalageMs, agir }: PanneauProps) {
  const t = useTranslations('regie.pilotage');
  const tm = useTranslations('regie.pilotage.mime');
  const [motOuvert, setMotOuvert] = useState(false);
  const passage = passageCourant(etat);
  const equipe = equipeDe(etat, passage?.equipe_id ?? null);
  const etape = etat.pilotage.etape as EtapeMime;
  if (!passage || !equipe) return null;

  const permises = actionsMime(etape);
  const mots = texteParLangue(passage.secret, 'mot', etat.evenement.langues);
  const fini = etape === 'trouve' || etape === 'rate';
  const suivant = passageSuivant(manche);
  const equipeSuivante = equipeDe(
    etat,
    manche.passages.find((x) => x.id === suivant?.id)?.equipe_id ?? null,
  );

  return (
    <section className="tu-regie__section" aria-label={tm('titre')}>
      <p className={cx('tu-team tu-team--badge tu-team--lg', teamModifier(equipe.numero))}>
        {equipe.nom}
      </p>

      {motOuvert && (
        // Le mot, pour J1 seul : il vient le lire sur l'écran de régie (spec v3, jeu 04).
        <button
          type="button"
          className="tu-regie-mot"
          onClick={() => setMotOuvert(false)}
          data-testid="regie-mot"
        >
          <span className="tu-regie__muted">{tm('pourJ1')}</span>
          {mots.map(({ langue, texte }) => (
            <span key={langue} lang={langue} className="tu-regie-mot__texte">
              {texte}
            </span>
          ))}
          <span className="tu-regie__muted">{tm('fermer')}</span>
        </button>
      )}

      {(etape === 'lance' || fini) && (
        <div className="tu-regie-secret">
          <p className="tu-regie__muted">{tm('mot')}</p>
          <p className="tu-regie-item__title">{mots[0]?.texte ?? '—'}</p>
        </div>
      )}

      <Chrono
        departMs={etat.pilotage.chrono_depart_ms}
        dureeS={CHRONO_MIME_S}
        decalageMs={decalageMs}
        className="tu-regie-timer"
        {...(etape === 'lance'
          ? {}
          : {
              arret:
                typeof passage.resultat['ecoule_ms'] === 'number'
                  ? passage.resultat['ecoule_ms']
                  : 0,
            })}
      />

      <div className="tu-regie-keys">
        {etape === 'pret' && (
          <Button
            className="tu-regie-keys__wide"
            onClick={() => {
              setMotOuvert(true);
              agir({ type: 'mime', action: 'montrer' });
            }}
          >
            {tm('montrer')}
          </Button>
        )}
        {etape === 'secret' && (
          <>
            <Button variant="ghost" onClick={() => setMotOuvert(true)}>
              {tm('revoir')}
            </Button>
            <Button
              onClick={() => {
                setMotOuvert(false);
                agir({ type: 'mime', action: 'lancer' });
              }}
            >
              {t('lancer')}
            </Button>
          </>
        )}
        <BoutonConfirme
          disabled={!permises.includes('trouve')}
          confirmation={t('confirmer', { action: tm('trouve') })}
          onConfirm={() => agir({ type: 'mime', action: 'trouve' })}
        >
          {tm('trouve')}
        </BoutonConfirme>
        <BoutonConfirme
          variant="ghost"
          disabled={!permises.includes('rate')}
          confirmation={t('confirmer', { action: tm('rate') })}
          onConfirm={() => agir({ type: 'mime', action: 'rate' })}
        >
          {tm('rate')}
        </BoutonConfirme>
        {fini && suivant && (
          <Button
            variant="accent"
            className="tu-regie-keys__wide"
            onClick={() => agir({ type: 'suivant' })}
          >
            {t('suivant', { equipe: equipeSuivante?.nom ?? '' })}
          </Button>
        )}
        {fini && (
          <Button
            variant={suivant ? 'ghost' : 'accent'}
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

function PanneauPhoto({ etat, manche, agir }: PanneauProps) {
  const t = useTranslations('regie.pilotage');
  const tp = useTranslations('regie.pilotage.photo');
  const passage = passageCourant(etat);
  if (!passage) return null;

  const etape = etat.pilotage.etape as EtapePhoto;
  const langue = etat.evenement.langues[0] ?? 'fr';
  const theme = texteParLangue(passage.public, 'theme', [langue])[0]?.texte ?? '—';
  const envoyeuses = (passage.photos ?? []).flatMap((ph) => {
    const equipe = equipeDe(etat, ph.equipe_id);
    return equipe ? [equipe] : [];
  });
  const gagnante = etat.equipes.find((e) => e.numero === passage.resultat['equipe_gagnante']);
  const fini = etape === 'gagnante' || etape === 'aucune';
  const suivant = passageSuivant(manche);

  return (
    <section className="tu-regie__section" aria-label={tp('titre')}>
      <p className="tu-regie__muted">
        {tp('theme', { n: passage.ordre, total: manche.passages.length })}
      </p>
      <p className="tu-regie-item__title">{theme}</p>
      <p className="tu-regie__muted">{tp('envois', { n: envoyeuses.length })}</p>

      {etape === 'theme' && (
        <fieldset className="tu-regie__choices">
          <legend className="tu-field__label">{tp('designer')}</legend>
          {envoyeuses.map((e) => (
            <BoutonConfirme
              key={e.id}
              variant="ghost"
              confirmation={t('confirmer', { action: tp('gagnante', { equipe: e.nom }) })}
              onConfirm={() =>
                agir({ type: 'photo', action: { type: 'gagnante', equipe: e.numero } })
              }
            >
              {e.nom}
            </BoutonConfirme>
          ))}
          <BoutonConfirme
            variant="ghost"
            confirmation={t('confirmer', { action: tp('aucune') })}
            onConfirm={() => agir({ type: 'photo', action: { type: 'aucune' } })}
          >
            {tp('aucune')}
          </BoutonConfirme>
        </fieldset>
      )}

      {fini && (
        <p className="tu-regie-item__title" role="status">
          {gagnante ? tp('gagnante', { equipe: gagnante.nom }) : tp('sansGagnante')}
        </p>
      )}

      <div className="tu-regie-keys">
        {fini && suivant && (
          <Button
            variant="accent"
            className="tu-regie-keys__wide"
            onClick={() => agir({ type: 'suivant' })}
          >
            {tp('suivant')}
          </Button>
        )}
        {fini && (
          <Button
            variant={suivant ? 'ghost' : 'accent'}
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
