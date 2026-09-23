import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { normaliserCode } from '@/lib/partie';
import type { EtatSalle } from '@/lib/salle';
import { EcranCommun } from '@/ecran/EcranCommun';
import { qrDeLaPartie } from '@/serveur/qr';
import { exigerAnimateur } from '@/serveur/supabase-animateur';

export const metadata: Metadata = { title: 'Écran', robots: { index: false } };

/**
 * L'écran commun, ouvert depuis la régie dans une seconde fenêtre (décision du 2026-09-23) :
 * il porte la session de l'animateur, donc la RLS, et ne lit que ses événements.
 */
export default async function Ecran({ params }: PageProps<'/ecran/[code]'>) {
  const code = normaliserCode((await params).code);
  if (!code) notFound();
  const { supabase } = await exigerAnimateur();
  const { data } = await supabase.rpc('etat_ecran', { p_code: code, p_regie: false });
  if (!data) notFound();
  const { svg, adresse } = await qrDeLaPartie(code);
  return <EcranCommun initial={data as unknown as EtatSalle} qrSvg={svg} adresse={adresse} />;
}
