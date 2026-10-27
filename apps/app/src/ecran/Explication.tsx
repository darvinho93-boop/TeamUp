'use client';

import { useLayoutEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { carteA, SCRIPTS_EXPLICATION, type GameCode, type ScriptExplication } from '@teamup/game';
import { MESSAGES } from '@/i18n/messages';
import type { Langue } from '@/lib/partie';
import { useMaintenant, useMonte } from './Chrono';
import { VisuelCarte } from './explications/Visuels';
import { Multilingue } from './Multilingue';

const ECHELLE_MAX = 1.4;
const ECHELLE_MIN = 0.8;

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
  // Au premier rendu, le début de la première carte : l'heure du serveur n'est pas celle de
  // l'écran (erreur d'hydratation). La bonne carte suit aussitôt.
  const monte = useMonte();
  const ecoule = departMs === null || !monte ? 0 : maintenant + decalageMs - departMs;
  const { index, progression } = carteA(script, ecoule);
  const cartes = SCRIPTS_EXPLICATION[script];
  const carte = cartes[index]!;

  // Le décor et la phrase prennent la place de la scène (inventaire du 2026-10-24 : ils en
  // occupaient un tiers) : on part de 1,4 et on réduit par dixièmes jusqu'à ce que les deux
  // tiennent dans la carte. On compare des hauteurs : l'entrée de la carte ne fait que la
  // déplacer, elle ne change pas leur taille.
  const carteRef = useRef<HTMLDivElement>(null);
  const cle = `${script}:${index}:${langues.join()}`;
  useLayoutEffect(() => {
    const bloc = carteRef.current;
    if (!bloc) return;
    const ajuster = () => {
      const [visuel, texte] = [...bloc.children] as HTMLElement[];
      if (!visuel || !texte) return;
      const ecart = parseFloat(getComputedStyle(bloc).rowGap) || 0;
      let echelle = ECHELLE_MAX;
      bloc.style.setProperty('--tu-expl-echelle', String(echelle));
      const hauteur = (e: HTMLElement) => e.getBoundingClientRect().height;
      // Les hauteurs sont mesurées à l'échelle de l'écran : on rapporte tout à la carte.
      while (
        hauteur(visuel) + hauteur(texte) + ecart * (hauteur(bloc) / bloc.offsetHeight) >
          hauteur(bloc) &&
        echelle > ECHELLE_MIN
      ) {
        echelle = Math.round((echelle - 0.1) * 10) / 10;
        bloc.style.setProperty('--tu-expl-echelle', String(echelle));
      }
    };
    ajuster();
    let actif = true;
    void document.fonts?.ready.then(() => {
      if (actif) ajuster();
    });
    const observateur = new ResizeObserver(ajuster);
    observateur.observe(bloc);
    return () => {
      actif = false;
      observateur.disconnect();
    };
  }, [cle]);

  return (
    <div className="tu-stage__body tu-expl" data-scene="explication" data-carte={index + 1}>
      <p className="tu-stage-regle tu-stage-regle__titre tu-expl__titre">
        {t(`jeux.${jeu}`)} · {t('ecran.commentJouer')}
      </p>
      {/* La clé remonte la carte à chaque changement : ses animations repartent de zéro. */}
      <div ref={carteRef} key={`${script}-${index}`} className="tu-expl__carte">
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
