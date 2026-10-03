import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Button } from '@teamup/ui/react';
import { estJeuContenu, valeursDuFormulaire } from '@/lib/contenus';
import { exigerAdmin } from '@/serveur/supabase-animateur';
import { FormulaireContenu } from '@/admin/FormulaireContenu';
import { basculerContenu } from '../actions';

export async function generateMetadata() {
  return { title: (await getTranslations('admin.formulaire'))('modifier') };
}

export default async function ModifierContenu({ params }: PageProps<'/admin/contenus/[id]'>) {
  const { supabase } = await exigerAdmin();
  const t = await getTranslations('admin.formulaire');
  const tJeux = await getTranslations('jeux');
  const { id } = await params;
  const { data: contenu } = await supabase
    .from('contenus')
    .select(
      'id, jeu, etiquette, actif, contenus_traductions(langue, valeur), contenus_secrets(langue, valeur)',
    )
    .eq('id', id)
    .maybeSingle();
  if (!contenu || !estJeuContenu(contenu.jeu)) notFound();
  const jeu = contenu.jeu;

  const valeurs = {
    ...valeursDuFormulaire(jeu, contenu.contenus_traductions, contenu.contenus_secrets),
    etiquette: contenu.etiquette,
  };

  return (
    <>
      <Link href={`/admin/contenus?jeu=${jeu}`} className="tu-regie__muted">
        {t('retour')}
      </Link>
      <h1 className="tu-regie__title">{t('titreModifier', { jeu: tJeux(jeu) })}</h1>
      {!contenu.actif && <p className="tu-regie__alert">{t('inactif')}</p>}
      <FormulaireContenu jeu={jeu} id={contenu.id} valeurs={valeurs} />
      <form action={basculerContenu.bind(null, contenu.id, !contenu.actif)}>
        <div className="tu-regie__section">
          <p className="tu-regie__muted">
            {contenu.actif ? t('aideDesactiver') : t('aideReactiver')}
          </p>
          <div>
            <Button type="submit" variant="ghost">
              {contenu.actif ? t('desactiver') : t('reactiver')}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
