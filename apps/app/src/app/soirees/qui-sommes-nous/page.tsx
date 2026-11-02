import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CadreCarte } from '@/carte/CadreCarte';
import { QuiSommesNous } from '@/carte/QuiSommesNous';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('carte'))('titreNous'), robots: { index: false } };
}

/** L'onglet « Qui sommes-nous » de la carte Team Up!. */
export default function PageQuiSommesNous() {
  return (
    <CadreCarte actif="nous">
      <QuiSommesNous />
    </CadreCarte>
  );
}
