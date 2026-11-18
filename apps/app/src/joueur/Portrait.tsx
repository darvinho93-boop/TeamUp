'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cx } from '@teamup/ui/react';
import { repereCarte } from '@teamup/game';
import type { EtatJoueur, PortraitJoueur, RefusPortrait } from '@/lib/partie';

/**
 * Portrait mystère au téléphone (2026-11-18). Les 25 cartes de la grille, repère et nom dans la
 * langue du joueur, pour les lire de près. En mode téléphones, pendant un tour de vote, le
 * capitaine touche la carte de son équipe : le vote part aussitôt et se change tant que le tour
 * est ouvert. La base décide de tout ; cet écran ne reçoit jamais la cible ni la carte noire.
 */
export function Portrait({
  code,
  portrait: p,
  remplacer,
  relire,
}: {
  code: string;
  portrait: PortraitJoueur;
  remplacer: (etat: EtatJoueur) => void;
  relire: () => void;
}) {
  const t = useTranslations('portrait');
  const [envoi, setEnvoi] = useState<number | null>(null);
  const [refus, setRefus] = useState<Exclude<RefusPortrait, 'session'> | null>(null);
  const haut = useRef<HTMLDivElement>(null);

  // La grille est longue : le capitaine vote souvent tout en bas. Quand le statut change (tour
  // ouvert, verdict, cible suivante), on remonte, sinon « Carte noire ! » restait hors de vue.
  const moment = `${p.cible}-${p.etape}-${p.tour}-${p.eliminee}-${p.trouvee}`;
  const momentVu = useRef(moment);
  useEffect(() => {
    if (momentVu.current === moment) return;
    momentVu.current = moment;
    const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    haut.current?.scrollIntoView({ block: 'start', behavior: calme ? 'auto' : 'smooth' });
  }, [moment]);

  async function voter(carte: number) {
    if (envoi !== null) return;
    setEnvoi(carte);
    setRefus(null);
    const reponse = await fetch(`/api/partie/${code}/portrait`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ carte }),
    }).catch(() => null);
    setEnvoi(null);
    if (reponse?.ok) {
      remplacer((await reponse.json()) as EtatJoueur);
      return;
    }
    const corps = (await reponse?.json().catch(() => null)) as { erreur?: RefusPortrait } | null;
    const cle = corps?.erreur;
    if (cle && cle !== 'session') setRefus(cle);
    relire();
  }

  if (p.equipe === null) return <p className="tu-quiz__statut">{t('sansEquipe')}</p>;

  const vote = p.vote !== null ? `${repereCarte(p.vote)} · ${p.cartes[p.vote]?.nom ?? ''}` : null;
  const statut = p.eliminee
    ? t('eliminee')
    : p.trouvee !== null
      ? t('trouvee', { tour: p.trouvee })
      : p.etape === 'pret'
        ? t('pret')
        : p.etape === 'vote'
          ? p.mode === 'voix'
            ? t('voix')
            : p.capitaine
              ? vote
                ? t('voteCapitaine', { carte: vote })
                : t('aVous')
              : vote
                ? t('voteEquipe', { carte: vote })
                : t('coequipier')
          : p.etape === 'tour'
            ? t('finDuTour')
            : p.etape === 'noire'
              ? t('noire')
              : t('revele');

  // Le titre reste court ; ce qu'il faut savoir en plus vient dessous, en plus petit.
  const aide = p.eliminee
    ? t('elimineeAide')
    : p.etape === 'vote' && p.mode === 'telephones' && p.capitaine && vote && p.trouvee === null
      ? t('voteAide')
      : null;

  return (
    <div ref={haut} className="tu-quiz" data-testid="portrait-joueur" data-etape={p.etape ?? ''}>
      {p.cible !== null && (
        <div className="tu-quiz__tete">
          <span className="tu-quiz__numero">
            {t('cible', { n: p.cible, total: p.cibles })}
            {p.tour > 0 && ` · ${t('tour', { n: p.tour })}`}
          </span>
        </div>
      )}
      <p
        className={cx(
          'tu-quiz__statut',
          (p.eliminee || p.trouvee !== null) && 'tu-quiz__statut--fort',
        )}
        role="status"
        data-testid="statut-portrait"
      >
        {statut}
      </p>
      {aide && <p className="tu-player__lead">{aide}</p>}
      {refus && (
        <p className="tu-player__error" role="alert">
          {t(`refus.${refus}`)}
        </p>
      )}
      <ol className="tu-portrait-cartes" aria-label={t('grille')}>
        {p.cartes.map((carte, position) => {
          const choisie = p.vote === position;
          const contenu = (
            <>
              <span className="tu-portrait-carte__repere">{repereCarte(position)}</span>
              <span className="tu-portrait-carte__nom">{carte.nom ?? '—'}</span>
            </>
          );
          return (
            <li key={position}>
              {p.peut_voter && !carte.retournee ? (
                <button
                  type="button"
                  className={cx('tu-portrait-carte', choisie && 'tu-portrait-carte--choisie')}
                  aria-pressed={choisie}
                  disabled={envoi !== null}
                  onClick={() => void voter(position)}
                  data-testid={`carte-${position}`}
                >
                  {contenu}
                </button>
              ) : (
                <span
                  className={cx(
                    'tu-portrait-carte',
                    'tu-portrait-carte--lecture',
                    choisie && 'tu-portrait-carte--choisie',
                    carte.retournee && 'tu-portrait-carte--retournee',
                  )}
                >
                  {contenu}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
