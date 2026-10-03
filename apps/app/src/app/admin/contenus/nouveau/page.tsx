import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { estJeuContenu } from '@/lib/contenus';
import { exigerAdmin } from '@/serveur/supabase-animateur';
import { FormulaireContenu } from '@/admin/FormulaireContenu';

export async function generateMetadata() {
  return { title: (await getTranslations('admin.formulaire'))('nouveau') };
}

export default async function NouveauContenu({
  searchParams,
}: PageProps<'/admin/contenus/nouveau'>) {
  await exigerAdmin();
  const t = await getTranslations('admin.formulaire');
  const tJeux = await getTranslations('jeux');
  const { jeu: brut } = await searchParams;
  const jeu = estJeuContenu(brut) ? brut : 'list2';
  return (
    <>
      <Link href={`/admin/contenus?jeu=${jeu}`} className="tu-regie__muted">
        {t('retour')}
      </Link>
      <h1 className="tu-regie__title">{t('titreNouveau', { jeu: tJeux(jeu) })}</h1>
      <FormulaireContenu jeu={jeu} id={null} valeurs={{}} />
    </>
  );
}
