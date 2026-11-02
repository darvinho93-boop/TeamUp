'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, cx, Wordmark } from '@teamup/ui/react';
import { estLangue, type SoireeDuJour } from '@/lib/partie';
import { Fleche, Personnages, PERSOS_ATTENTE } from './decor';
import { lienInscription } from './liens';
import { ListeIllustree, type Teinte } from './ListeIllustree';

/**
 * Confettis de l'accroche, comme sur la carte imprimée : posés autour du titre, jamais dessus
 * (x, y : parts de la largeur et de la hauteur de l'accroche ; r : tour). Couleurs d'équipe par
 * rang (`player.css`), jamais le corail.
 */
const CONFETTIS: { x: number; y: number; r: number; point?: boolean }[] = [
  { x: 0.03, y: 0.04, r: 0.07 },
  { x: 0.12, y: 0.01, r: -0.1 },
  { x: 0.22, y: 0.13, r: 0, point: true },
  { x: 0.09, y: 0.19, r: 0.15 },
  { x: 0.8, y: 0.02, r: 0.12 },
  { x: 0.93, y: 0.09, r: -0.08 },
  { x: 0.66, y: 0, r: 0, point: true },
  { x: 0.965, y: 0.27, r: 0, point: true },
  { x: 0.005, y: 0.38, r: -0.12 },
  { x: 0.965, y: 0.43, r: 0.1 },
  { x: 0.02, y: 0.6, r: 0, point: true },
  { x: 0.97, y: 0.6, r: 0.18 },
];

/** Ce qui attend l'invité : les équipes mélangées, le grand écran, le podium. */
const ATOUTS: {
  titre: `atout${1 | 2 | 3}Titre`;
  texte: `atout${1 | 2 | 3}Texte`;
  teinte: Teinte;
  trace: ReactNode;
}[] = [
  {
    titre: 'atout1Titre',
    texte: 'atout1Texte',
    teinte: 'navy',
    // Mélanger : deux flèches qui se croisent.
    trace: <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />,
  },
  {
    titre: 'atout2Titre',
    texte: 'atout2Texte',
    teinte: 'sage',
    trace: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </>
    ),
  },
  {
    titre: 'atout3Titre',
    texte: 'atout3Texte',
    teinte: 'ambre',
    trace: (
      <>
        <path d="M8 21h8M12 17v4" />
        <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
        <path d="M17 5h2a2 2 0 0 1 0 4h-2M7 5H5a2 2 0 0 0 0 4h2" />
      </>
    ),
  },
];

/**
 * Page de la carte Team Up! (`/soirees`), là où mène le QR code des cartes imprimées : l'accroche
 * de la carte, puis les soirées du jour, chacune avec le seul bouton « Je m'inscris » de la carte,
 * puis ce qui attend l'invité. Les règles sont sur l'onglet des jeux (`Jeux.tsx`). « Je m'inscris »
 * mène à l'arrivée habituelle de la soirée, la langue déjà choisie ici (`?carte=1`).
 */
export function Soirees({ soirees, langue }: { soirees: SoireeDuJour[]; langue: string }) {
  const t = useTranslations('carte');
  const router = useRouter();
  const courante = estLangue(langue) ? langue : 'fr';

  return (
    <div className="tu-player__body tu-carte" data-testid="soirees">
      <section className="tu-carte-accroche">
        <div className="tu-carte-confettis" aria-hidden="true">
          {CONFETTIS.map((c, i) => (
            <span
              key={i}
              className={cx('tu-carte-confetti', c.point && 'tu-carte-confetti--point')}
              style={{ '--x': c.x, '--y': c.y, '--r': c.r, '--i': i } as CSSProperties}
            />
          ))}
        </div>
        <h1 className="tu-carte-accroche__titre">
          {t.rich('accroche', { nom: () => <Wordmark className="tu-carte-accroche__nom" /> })}
        </h1>
        <p className="tu-carte-accroche__slogan">{t('slogan')}</p>
      </section>

      {/* L'onglet dit déjà « L'événement du jour » : pas d'intertitre, la carte suffit. */}
      <div className="tu-carte-section">
        {soirees.length === 0 ? (
          <div className="tu-carte-vide" data-testid="soirees-vide">
            <div className="tu-carte-vide__persos" aria-hidden="true">
              <Personnages persos={PERSOS_ATTENTE} />
            </div>
            <p className="tu-carte-vide__titre">{t('videTitre')}</p>
            <p className="tu-carte-vide__aide">{t('videAide')}</p>
            <div className="tu-carte-vide__actions">
              <Link className="tu-btn tu-btn--outline tu-btn--lg tu-btn--block" href="/">
                {t('code')}
              </Link>
              <Button variant="ghost" size="lg" block onClick={() => router.refresh()}>
                {t('actualiser')}
              </Button>
            </div>
          </div>
        ) : (
          <ul className="tu-carte-liste">
            {soirees.map((s) => (
              <li key={s.code} className="tu-carte-soiree" data-testid="soiree">
                <h2 className="tu-carte-soiree__titre">{s.titre}</h2>
                <Link
                  className="tu-btn tu-btn--accent tu-btn--lg tu-btn--block"
                  href={lienInscription(s, courante)}
                >
                  {t('inscrire')}
                  <Fleche />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="tu-carte-section" aria-labelledby="titre-attend">
        <h2 className="tu-carte-section__titre" id="titre-attend">
          {t('attendTitre')}
        </h2>
        <ListeIllustree
          niveau="h3"
          elements={ATOUTS.map((a) => ({
            id: a.titre,
            teinte: a.teinte,
            trace: a.trace,
            nom: t(a.titre),
            texte: t(a.texte),
          }))}
        />
      </section>
    </div>
  );
}
