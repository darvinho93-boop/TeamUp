import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { CadreCarte } from '@/carte/CadreCarte';
import { Soirees } from '@/carte/Soirees';
import { soireesDuJour } from '@/serveur/partie';
import { jetonDe } from '@/serveur/session';

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
  // Un invité déjà inscrit qui rescanne la carte (elle reste sur la table) : sa session de la
  // soirée le ramène à son écran, le bouton le dit.
  const inscrit = await Promise.all(soirees.map(async (s) => (await jetonDe(s.code)) !== null));
  const inscrites = soirees.filter((_, i) => inscrit[i]).map((s) => s.code);
  return (
    <CadreCarte actif="soirees">
      <Soirees soirees={soirees} inscrites={inscrites} langue={langue} />
    </CadreCarte>
  );
}
