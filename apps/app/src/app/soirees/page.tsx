import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { CadreCarte } from '@/carte/CadreCarte';
import { Soirees } from '@/carte/Soirees';
import { soireesDuJour } from '@/serveur/partie';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('carte'))('titre'), robots: { index: false } };
}

/**
 * `app.teamup-game.fr/soirees` : l'adresse du QR code imprimé sur les cartes Team Up!, la même
 * pour toutes les soirées. Elle liste celles du jour que l'animateur a cochées (2026-11-01).
 * Lue à chaque visite : une soirée cochée paraît aussitôt. Les règles : onglet `/soirees/jeux`.
 */
export const dynamic = 'force-dynamic';

export default async function PageSoirees() {
  const [soirees, langue] = await Promise.all([soireesDuJour(), getLocale()]);
  return (
    <CadreCarte actif="soirees">
      <Soirees soirees={soirees} langue={langue} />
    </CadreCarte>
  );
}
