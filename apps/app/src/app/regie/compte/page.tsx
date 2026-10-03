import { getTranslations } from 'next-intl/server';
import { exigerAnimateur } from '@/serveur/supabase-animateur';
import { EnTete } from '@/regie/EnTete';
import { FormulaireMotDePasse } from '@/regie/FormulaireMotDePasse';

export async function generateMetadata() {
  return { title: (await getTranslations('regie.compte'))('titre') };
}

export default async function Compte() {
  const { animateur } = await exigerAnimateur();
  const t = await getTranslations('regie.compte');
  return (
    <>
      <EnTete admin={animateur.role === 'admin'} />
      <main className="tu-regie__main tu-regie__main--narrow">
        <h1 className="tu-regie__title">{t('titre')}</h1>
        <p className="tu-regie__muted">{animateur.nom}</p>
        <FormulaireMotDePasse />
      </main>
    </>
  );
}
