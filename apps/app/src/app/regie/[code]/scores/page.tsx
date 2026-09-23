import { getFormatter, getTranslations } from 'next-intl/server';
import { TeamDot } from '@teamup/ui/react';
import { evenementDeLaRegie } from '@/serveur/regie';
import { FormulaireCorrection } from '@/regie/FormulaireCorrection';

export async function generateMetadata() {
  return { title: (await getTranslations('regie.nav'))('scores') };
}

export default async function Scores({ params }: PageProps<'/regie/[code]/scores'>) {
  const { supabase, evenement } = await evenementDeLaRegie((await params).code);
  const t = await getTranslations('regie.scores');
  const format = await getFormatter();
  const [{ data: classement }, { data: journal }] = await Promise.all([
    supabase
      .from('classement')
      .select('equipe_id, numero, nom, points')
      .eq('evenement_id', evenement.id)
      .order('points', { ascending: false })
      .order('numero'),
    supabase
      .from('scores')
      .select('id, points, motif, cree_le, equipe_id, animateurs(nom)')
      .eq('evenement_id', evenement.id)
      .order('cree_le', { ascending: false }),
  ]);
  const equipes = (classement ?? []).filter((e) => e.equipe_id !== null);
  const nom = new Map(equipes.map((e) => [e.equipe_id, e.nom]));

  return (
    <>
      <h1 className="tu-regie__title">{t('titre')}</h1>

      <section className="tu-regie__section" aria-labelledby="classement">
        <h2 id="classement" className="tu-regie__section-title">
          {t('classement')}
        </h2>
        <table className="tu-table">
          <thead>
            <tr>
              <th scope="col">{t('rang')}</th>
              <th scope="col">{t('equipe')}</th>
              <th scope="col" className="tu-table__num">
                {t('points')}
              </th>
            </tr>
          </thead>
          <tbody>
            {equipes.map((e, i) => (
              <tr key={e.equipe_id}>
                <td>{i + 1}</td>
                <td>
                  <TeamDot index={e.numero ?? 1} name={e.nom ?? ''} />
                </td>
                <td className="tu-table__num" data-testid={`total-${e.numero}`}>
                  {e.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="tu-regie__section" aria-labelledby="correction">
        <h2 id="correction" className="tu-regie__section-title">
          {t('correction')}
        </h2>
        <FormulaireCorrection
          code={evenement.code}
          equipes={equipes.map((e) => ({ id: e.equipe_id!, nom: e.nom ?? '' }))}
        />
      </section>

      <section className="tu-regie__section" aria-labelledby="journal">
        <h2 id="journal" className="tu-regie__section-title">
          {t('journal')}
        </h2>
        {(journal ?? []).length === 0 ? (
          <p className="tu-regie__muted">{t('journalVide')}</p>
        ) : (
          <table className="tu-table">
            <thead>
              <tr>
                <th scope="col">{t('quand')}</th>
                <th scope="col">{t('equipe')}</th>
                <th scope="col">{t('motif')}</th>
                <th scope="col">{t('par')}</th>
                <th scope="col" className="tu-table__num">
                  {t('points')}
                </th>
              </tr>
            </thead>
            <tbody>
              {(journal ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{format.dateTime(new Date(s.cree_le), { timeStyle: 'short' })}</td>
                  <td>{nom.get(s.equipe_id) ?? '—'}</td>
                  <td>{s.motif}</td>
                  <td>{s.animateurs?.nom ?? '—'}</td>
                  <td className="tu-table__num">{s.points > 0 ? `+${s.points}` : s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
