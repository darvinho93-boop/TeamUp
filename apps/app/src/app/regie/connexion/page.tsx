import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@teamup/ui/react';
import { supabaseAnimateur } from '@/serveur/supabase-animateur';
import { FormulaireConnexion } from '@/regie/FormulaireConnexion';

export async function generateMetadata() {
  return { title: (await getTranslations('regie.connexion'))('titre') };
}

export default async function Connexion({ searchParams }: PageProps<'/regie/connexion'>) {
  const supabase = await supabaseAnimateur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/regie');

  const { suite, compte } = await searchParams;
  const t = await getTranslations('regie.connexion');
  return (
    <main className="tu-regie__main tu-regie__main--narrow">
      <Wordmark />
      <h1 className="tu-regie__title">{t('titre')}</h1>
      {compte === 'inactif' && <p className="tu-regie__alert">{t('inactif')}</p>}
      <FormulaireConnexion suite={typeof suite === 'string' ? suite : undefined} />
    </main>
  );
}
