import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { EditeurParoles } from '@/admin/EditeurParoles';
import { parolesDe } from '@/lib/paroles';
import { exigerAdmin } from '@/serveur/supabase-animateur';

export async function generateMetadata() {
  return { title: (await getTranslations('admin.musiques'))('paroles') };
}

/** Une heure pour écouter et caler : la page se recharge à chaque visite. */
const ECOUTE_S = 60 * 60;

/** Les paroles d'une musique pour le karaoké du Blind test (2026-11-23) : coller, caler, relire. */
export default async function ParolesMusique({
  params,
}: PageProps<'/admin/musiques/[id]/paroles'>) {
  const { supabase } = await exigerAdmin();
  const t = await getTranslations('admin.musiques.edition');
  const { id } = await params;
  const { data: musique } = await supabase
    .from('musiques')
    .select('id, titre, artiste, chemin, paroles')
    .eq('id', id)
    .maybeSingle();
  if (!musique) notFound();
  const { data: signee } = await supabase.storage
    .from('musiques')
    .createSignedUrl(musique.chemin, ECOUTE_S);
  const titre = musique.artiste ? `${musique.titre} — ${musique.artiste}` : musique.titre;

  return (
    <>
      <Link href="/admin/musiques" className="tu-regie__muted">
        {t('retour')}
      </Link>
      <h1 className="tu-regie__title">{t('titre', { titre })}</h1>
      <p className="tu-regie__muted">{t('aide')}</p>
      <EditeurParoles
        id={musique.id}
        titre={musique.titre}
        url={signee?.signedUrl ?? null}
        initiales={parolesDe(musique.paroles)}
      />
    </>
  );
}
