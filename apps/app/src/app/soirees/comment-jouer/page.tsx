import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CadreCarte } from '@/carte/CadreCarte';
import { CommentJouer } from '@/carte/CommentJouer';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('carte'))('titreComment'), robots: { index: false } };
}

/** L'onglet « Comment on y joue » de la carte Team Up! : la soirée en quatre temps. */
export default function PageCommentJouer() {
  return (
    <CadreCarte actif="comment">
      <CommentJouer />
    </CadreCarte>
  );
}
