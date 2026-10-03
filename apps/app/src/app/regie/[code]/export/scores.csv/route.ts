import { getFormatter, getTranslations } from 'next-intl/server';
import { csvScores } from '@/lib/export';
import { evenementDeLaRegie } from '@/serveur/regie';

/**
 * Les scores de la soirée en CSV (lot 10) : classement puis journal des points. Sous la
 * session de l'animateur : la RLS limite à ses événements (l'admin les voit tous).
 */
export async function GET(_: Request, { params }: RouteContext<'/regie/[code]/export/scores.csv'>) {
  const { supabase, evenement } = await evenementDeLaRegie((await params).code);
  const t = await getTranslations('regie.export');
  const tJeux = await getTranslations('jeux');
  const format = await getFormatter();

  const [{ data: classement }, { data: journal }] = await Promise.all([
    supabase.from('classement').select('nom, points').eq('evenement_id', evenement.id),
    supabase
      .from('scores')
      .select('points, motif, cree_le, equipes(nom), manches(jeu)')
      .eq('evenement_id', evenement.id)
      .order('cree_le'),
  ]);

  const csv = csvScores({
    classement: (classement ?? []).map((e) => ({ nom: e.nom ?? '', points: e.points ?? 0 })),
    journal: (journal ?? []).map((s) => ({
      heure: format.dateTime(new Date(s.cree_le), { timeStyle: 'short', timeZone: 'Europe/Paris' }),
      jeu: s.manches ? tJeux(s.manches.jeu) : t('correction'),
      motif: s.motif,
      equipe: s.equipes?.nom ?? '',
      points: s.points,
    })),
    libelles: {
      classement: t('classement'),
      rang: t('rang'),
      equipe: t('equipe'),
      points: t('points'),
      journal: t('journal'),
      heure: t('heure'),
      jeu: t('jeu'),
      motif: t('motif'),
    },
  });

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="scores-${evenement.code}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
