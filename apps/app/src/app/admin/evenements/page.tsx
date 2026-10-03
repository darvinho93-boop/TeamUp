import { getFormatter, getTranslations } from 'next-intl/server';
import { formatDuree } from '@teamup/game';
import { dureePrevueS, dureeSoireeS, tauxConnexion } from '@/lib/mesure';
import { exigerAdmin } from '@/serveur/supabase-animateur';

export async function generateMetadata() {
  return { title: (await getTranslations('admin.evenements'))('titre') };
}

/**
 * Historique des événements, tous animateurs confondus (cahier des charges § 5.4) : durée
 * réelle face à la prévue, taux de connexion des invités, export de chaque soirée.
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
      'id, code, client_nom, type_client, date_evenement, creneau_minutes, statut, invites_attendus, animateurs(nom), joueurs(count), manches(jeu, options, statut, commence_le, termine_le, passages(count))',
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

  const pourcent = (x: number) => format.number(x, { style: 'percent', maximumFractionDigits: 0 });

  return (
    <>
      <h1 className="tu-regie__title">{t('titre')}</h1>
      <div className="tu-admin-table-wrap">
        <table className="tu-table tu-admin-table">
          <thead>
            <tr>
              <th scope="col">{t('date')}</th>
              <th scope="col">{t('client')}</th>
              <th scope="col">{t('type')}</th>
              <th scope="col">{t('animateur')}</th>
              <th scope="col" className="tu-table__num">
                {t('joueurs')}
              </th>
              <th scope="col" className="tu-table__num">
                {t('taux')}
              </th>
              <th scope="col" className="tu-table__num">
                {t('prevue')}
              </th>
              <th scope="col" className="tu-table__num">
                {t('reelle')}
              </th>
              <th scope="col">{t('statut')}</th>
              <th scope="col">{t('export')}</th>
            </tr>
          </thead>
          <tbody>
            {(evenements ?? []).map((e) => {
              const joueurs = e.joueurs[0]?.count ?? 0;
              const taux = tauxConnexion(joueurs, e.invites_attendus);
              const manches = e.manches
                .filter((m) => m.statut !== 'annulee')
                .map((m) => ({
                  jeu: m.jeu,
                  options: (m.options ?? {}) as Record<string, unknown>,
                  passages: m.passages[0]?.count ?? 0,
                  commence_le: m.commence_le,
                  termine_le: m.termine_le,
                }));
              const prevueS = manches.reduce((s, m) => s + dureePrevueS(m), 0);
              const reelleS = dureeSoireeS(manches);
              return (
                <tr key={e.id} data-testid="historique">
                  <td>{format.dateTime(new Date(e.date_evenement), { dateStyle: 'medium' })}</td>
                  <td>{e.client_nom}</td>
                  <td>{tType(e.type_client)}</td>
                  <td>{e.animateurs?.nom ?? '—'}</td>
                  <td className="tu-table__num">
                    {e.invites_attendus ? `${joueurs} / ${e.invites_attendus}` : joueurs}
                  </td>
                  <td className="tu-table__num">{taux === null ? '—' : pourcent(taux)}</td>
                  <td className="tu-table__num">
                    {prevueS ? formatDuree(prevueS) : t('minutes', { minutes: e.creneau_minutes })}
                  </td>
                  <td className="tu-table__num">{reelleS === null ? '—' : formatDuree(reelleS)}</td>
                  <td>{tStatut(e.statut)}</td>
                  <td>
                    <a
                      href={`/regie/${e.code}/export/scores.csv`}
                      download
                      className="tu-regie__lien"
                    >
                      CSV
                    </a>{' '}
                    ·{' '}
                    <a
                      href={`/regie/${e.code}/export/photos.zip`}
                      download
                      className="tu-regie__lien"
                    >
                      ZIP
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="tu-regie__muted">{t('aide')}</p>
    </>
  );
}
