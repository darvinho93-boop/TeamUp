'use client';

import { useTranslations } from 'next-intl';
import { carteA, SCRIPTS_EXPLICATION, type GameCode, type ScriptExplication } from '@teamup/game';
import { MESSAGES } from '@/i18n/messages';
import type { Langue } from '@/lib/partie';
import { useMaintenant } from './Chrono';
import { VisuelCarte } from './explications/Visuels';
import { Multilingue } from './Multilingue';

/** La phrase d'une carte, dans une langue. */
function phrase(langue: Langue, script: ScriptExplication, cle: string): string {
  const cartes = MESSAGES[langue].ecran.explications[script] as Record<string, string>;
  return cartes[cle] ?? '';
}

/**
 * Explication animée d'un jeu (lot 12). La carte se déduit du départ posé par la base :
 * un second écran, ou celui-ci rechargé, retombe sur la même. Au bout du script, la
 * dernière carte reste affichée jusqu'à ce que la régie passe à la suite.
 */
export function Explication({
  jeu,
  script,
  langues,
  departMs,
  decalageMs,
}: {
  jeu: GameCode;
  script: ScriptExplication;
  langues: Langue[];
  departMs: number | null;
  decalageMs: number;
}) {
  const t = useTranslations();
  const maintenant = useMaintenant(true);
  const ecoule = departMs === null ? 0 : maintenant + decalageMs - departMs;
  const { index, progression } = carteA(script, ecoule);
  const cartes = SCRIPTS_EXPLICATION[script];
  const carte = cartes[index]!;

  return (
    <div className="tu-stage__body tu-expl" data-scene="explication" data-carte={index + 1}>
      <p className="tu-expl__titre">
        {t(`jeux.${jeu}`)} · {t('ecran.commentJouer')}
      </p>
      {/* La clé remonte la carte à chaque changement : ses animations repartent de zéro. */}
      <div key={`${script}-${index}`} className="tu-expl__carte">
        <VisuelCarte visuel={carte.visuel} />
        <Multilingue
          className="tu-expl__phrase"
          testId="phrase-explication"
          textes={langues.map((langue) => ({ langue, texte: phrase(langue, script, carte.cle) }))}
        />
      </div>
      <ol className="tu-expl__progression" aria-hidden="true">
        {cartes.map((c, i) => (
          <li key={c.cle} className="tu-expl__segment">
            <span
              className="tu-expl__segment-plein"
              style={{ transform: `scaleX(${i < index ? 1 : i === index ? progression : 0})` }}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
