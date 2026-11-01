'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@teamup/ui/react';
import { memoriserLangue } from '@/lib/langue-navigateur';
import { estLangue, LANGUES, type Langue, type SoireeDuJour } from '@/lib/partie';
import { Cadre } from '@/joueur/Cadre';
import { ChoixLangueJoueur } from '@/joueur/ChoixLangueJoueur';

/**
 * Page de la carte Team Up! : ce qu'est Team Up!, les soirées du jour et leurs jeux, comment
 * s'inscrire. Un appui sur « Je m'inscris » mène à l'arrivée habituelle de la soirée, la langue
 * déjà choisie ici (`?carte=1`).
 */
export function Soirees({ soirees, langue }: { soirees: SoireeDuJour[]; langue: string }) {
  const t = useTranslations();
  const router = useRouter();
  const choisir = (choisie: Langue) => {
    memoriserLangue(choisie);
    router.refresh();
  };
  const courante = estLangue(langue) ? langue : 'fr';

  return (
    <Cadre outil={<ChoixLangueJoueur langues={[...LANGUES]} choisir={choisir} />}>
      <div className="tu-player__body" data-testid="soirees">
        <h1 className="tu-player__title">{t('carte.bienvenue')}</h1>
        <p className="tu-player__lead">{t('carte.presentation')}</p>

        <h2 className="tu-player__subtitle">{t('carte.aujourdhui')}</h2>
        {soirees.length === 0 ? (
          <div className="tu-carte-vide" data-testid="soirees-vide">
            <p className="tu-carte-vide__titre">{t('carte.videTitre')}</p>
            <p className="tu-player__lead">{t('carte.videAide')}</p>
            <div className="tu-player__actions">
              <Link className="tu-btn tu-btn--outline tu-btn--lg tu-btn--block" href="/">
                {t('carte.code')}
              </Link>
              <Button variant="ghost" size="lg" block onClick={() => router.refresh()}>
                {t('carte.actualiser')}
              </Button>
            </div>
          </div>
        ) : (
          <ul className="tu-carte-liste">
            {soirees.map((s) => {
              const jeux = [...new Set(s.programme)];
              // La langue choisie ici sert à l'arrivée si la soirée la propose.
              const lien = s.langues.includes(courante) ? `/${s.code}?carte=1` : `/${s.code}`;
              return (
                <li key={s.code} className="tu-carte-soiree" data-testid="soiree">
                  <h3 className="tu-carte-soiree__titre">{s.titre}</h3>
                  {jeux.length > 0 && (
                    <>
                      <p className="tu-carte-soiree__surtitre">{t('carte.auProgramme')}</p>
                      <ul className="tu-player__list">
                        {jeux.map((jeu) => (
                          <li key={jeu}>
                            <strong>{t(`jeux.${jeu}`)}</strong> — {t(`ecran.regles.${jeu}`)}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <Link className="tu-btn tu-btn--accent tu-btn--lg tu-btn--block" href={lien}>
                    {t('carte.inscrire')}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <h2 className="tu-player__subtitle">{t('carte.commentTitre')}</h2>
        <ol className="tu-player__list tu-carte-etapes">
          <li>{t('carte.etape1')}</li>
          <li>{t('carte.etape2')}</li>
          <li>{t('carte.etape3')}</li>
        </ol>
        <p className="tu-player__lead">{t('carte.telephone')}</p>
        <p className="tu-carte-appel">{t('carte.appel')}</p>
      </div>
    </Cadre>
  );
}
