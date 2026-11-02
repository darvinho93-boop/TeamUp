import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cx, teamModifier } from '@teamup/ui/react';
import { Fleche } from './decor';

/** Les quatre temps de la soirée, aux couleurs des équipes 1, 3, 4 et 6 (jamais le corail). */
const ETAPES = [
  { cle: 'etape1', equipe: 1 },
  { cle: 'etape2', equipe: 3 },
  { cle: 'etape3', equipe: 4 },
  { cle: 'etape4', equipe: 6 },
] as const;

/**
 * L'onglet « Comment on y joue » de la carte Team Up! (`/soirees/comment-jouer`) : la soirée en
 * quatre temps, de l'inscription au podium. `inscription` : où mène « Je m'inscris »
 * (`cibleInscription`), rien quand aucune soirée n'est ouverte.
 */
export function CommentJouer({ inscription }: { inscription: string | null }) {
  const t = useTranslations('carte');

  return (
    <div className="tu-player__body tu-carte" data-testid="comment-jouer">
      <section className="tu-carte-section" aria-labelledby="titre-comment">
        <h1 className="tu-carte-section__titre tu-carte-section__titre--page" id="titre-comment">
          {t('commentTitre')}
        </h1>
        <ol className="tu-carte-etapes">
          {ETAPES.map(({ cle, equipe }, i) => (
            <li key={cle} className="tu-carte-etape">
              <span className={cx('tu-carte-etape__num', teamModifier(equipe))} aria-hidden="true">
                {i + 1}
              </span>
              <p className="tu-carte-etape__texte">{t(cle)}</p>
            </li>
          ))}
        </ol>
      </section>

      {inscription && (
        <Link className="tu-btn tu-btn--accent tu-btn--lg tu-btn--block" href={inscription}>
          {t('inscrire')}
          <Fleche />
        </Link>
      )}
    </div>
  );
}
