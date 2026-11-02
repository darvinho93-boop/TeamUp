import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CadreCarte } from '@/carte/CadreCarte';
import { Jeux } from '@/carte/Jeux';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('carte'))('titreJeux'), robots: { index: false } };
}

/** L'onglet « Les jeux » de la carte Team Up! : la règle des cinq jeux. */
export default function PageJeux() {
  return (
    <CadreCarte actif="jeux">
      <Jeux />
    </CadreCarte>
  );
}
