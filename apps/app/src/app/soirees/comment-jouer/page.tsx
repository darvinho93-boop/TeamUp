import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { CadreCarte } from '@/carte/CadreCarte';
import { CommentJouer } from '@/carte/CommentJouer';
import { cibleInscription } from '@/carte/liens';
import { estLangue } from '@/lib/partie';
import { soireesDuJour } from '@/serveur/partie';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('carte'))('titreComment'), robots: { index: false } };
}

/**
 * L'onglet « Comment on y joue » de la carte Team Up!. Lit les soirées du jour pour que
 * « Je m'inscris » mène au plus court (`cibleInscription`).
 */
export const dynamic = 'force-dynamic';

export default async function PageCommentJouer() {
  const [soirees, langue] = await Promise.all([soireesDuJour(), getLocale()]);
  return (
    <CadreCarte actif="comment">
      <CommentJouer inscription={cibleInscription(soirees, estLangue(langue) ? langue : 'fr')} />
    </CadreCarte>
  );
}
