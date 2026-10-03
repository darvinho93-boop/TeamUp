import { getFormatter, getTranslations } from 'next-intl/server';
import { exigerAdmin } from '@/serveur/supabase-animateur';

export async function generateMetadata() {
  return { title: (await getTranslations('admin.evenements'))('titre') };
}

/**
 * Historique des événements, tous animateurs confondus (cahier des charges § 5.4). La durée
 * réelle viendra avec la mesure du lot 10 ; ici, la durée prévue.
 */
export default async function Historique() {
  const { supabase } = await exigerAdmin();
  const t = await getTranslations('admin.evenements');
  const tStatut = await getTranslations('regie.evenements.statut');
  const tType = await getTranslations('regie.evenements');
  const format = await getFormatter();
  const { data: evenements } = await supabase
    .from('evenements')
    .select(
      'id, code, client_nom, type_client, date_evenement, creneau_minutes, statut, animateurs(nom), joueurs(count)',
    )
    .order('date_evenement', { ascending: false });

  if ((evenements ?? []).length === 0) {
    return (
      <>
        <h1 className="tu-regie__title">{t('titre')}</h1>
        <p className="tu-regie__muted">{t('aucun')}</p>
      </>
    );
  }

  return (
    <>
      <h1 className="tu-regie__title">{t('titre')}</h1>
      <div className="tu-admin-table-wrap">
        <table className="tu-admin-table">
          <thead>
            <tr>
              <th scope="col">{t('date')}</th>
              <th scope="col">{t('client')}</th>
              <th scope="col">{t('type')}</th>
              <th scope="col">{t('animateur')}</th>
              <th scope="col">{t('joueurs')}</th>
              <th scope="col">{t('creneau')}</th>
              <th scope="col">{t('statut')}</th>
              <th scope="col">{t('code')}</th>
            </tr>
          </thead>
          <tbody>
            {(evenements ?? []).map((e) => (
              <tr key={e.id}>
                <td>{format.dateTime(new Date(e.date_evenement), { dateStyle: 'medium' })}</td>
                <td>{e.client_nom}</td>
                <td>{tType(e.type_client)}</td>
                <td>{e.animateurs?.nom ?? '—'}</td>
                <td data-nombre>{e.joueurs[0]?.count ?? 0}</td>
                <td data-nombre>{t('minutes', { minutes: e.creneau_minutes })}</td>
                <td>{tStatut(e.statut)}</td>
                <td className="tu-regie__code">{e.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
