import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { CadreCarte } from '@/carte/CadreCarte';
import { Jeux } from '@/carte/Jeux';
import { cibleInscription } from '@/carte/liens';
import { estLangue } from '@/lib/partie';
import { soireesDuJour } from '@/serveur/partie';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('carte'))('titreJeux'), robots: { index: false } };
}

/**
 * L'onglet des jeux de la carte Team Up! : comment on joue et la règle des cinq jeux. Lit les
 * soirées du jour pour que « Je m'inscris » mène au plus court (`cibleInscription`).
 */
export const dynamic = 'force-dynamic';

export default async function PageJeux() {
  const [soirees, langue] = await Promise.all([soireesDuJour(), getLocale()]);
  return (
    <CadreCarte actif="jeux">
      <Jeux inscription={cibleInscription(soirees, estLangue(langue) ? langue : 'fr')} />
    </CadreCarte>
  );
}
