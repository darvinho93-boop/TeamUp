'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { cx, teamModifier } from '@teamup/ui/react';
import { aleaDepuis, equipesRangees, tirerOrdre, type GameCode } from '@teamup/game';
import { equipeDe, type EquipeSalle, type EtatSalle, type MancheSalle } from '@/lib/salle';
import { useMaintenant } from './Chrono';

/** Le rythme du mélange : les équipes changent de place cinq fois par seconde. */
const PAS_MELANGE_MS = 200;

/** Les équipes d'une manche dans leur ordre de passage : celui du premier tour. */
export function ordreDesEquipes(etat: EtatSalle, manche: MancheSalle): EquipeSalle[] {
  const vues = new Set<string>();
  const ordre: EquipeSalle[] = [];
  for (const p of [...manche.passages].sort((a, b) => a.ordre - b.ordre)) {
    const equipe = equipeDe(etat, p.equipe_id);
    if (equipe && !vues.has(equipe.id)) {
      vues.add(equipe.id);
      ordre.push(equipe);
    }
  }
  return ordre;
}

const REQUETE_MOUVEMENT = '(prefers-reduced-motion: reduce)';

function suivreMouvement(rappel: () => void): () => void {
  const requete = window.matchMedia(REQUETE_MOUVEMENT);
  requete.addEventListener('change', rappel);
  return () => requete.removeEventListener('change', rappel);
}

/** `prefers-reduced-motion` du navigateur qui affiche l'écran ; non au rendu serveur. */
function useMouvementReduit(): boolean {
  return useSyncExternalStore(
    suivreMouvement,
    () => window.matchMedia(REQUETE_MOUVEMENT).matches,
    () => false,
  );
}

/**
 * Le tirage de l'ordre de passage, devant la salle (lot 13). L'ordre est déjà en base ; l'écran
 * le met en scène depuis le départ posé par la base : 3 s de mélange, puis les équipes se
 * rangent une à une. Le mélange se tire de l'instant, donc deux écrans montrent le même.
 */
export function TirageOrdre({
  jeu,
  mancheId,
  ordre,
  departMs,
  decalageMs,
}: {
  jeu: GameCode;
  mancheId: string;
  ordre: EquipeSalle[];
  departMs: number | null;
  decalageMs: number;
}) {
  const t = useTranslations();
  const reduit = useMouvementReduit();
  const ecoule = useMaintenant(true) + decalageMs - (departMs ?? 0);
  const rangees = reduit || departMs === null ? ordre.length : equipesRangees(ecoule, ordre.length);
  const restantes = ordre.slice(rangees);
  const melangees = tirerOrdre(
    restantes,
    aleaDepuis(`${mancheId}-${Math.floor(Math.max(0, ecoule) / PAS_MELANGE_MS)}`),
  );
  const affichees = [...ordre.slice(0, rangees), ...melangees];

  return (
    <div
      className="tu-stage__body tu-stage-centre"
      data-scene="tirage-ordre"
      data-rangees={rangees}
    >
      <p className="tu-stage__l tu-stage__muted">{t(`jeux.${jeu}`)}</p>
      <h1 className="tu-stage__xl">{t('ecran.ordre.titre')}</h1>
      <ol className="tu-stage-tirage" data-testid="ordre-tire">
        {affichees.map((equipe, i) => (
          <li
            key={equipe.id}
            className={cx('tu-stage-tirage__rang', i < rangees && 'tu-stage-tirage__rang--range')}
          >
            <span className="tu-stage-tirage__numero">{i < rangees ? i + 1 : '?'}</span>
            <span
              className={cx(
                'tu-team tu-team--badge tu-stage-badge--grand',
                teamModifier(equipe.numero),
              )}
            >
              {equipe.nom}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** L'ordre tiré, en une ligne, sous la règle de l'intro fixe. */
export function OrdreTire({ ordre }: { ordre: EquipeSalle[] }) {
  const t = useTranslations('ecran.ordre');
  return (
    <p className="tu-stage__m tu-stage__muted" data-testid="ordre-intro">
      {t('ligne', { ordre: ordre.map((e, i) => `${i + 1}. ${e.nom}`).join(' · ') })}
    </p>
  );
}
