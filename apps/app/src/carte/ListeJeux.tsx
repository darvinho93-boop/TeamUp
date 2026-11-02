'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { dureeExplicationS, scriptExplication, type GameCode } from '@teamup/game';
import { ListeIllustree, type Teinte } from './ListeIllustree';
import { VideoJeu } from './VideoJeu';

/**
 * Le pictogramme et la teinte de chaque jeu, ceux de la page Les jeux de la vitrine
 * (`apps/site/src/data/jeux.ts`, `Icon.astro`) : on les reconnaît d'un site à l'autre. Les deux
 * duels, que la vitrine n'illustre pas, ont le leur : le gobelet, et l'éclair de la course à l'objet.
 */
const PICTOS: Record<GameCode, { teinte: Teinte; trace: ReactNode }> = {
  list2: {
    teinte: 'navy',
    trace: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <path d="M15 14.5c3 0 6 1.8 6 5.5" />
      </>
    ),
  },
  qcm2: {
    teinte: 'sage',
    trace: (
      <>
        <path d="M12 3v18" />
        <path d="M3 12h18" />
        <path d="M6.5 6.5h.01" />
        <path d="M17.5 6.5h.01" />
        <path d="M6.5 17.5h.01" />
        <path d="M17.5 17.5h.01" />
      </>
    ),
  },
  enchere2: {
    teinte: 'ambre',
    trace: (
      <>
        <path d="M7 11v-4a2 2 0 0 1 4 0v4" />
        <path d="M11 10V5a2 2 0 0 1 4 0v6" />
        <path d="M15 10a2 2 0 0 1 4 0v4a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.5L3 14a2 2 0 0 1 3.4-2l.6 1" />
      </>
    ),
  },
  mime2: {
    teinte: 'menthe',
    trace: (
      <>
        <circle cx="12" cy="5" r="2.5" />
        <path d="M12 8v6" />
        <path d="M6 10l6-1 6-3" />
        <path d="M9 21l3-7 3 7" />
      </>
    ),
  },
  photo2: {
    teinte: 'pierre',
    trace: (
      <>
        <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
        <circle cx="12" cy="13" r="3.5" />
      </>
    ),
  },
  cup: {
    teinte: 'pierre',
    trace: (
      <>
        <path d="M5.5 4h13l-1.8 16H7.3z" />
        <path d="M6.4 9h11.2" />
      </>
    ),
  },
  grab: {
    teinte: 'pierre',
    trace: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  },
};

/**
 * Des jeux, chacun avec son pictogramme, sa règle en une phrase (celle de l'écran commun) et sa
 * vidéo explicative (`VideoJeu`) d'un appui sur la carte. Les cinq sur l'onglet Les jeux de la
 * carte Team Up!, ceux de la soirée à l'inscription (`Explication`) : la même présentation, que
 * l'invité arrive par la carte ou par le QR code de l'écran.
 */
export function ListeJeux({
  jeux,
  niveau = 'h2',
}: {
  jeux: readonly GameCode[];
  /** Le niveau du nom de chaque jeu : h3 sous un intertitre. */
  niveau?: 'h2' | 'h3';
}) {
  const t = useTranslations();
  const [video, setVideo] = useState<GameCode | null>(null);

  return (
    <>
      <ListeIllustree
        niveau={niveau}
        elements={jeux.map((jeu) => ({
          id: jeu,
          ...PICTOS[jeu],
          nom: t(`jeux.${jeu}`),
          texte: t(`ecran.regles.${jeu}`),
          action: {
            libelle: t('carte.voirVideo'),
            detail: t('carte.duree', { s: dureeExplicationS(scriptExplication(jeu)) }),
            surClic: () => setVideo(jeu),
          },
        }))}
      />
      <VideoJeu jeu={video} fermer={() => setVideo(null)} />
    </>
  );
}
