'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@teamup/ui/react';
import { equipeParDefaut, pointsParEquipe } from '@/lib/cartes';
import type { Commande } from '@/lib/pilotage';
import type { EtatSalle } from '@/lib/salle';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';

type Points = { equipe_id: string; numero: number; points: number }[];

/**
 * Cartes « Faisons connaissance » (2026-11-18), au pilotage hors jeu : choisir le jeu (le
 * dernier terminé) et l'équipe à célébrer (celle qui y a le plus marqué), tirer une carte au sort
 * parmi celles de ses membres qui l'autorisent, la voir seul, puis l'afficher. « Autre carte »
 * retire au sort ; « Écarter » retire une carte des tirages (contenu à ne pas projeter).
 */
export function PanneauConnaissance({
  etat,
  agir,
  apresEcriture,
}: {
  etat: EtatSalle;
  agir: (commande: Commande) => void;
  apresEcriture: () => Promise<void>;
}) {
  const t = useTranslations('regie.connaissance');
  const tJeux = useTranslations('jeux');
  const terminees = useMemo(
    () => etat.programme.filter((m) => m.statut === 'terminee'),
    [etat.programme],
  );
  const [mancheId, setMancheId] = useState<string | null>(null);
  const manche = terminees.find((m) => m.id === mancheId) ?? terminees.at(-1) ?? null;
  const [points, setPoints] = useState<Points>([]);
  const [equipeId, setEquipeId] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState(false);

  // Les points de chaque équipe sur ce jeu, lus dans le journal des scores (RLS de la régie).
  const equipes = etat.equipes;
  useEffect(() => {
    if (!manche) return;
    let actif = true;
    void supabaseNavigateur()
      .from('scores')
      .select('equipe_id, points')
      .eq('manche_id', manche.id)
      .then(({ data }) => {
        if (actif) setPoints(pointsParEquipe(equipes, data ?? []));
      });
    return () => {
      actif = false;
    };
  }, [manche, equipes]);

  const parDefaut = equipeParDefaut(points);
  const equipe = equipeId ?? parDefaut?.equipeId ?? null;
  // Le tirage de ce jeu seulement : celui d'un jeu précédent ne s'affiche pas ici.
  const connaissance =
    etat.connaissance && manche && etat.connaissance.manche_id === manche.id
      ? etat.connaissance
      : null;
  const surScene = etat.pilotage.scene === 'connaissance';

  const tirer = async (ecarter?: string) => {
    if (!manche || !equipe) return;
    setOccupe(true);
    setErreur(false);
    try {
      const client = supabaseNavigateur();
      if (ecarter) {
        const { error } = await client.rpc('ecarter_carte', { p_joueur: ecarter });
        if (error) throw error;
      }
      const { error } = await client.rpc('tirer_carte', {
        p_evenement: etat.evenement.id,
        p_manche: manche.id,
        p_equipe: equipe,
      });
      if (error) throw error;
      await apresEcriture();
      // Déjà à l'écran : la nouvelle carte se présente aussitôt, animation comprise.
      if (surScene) agir({ type: 'connaissance' });
    } catch {
      setErreur(true);
    } finally {
      setOccupe(false);
    }
  };

  return (
    <section
      className="tu-regie__section"
      aria-label={t('titre')}
      data-testid="panneau-connaissance"
    >
      <h2 className="tu-regie__section-title">{t('titre')}</h2>
      <p className="tu-regie__muted">{t('aide')}</p>
      <p className="tu-regie__muted" data-testid="cartes-pretes">
        {t('pretes', { n: etat.cartes_pretes ?? 0, joueurs: etat.joueurs })}
      </p>

      {!manche ? (
        <p className="tu-regie__muted">{t('aucunJeu')}</p>
      ) : (
        <>
          <label className="tu-field">
            <span className="tu-field__label">{t('jeu')}</span>
            <select
              className="tu-field__control"
              value={manche.id}
              onChange={(e) => {
                setMancheId(e.target.value);
                setEquipeId(null);
              }}
              data-testid="connaissance-jeu"
            >
              {terminees.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.ordre}. {tJeux(m.jeu)}
                </option>
              ))}
            </select>
          </label>
          <label className="tu-field">
            <span className="tu-field__label">{t('equipe')}</span>
            <select
              className="tu-field__control"
              value={equipe ?? ''}
              onChange={(e) => setEquipeId(e.target.value)}
              data-testid="connaissance-equipe"
            >
              {points.map((p) => (
                <option key={p.equipe_id} value={p.equipe_id}>
                  {t('pointsEquipe', {
                    nom: equipes.find((eq) => eq.id === p.equipe_id)?.nom ?? '',
                    points: p.points,
                  })}
                </option>
              ))}
            </select>
          </label>
          {parDefaut?.egalite && !equipeId && <p className="tu-regie__muted">{t('egalite')}</p>}

          <div className="tu-cluster">
            <Button
              variant="outline"
              disabled={occupe || !equipe}
              onClick={() => void tirer()}
              data-testid="tirer-carte"
            >
              {connaissance ? t('autre') : t('tirer')}
            </Button>
          </div>
        </>
      )}

      {connaissance && (
        <div className="tu-regie-secret" data-testid="apercu-carte">
          <p className="tu-regie__muted">{t('apercu')}</p>
          <p className="tu-regie-item__title">{connaissance.equipe.nom}</p>
          {connaissance.carte ? (
            <>
              <p className="tu-regie-item__title">{connaissance.carte.prenom}</p>
              {(connaissance.carte.age !== null || connaissance.carte.metier) && (
                <p>
                  {[
                    connaissance.carte.age !== null
                      ? t('ans', { age: connaissance.carte.age })
                      : null,
                    connaissance.carte.metier,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              {connaissance.carte.anecdote && <p>« {connaissance.carte.anecdote} »</p>}
            </>
          ) : (
            <p className="tu-regie__muted">{t('aucune')}</p>
          )}
          <div className="tu-cluster">
            <Button
              variant="accent"
              disabled={occupe}
              onClick={() => agir({ type: 'connaissance' })}
              data-testid="afficher-carte"
            >
              {t('afficher')}
            </Button>
            {connaissance.carte && (
              <Button
                variant="ghost"
                disabled={occupe}
                onClick={() => void tirer(connaissance.carte?.joueur_id)}
                data-testid="ecarter-carte"
              >
                {t('ecarter')}
              </Button>
            )}
            {surScene && (
              <Button variant="ghost" onClick={() => agir({ type: 'scene', scene: 'programme' })}>
                {t('retour')}
              </Button>
            )}
          </div>
        </div>
      )}
      {erreur && (
        <p className="tu-player__error" role="alert">
          {t('erreur')}
        </p>
      )}
    </section>
  );
}
