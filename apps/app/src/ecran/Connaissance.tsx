'use client';

import { useContext, useEffect, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { cx, teamModifier } from '@teamup/ui/react';
import { CONNAISSANCE_CARTE_MS } from '@/lib/cartes';
import type { ConnaissanceSalle, EtatSalle } from '@/lib/salle';
import { Celebration } from './Celebration';
import { useMonte } from './Chrono';
import { useMouvementReduit } from './TirageOrdre';
import { SonsContexte } from './sons/useSons';

/**
 * Cartes « Faisons connaissance » (2026-11-18) : le grand écran célèbre d'abord l'équipe et ses
 * points sur le jeu, puis la carte d'un de ses membres, tirée au sort par la régie, se retourne ;
 * dessous, le reste de l'équipe. Les délais se comptent depuis le départ posé par la base : un
 * second écran ou un rechargement retombe au même endroit (passé le délai, tout est là). Sans
 * carte autorisée, seule l'équipe est célébrée. Sous `prefers-reduced-motion`, rien ne bouge.
 */
export function Connaissance({ etat, decalageMs }: { etat: EtatSalle; decalageMs: number }) {
  const c = etat.connaissance;
  if (!c) return <div className="tu-stage__body" data-scene="connaissance" />;
  const depart = etat.pilotage.chrono_depart_ms;
  // Un nouveau tirage ou un nouveau départ remonte la scène : ses animations repartent.
  return (
    <Presentation
      key={`${c.tirage_id}:${depart ?? ''}`}
      c={c}
      departMs={depart}
      decalageMs={decalageMs}
    />
  );
}

function Presentation({
  c,
  departMs,
  decalageMs,
}: {
  c: ConnaissanceSalle;
  departMs: number | null;
  decalageMs: number;
}) {
  const t = useTranslations();
  const monte = useMonte();
  const reduit = useMouvementReduit();
  const jouer = useContext(SonsContexte);
  // Le temps écoulé depuis le départ, pris au montage (heure de la base corrigée).
  const [ecouleMs] = useState(() =>
    departMs === null ? Number.POSITIVE_INFINITY : Date.now() + decalageMs - departMs,
  );
  const anime = monte && !reduit && ecouleMs < CONNAISSANCE_CARTE_MS;
  const delaiCarteMs = Math.max(0, CONNAISSANCE_CARTE_MS - ecouleMs);

  // La carte se retourne sur la révélation ; la célébration de l'équipe sonne avec le départ
  // (`sonsPour`).
  useEffect(() => {
    if (anime && c.carte && jouer) jouer('revelation', delaiCarteMs);
    // Une seule fois par présentation : la clé du composant change à chaque tirage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anime]);

  const { equipe, carte } = c;
  const ligne = carte
    ? [carte.age !== null ? t('ecran.connaissance.ans', { age: carte.age }) : null, carte.metier]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <div
      className="tu-stage__body tu-stage-connaissance"
      data-scene="connaissance"
      data-anime={anime ? 'oui' : undefined}
      style={{ '--tu-connaissance-delai': `${delaiCarteMs}ms` } as CSSProperties}
    >
      {anime && <Celebration force={2} />}
      <header className={cx('tu-stage-connaissance__equipe', teamModifier(equipe.numero))}>
        <p className="tu-stage-connaissance__bravo" data-testid="connaissance-bravo">
          {t('ecran.connaissance.bravo', { nom: equipe.nom })}
        </p>
        {c.jeu && (
          <p className="tu-stage-connaissance__points">
            {t('ecran.connaissance.points', { points: c.points, jeu: t(`jeux.${c.jeu}`) })}
          </p>
        )}
      </header>

      {carte && (
        <article className="tu-stage-connaissance__carte" data-testid="connaissance-carte">
          <p className="tu-stage-connaissance__faisons">
            {t('ecran.connaissance.faisons', { prenom: carte.prenom })}
          </p>
          {ligne && <p className="tu-stage-connaissance__ligne">{ligne}</p>}
          {carte.anecdote && (
            <p className="tu-stage-connaissance__anecdote">« {carte.anecdote} »</p>
          )}
        </article>
      )}

      {c.membres.length > 0 && (
        <div className="tu-stage-connaissance__membres">
          <p className="tu-stage-connaissance__suite">{t('ecran.connaissance.equipe')}</p>
          <ul className="tu-stage-connaissance__liste" data-testid="connaissance-membres">
            {c.membres.map((membre) => (
              <li key={membre.prenom} className="tu-stage-connaissance__membre">
                {membre.prenom}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
