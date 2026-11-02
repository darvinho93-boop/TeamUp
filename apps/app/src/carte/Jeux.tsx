import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ListeIllustree, type Teinte } from './ListeIllustree';

type Jeu = 'list2' | 'qcm2' | 'enchere2' | 'mime2' | 'photo2';

/**
 * Les cinq jeux, chacun avec le pictogramme et la teinte de la page Les jeux de la vitrine
 * (`apps/site/src/data/jeux.ts`, `Icon.astro`) : on les reconnaît d'un site à l'autre.
 */
const JEUX: { jeu: Jeu; teinte: Teinte; trace: ReactNode }[] = [
  {
    jeu: 'list2',
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
  {
    jeu: 'qcm2',
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
  {
    jeu: 'enchere2',
    teinte: 'ambre',
    trace: (
      <>
        <path d="M7 11v-4a2 2 0 0 1 4 0v4" />
        <path d="M11 10V5a2 2 0 0 1 4 0v6" />
        <path d="M15 10a2 2 0 0 1 4 0v4a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.5L3 14a2 2 0 0 1 3.4-2l.6 1" />
      </>
    ),
  },
  {
    jeu: 'mime2',
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
  {
    jeu: 'photo2',
    teinte: 'pierre',
    trace: (
      <>
        <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
        <circle cx="12" cy="13" r="3.5" />
      </>
    ),
  },
];

/**
 * L'onglet « Les jeux » de la carte Team Up! (`/soirees/jeux`) : la règle de chacun des cinq
 * jeux, en une phrase (celle de l'écran commun). « Je m'inscris » n'est que sur l'onglet de
 * l'événement du jour.
 */
export function Jeux() {
  const t = useTranslations();

  return (
    <div className="tu-player__body tu-carte" data-testid="jeux">
      <section className="tu-carte-section" aria-labelledby="titre-jeux">
        <h1 className="tu-carte-section__titre tu-carte-section__titre--page" id="titre-jeux">
          {t('carte.jeuxTitre')}
        </h1>
        <ListeIllustree
          elements={JEUX.map(({ jeu, teinte, trace }) => ({
            id: jeu,
            teinte,
            trace,
            nom: t(`jeux.${jeu}`),
            texte: t(`ecran.regles.${jeu}`),
          }))}
        />
      </section>
    </div>
  );
}
