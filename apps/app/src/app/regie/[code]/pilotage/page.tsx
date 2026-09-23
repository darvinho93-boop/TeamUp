import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { EtatSalle } from '@/lib/salle';
import { Pilotage } from '@/regie/Pilotage';
import { qrDeLaPartie } from '@/serveur/qr';
import { evenementDeLaRegie } from '@/serveur/regie';

export async function generateMetadata() {
  return { title: (await getTranslations('regie.nav'))('pilotage') };
}

export default async function PagePilotage({ params }: PageProps<'/regie/[code]/pilotage'>) {
  const { supabase, evenement } = await evenementDeLaRegie((await params).code);
  const { data } = await supabase.rpc('etat_ecran', { p_code: evenement.code, p_regie: true });
  if (!data) notFound();
  const { svg, adresse } = await qrDeLaPartie(evenement.code);
  return (
    <Pilotage
      code={evenement.code}
      initial={data as unknown as EtatSalle}
      qrSvg={svg}
      adresse={adresse}
    />
  );
}
