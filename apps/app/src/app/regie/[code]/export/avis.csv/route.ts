import { getFormatter, getTranslations } from 'next-intl/server';
import { csvAvis } from '@/lib/export';
import { evenementDeLaRegie } from '@/serveur/regie';

/**
 * Les avis des joueurs en CSV (2026-11-18), du plus ancien au plus récent. Sous la session de
 * l'animateur : la RLS limite à ses événements (l'admin les voit tous).
 */
export async function GET(_: Request, { params }: RouteContext<'/regie/[code]/export/avis.csv'>) {
  const { supabase, evenement } = await evenementDeLaRegie((await params).code);
  const t = await getTranslations('regie.avis.csv');
  const format = await getFormatter();

  const { data: avis } = await supabase
    .from('avis_joueurs')
    .select('positifs, negatif, rien_a_redire, prenom, langue, modifie_le')
    .eq('evenement_id', evenement.id)
    .order('modifie_le');

  const csv = csvAvis({
    avis: (avis ?? []).map((a) => ({
      heure: format.dateTime(new Date(a.modifie_le), {
        timeStyle: 'short',
        timeZone: 'Europe/Paris',
      }),
      langue: a.langue,
      positifs: a.positifs,
      negatif: a.negatif,
      rienARedire: a.rien_a_redire,
      prenom: a.prenom,
    })),
    libelles: {
      heure: t('heure'),
      langue: t('langue'),
      aime: (n) => t('aime', { n }),
      moinsPlu: t('moinsPlu'),
      rienARedire: t('rienARedire'),
      citable: t('citable'),
    },
  });

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="avis-${evenement.code}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
