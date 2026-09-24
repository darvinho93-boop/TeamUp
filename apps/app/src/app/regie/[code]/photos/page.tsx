import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { EtatSalle } from '@/lib/salle';
import { SuiviPhotos } from '@/regie/SuiviPhotos';
import { evenementDeLaRegie } from '@/serveur/regie';

export async function generateMetadata() {
  return { title: (await getTranslations('regie.nav'))('photos') };
}

export default async function PagePhotos({ params }: PageProps<'/regie/[code]/photos'>) {
  const { supabase, evenement } = await evenementDeLaRegie((await params).code);
  const t = await getTranslations('regie.photos');
  const { data } = await supabase.rpc('etat_ecran', { p_code: evenement.code, p_regie: true });
  if (!data) notFound();
  return (
    <>
      <h1 className="tu-regie__title">{t('titre')}</h1>
      <SuiviPhotos code={evenement.code} initial={data as unknown as EtatSalle} />
    </>
  );
}
