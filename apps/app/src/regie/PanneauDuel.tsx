'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, cx, teamModifier } from '@teamup/ui/react';
import {
  aleaDepuis,
  chronoDuelS,
  passageSuivant,
  sequenceGobelet,
  tirerDuel,
  type BetaDuel,
  type Candidat,
  type Duelliste,
  type EtapeDuel,
} from '@teamup/game';
import { duellistesDe, type Commande } from '@/lib/pilotage';
import { passageCourant, type EtatSalle, type MancheSalle } from '@/lib/salle';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';
import { Chrono } from '@/ecran/Chrono';
import { BoutonConfirme } from './BoutonConfirme';

/**
 * Un duel en bêta (spec v3) : tirer deux duellistes d'équipes différentes, les présenter,
 * lancer le chrono, désigner le vainqueur (+50). Pour Tête, épaule, gobelet, la séquence à
 * annoncer s'affiche ici seulement : la salle ne doit pas la voir venir.
 */
export function PanneauDuel({
  etat,
  manche,
  decalageMs,
  agir,
}: {
  etat: EtatSalle;
  manche: MancheSalle & { jeu: BetaDuel };
  decalageMs: number;
  agir: (commande: Commande) => void;
}) {
  const t = useTranslations('regie.pilotage');
  const td = useTranslations('regie.pilotage.duel');
  const [tirage, setTirage] = useState<'idle' | 'enCours' | 'personne'>('idle');
  const passage = passageCourant(etat);
  const etape = etat.pilotage.etape as EtapeDuel;
  const duellistes = passage ? duellistesDe(passage.resultat) : null;
  // Une séquence par duel, tirée de l'identifiant du passage : stable d'un rendu à l'autre.
  const sequence = manche.jeu === 'cup' && passage ? sequenceGobelet(aleaDepuis(passage.id)) : [];
  if (!passage) return null;

  const numeroDe = new Map(etat.equipes.map((e) => [e.id, e.numero]));
  const nomDe = new Map(etat.equipes.map((e) => [e.numero, e.nom]));

  /** Tire parmi les joueurs inscrits, lus à l'instant : les retardataires comptent. */
  const tirer = async () => {
    setTirage('enCours');
    const { data } = await supabaseNavigateur()
      .from('joueurs')
      .select('id, prenom, equipe_id')
      .eq('evenement_id', etat.evenement.id);
    const prenomDe = new Map((data ?? []).map((j) => [j.id, j.prenom]));
    const candidats: Candidat[] = (data ?? []).flatMap((j) => {
      const equipe = numeroDe.get(j.equipe_id ?? '');
      return equipe ? [{ id: j.id, equipe }] : [];
    });
    // Tous les duels déjà joués de la soirée, les deux duels confondus : la rotation est globale.
    const dejaTires: Candidat[] = etat.programme
      .filter((m) => m.jeu === 'grab' || m.jeu === 'cup')
      .flatMap((m) => m.passages)
      .filter((x) => x.statut === 'termine')
      .flatMap((x) =>
        (duellistesDe(x.resultat) ?? []).map((d) => ({ id: d.joueur_id, equipe: d.equipe })),
      );
    const duel = tirerDuel(candidats, dejaTires, Math.random);
    if (!duel) {
      setTirage('personne');
      return;
    }
    setTirage('idle');
    const versDuelliste = (c: Candidat): Duelliste => ({
      joueur_id: c.id,
      prenom: prenomDe.get(c.id) ?? '',
      equipe: c.equipe,
    });
    agir({
      type: 'duel',
      action: { type: 'tirer', duellistes: [versDuelliste(duel[0]), versDuelliste(duel[1])] },
    });
  };

  const fini = etape === 'gagne';
  const suivant = passageSuivant(manche);
  const gagnant = passage.resultat['gagnant'];

  return (
    <section className="tu-regie__section" aria-label={td('titre')}>
      <p className="tu-regie__muted">
        {td('numero', { numero: passage.ordre, total: manche.passages.length })}
      </p>

      {duellistes ? (
        <div className="tu-cluster" data-testid="duellistes">
          {duellistes.map((d, i) => (
            <p
              key={d.joueur_id}
              className={cx('tu-team tu-team--badge tu-team--lg', teamModifier(d.equipe))}
            >
              {d.prenom} · {nomDe.get(d.equipe) ?? ''}
              {fini && gagnant === i && ` · ${td('vainqueur')}`}
            </p>
          ))}
        </div>
      ) : (
        <p className="tu-regie__muted">{td('aTirer')}</p>
      )}
      {tirage === 'personne' && (
        <p className="tu-regie__alert" role="alert">
          {td('personne')}
        </p>
      )}

      {manche.jeu === 'cup' && (etape === 'face_a_face' || etape === 'chrono') && (
        <div className="tu-regie-secret" data-testid="sequence">
          <p className="tu-regie__muted">{td('sequence')}</p>
          <p className="tu-regie-item__title">
            {sequence.map((mot) => td(`mots.${mot}`)).join(' · ')}
          </p>
        </div>
      )}

      <Chrono
        departMs={etat.pilotage.chrono_depart_ms}
        dureeS={chronoDuelS(manche.jeu)}
        decalageMs={decalageMs}
        className="tu-regie-timer"
        {...(etape === 'chrono' ? {} : { arret: 0 })}
      />

      <div className="tu-regie-keys">
        {etape === 'tirage' && (
          <>
            <Button
              variant={duellistes ? 'ghost' : 'primary'}
              disabled={tirage === 'enCours'}
              onClick={() => void tirer()}
            >
              {duellistes ? td('retirer') : td('tirer')}
            </Button>
            {duellistes && (
              <Button onClick={() => agir({ type: 'duel', action: { type: 'presenter' } })}>
                {td('presenter')}
              </Button>
            )}
          </>
        )}
        {etape === 'face_a_face' && (
          <Button
            className="tu-regie-keys__wide"
            onClick={() => agir({ type: 'duel', action: { type: 'lancer' } })}
          >
            {t('lancer')}
          </Button>
        )}
        {etape === 'chrono' &&
          duellistes?.map((d, i) => (
            <BoutonConfirme
              key={d.joueur_id}
              confirmation={t('confirmer', { action: td('gagne', { prenom: d.prenom }) })}
              onConfirm={() =>
                agir({ type: 'duel', action: { type: 'verdict', gagnant: i as 0 | 1 } })
              }
            >
              {td('gagne', { prenom: d.prenom })}
            </BoutonConfirme>
          ))}
        {fini && suivant && (
          <Button
            variant="accent"
            className="tu-regie-keys__wide"
            onClick={() => agir({ type: 'suivant' })}
          >
            {td('suivant')}
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
