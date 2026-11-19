'use client';

import { useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cx, teamModifier } from '@teamup/ui/react';
import type { EquipeSalle } from '@/lib/salle';
import { Celebration, type Force } from './Celebration';
import { useAjusterTexte } from './useAjusterTexte';
import { useCompteur } from './useCompteur';

/** Les points partent quand le titre a fini d'entrer (`--tu-dur-verdict`). */
const DELAI_POINTS_MS = 500;

/**
 * Le verdict commun des jeux (2026-11-19, audit « jeu télé »), sur le modèle du Mime et du buzz
 * du Blind test : la scène entière en vert (trouvé, pari tenu), en rouge (raté) ou à la couleur
 * de l'équipe (un duel gagné) ; l'équipe, le verdict en très grand, un détail (le mot, le sujet,
 * le palier), puis les points qui défilent.
 *
 * `enDirect` : l'écran a vu l'état arriver (`useArrivee`). Alors seulement la fête, l'entrée du
 * titre et le défilement des points ; au rechargement ou dans un second écran ouvert après coup,
 * tout est posé d'emblée.
 */
export function Verdict({
  scene,
  etape,
  ton,
  equipe,
  titre,
  detail,
  points,
  textePoints,
  fete,
  enDirect,
  testId = 'verdict',
  testIdPoints,
}: {
  /** `data-scene` et `data-etape` : la scène que les e2e attendent. */
  scene: string;
  etape: string;
  ton: 'vert' | 'rouge' | 'equipe';
  equipe: EquipeSalle | null;
  titre: string;
  detail?: ReactNode | undefined;
  /** Les points gagnés ; `null` : pas de ligne de points. */
  points: number | null;
  /** Une autre façon de dire les points (« +20 points pour chaque autre équipe »). */
  textePoints?: ((n: number) => string) | undefined;
  fete: Force | null;
  enDirect: boolean;
  testId?: string;
  testIdPoints?: string;
}) {
  const t = useTranslations('ecran');
  const n = useCompteur(points ?? 0, { actif: enDirect, delaiMs: DELAI_POINTS_MS });
  // En taille plateau, tout le verdict se réduit ensemble jusqu'à tenir (2026-11-19).
  const ref = useRef<HTMLDivElement>(null);
  useAjusterTexte(ref, `${scene}:${etape}:${titre}`, '--tu-verdict-echelle');
  return (
    <div
      ref={ref}
      className={cx(
        'tu-stage__body tu-stage-centre tu-stage-verdict tu-verdict',
        `tu-stage-verdict--${ton}`,
        equipe && teamModifier(equipe.numero),
      )}
      data-scene={scene}
      data-etape={etape}
      data-ton={ton}
      data-en-direct={enDirect || undefined}
    >
      {equipe &&
        (ton === 'equipe' ? (
          // Sur la couleur de l'équipe, une pastille de la même couleur ne se verrait pas.
          <p className="tu-verdict__equipe">{equipe.nom}</p>
        ) : (
          <span
            className={cx(
              'tu-team tu-team--badge tu-stage-badge--grand',
              teamModifier(equipe.numero),
            )}
          >
            {equipe.nom}
          </span>
        ))}
      <p className="tu-verdict__titre" data-testid={testId}>
        {titre}
      </p>
      {detail}
      {points !== null && (
        <p className="tu-verdict__points" data-testid={testIdPoints}>
          {textePoints ? textePoints(n) : t('points', { points: n })}
        </p>
      )}
      {enDirect && fete && <Celebration force={fete} />}
    </div>
  );
}
