import { cx } from '@teamup/ui/react';
import type { Langue } from '@/lib/partie';
import { typographie } from '@/lib/typographie';

/**
 * Un contenu dans toutes les langues de la soirée : la première en grand, les autres dessous
 * (décision du 2026-09-23). Chaque ligne porte sa langue, pour la bonne police et la lecture.
 */
export function Multilingue({
  textes,
  className,
  testId,
}: {
  textes: { langue: Langue; texte: string }[];
  className?: string;
  testId?: string;
}) {
  // Une traduction identique (un nom propre, « E = mc² ») ne se répète pas.
  const uniques = textes.filter((t, i) => textes.findIndex((x) => x.texte === t.texte) === i);
  if (uniques.length === 0) return null;
  const [premier, ...autres] = uniques;
  return (
    <div className={cx('tu-stage-multi', className)} data-testid={testId}>
      <p lang={premier!.langue} className="tu-stage-multi__premier">
        {typographie(premier!.texte, premier!.langue)}
      </p>
      {autres.map(({ langue, texte }) => (
        <p key={langue} lang={langue} className="tu-stage-multi__autre">
          {typographie(texte, langue)}
        </p>
      ))}
    </div>
  );
}
