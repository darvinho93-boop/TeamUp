'use client';

import { useContext, type CSSProperties } from 'react';
import type { EtatSalle } from '@/lib/salle';
import { Karaoke } from '../Karaoke';
import { useMusiquesDuJeu } from '../useMusiquesDuJeu';
import { useParoles } from '../useParoles';
import { ThemeContexte } from './useThemeSoiree';

const AUCUNE_PAROLE: never[] = [];

/**
 * Le bonus d'une soirée à thème (2026-11-28) : la chanson choisie par les hôtes (réglage `bonus` du
 * thème), chantée par toute la salle quand la régie juge l'ambiance bonne. Le karaoké du Blind test,
 * sans équipe ni points, sur le décor du faire-part (`faire-part.css`). La chanson part de son début
 * à l'heure posée par la base (le son, `extraitA`) ; « Couper » l'efface en fondu.
 */
export function BonusFairePart({ etat, decalageMs }: { etat: EtatSalle; decalageMs: number }) {
  const charge = useContext(ThemeContexte);
  const id = charge?.theme.reglages.bonus?.musique ?? null;
  const ids = id ? [id] : [];
  const musique = useMusiquesDuJeu(ids).get(id ?? '');
  const paroles = useParoles(ids);
  const coupe = etat.pilotage.etape === 'couper';
  const style = charge
    ? ({
        '--tu-fp-grain': `url(${charge.url(charge.theme.fichiers.grain)})`,
        '--tu-fp-rinceau-image': `url(${charge.url(charge.theme.fichiers.rinceau)})`,
      } as CSSProperties)
    : undefined;
  // Le karaoké est lui-même le corps de la scène ; l'enveloppe (sans boîte) lui passe les couleurs
  // du thème et pose les rinceaux par-dessus son fond.
  return (
    <div className="tu-fp-bonus" data-scene="bonus" data-coupe={coupe || undefined} style={style}>
      <Karaoke
        titre={musique?.titre ?? null}
        artiste={musique?.artiste ?? null}
        equipe={undefined}
        points={0}
        fete={false}
        paroles={(id && paroles.get(id)) || AUCUNE_PAROLE}
        debutS={0}
        ecouteMs={0}
        chronoDepartMs={etat.pilotage.chrono_depart_ms}
        decalageMs={decalageMs}
      />
      <div className="tu-fp-rinceau tu-fp-rinceau--g" />
      <div className="tu-fp-rinceau tu-fp-rinceau--d" />
    </div>
  );
}
