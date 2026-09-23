'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button, cx, teamModifier } from '@teamup/ui/react';
import {
  actionsPointsCommuns,
  actionsSurenchere,
  CHRONO_POINTS_COMMUNS_S,
  CHRONO_SURENCHERE_DEFAUT_S,
  passageSuivant,
  type ActionPointsCommuns,
  type EtapePointsCommuns,
  type EtapeSurenchere,
} from '@teamup/game';
import { calculerEtape, type Commande } from '@/lib/pilotage';
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
    });
    if (!ecriture) {
      setAlerte(t('erreur.impossible'));
      return;
    }
    demarrer(async () => {
      const supabase = supabaseNavigateur();
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
              {m.statut !== 'terminee' &&
                m.statut !== 'annulee' &&
                (m.jeu === 'list2' || m.jeu === 'enchere2') && (
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
        {scene === 'intro' && manche && (
          <Button
            variant="accent"
            size="lg"
            className="tu-regie-keys__wide"
            onClick={() => agir({ type: 'commencer' })}
          >
            {t('commencer', { jeu: tJeux(manche.jeu) })}
          </Button>
        )}
        {scene === 'jeu' && manche?.jeu === 'list2' && (
          <PanneauPointsCommuns etat={etat} manche={manche} decalageMs={decalageMs} agir={agir} />
        )}
        {scene === 'jeu' && manche?.jeu === 'enchere2' && (
          <PanneauSurenchere etat={etat} manche={manche} decalageMs={decalageMs} agir={agir} />
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
