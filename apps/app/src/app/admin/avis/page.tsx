import { getFormatter, getTranslations } from 'next-intl/server';
import { avisParSoiree } from '@/lib/avis';
import { exigerAdmin } from '@/serveur/supabase-animateur';

export async function generateMetadata() {
  return { title: (await getTranslations('admin.avis'))('titre') };
}

/**
 * Les avis des joueurs, toutes soirées confondues (2026-11-18) : un tableau par soirée, avec le
 * lien vers sa page Avis, puis les témoignages que les joueurs ont accepté de voir cités (avec
 * leur prénom), à reprendre sur la vitrine.
 */
export default async function AvisDesSoirees() {
  const { supabase } = await exigerAdmin();
  const t = await getTranslations('admin.avis');
  const format = await getFormatter();
  const { data } = await supabase
    .from('avis_joueurs')
    .select(
      'id, positifs, citable, prenom, rien_a_redire, modifie_le, evenements(code, client_nom, date_evenement)',
    )
    .order('modifie_le', { ascending: false });

  const avis = (data ?? []).flatMap((a) =>
    a.evenements
      ? [
          {
            ...a,
            soiree: {
              code: a.evenements.code,
              client: a.evenements.client_nom,
              date: a.evenements.date_evenement,
            },
          },
        ]
      : [],
  );
  const soirees = avisParSoiree(avis);
  const temoignages = avis.filter((a) => a.citable && a.prenom);
  const date = (jour: string) => format.dateTime(new Date(jour), { dateStyle: 'medium' });

  if (avis.length === 0) {
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

      <section className="tu-regie__section" aria-labelledby="par-soiree">
        <h2 id="par-soiree" className="tu-regie__section-title">
          {t('parSoiree')}
        </h2>
        <div className="tu-admin-table-wrap">
          <table className="tu-table tu-admin-table">
            <thead>
              <tr>
                <th scope="col">{t('date')}</th>
                <th scope="col">{t('client')}</th>
                <th scope="col" className="tu-table__num">
                  {t('recus')}
                </th>
                <th scope="col" className="tu-table__num">
                  {t('rienARedire')}
                </th>
                <th scope="col" className="tu-table__num">
                  {t('citables')}
                </th>
                <th scope="col">{t('lire')}</th>
              </tr>
            </thead>
            <tbody>
              {soirees.map((s) => (
                <tr key={s.code} data-testid="avis-soiree">
                  <td>{date(s.date)}</td>
                  <td>{s.client}</td>
                  <td className="tu-table__num">{s.recus}</td>
                  <td className="tu-table__num">{s.rienARedire}</td>
                  <td className="tu-table__num">{s.citables}</td>
                  <td>
                    <a href={`/regie/${s.code}/avis`} className="tu-regie__lien">
                      {t('ouvrir')}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="tu-regie__section" aria-labelledby="temoignages">
        <h2 id="temoignages" className="tu-regie__section-title">
          {t('temoignages')}
        </h2>
        <p className="tu-regie__muted">{t('aideTemoignages')}</p>
        {temoignages.length === 0 ? (
          <p className="tu-regie__muted">{t('aucunTemoignage')}</p>
        ) : (
          <ol className="tu-regie-avis-liste">
            {temoignages.map((a) => (
              <li key={a.id} className="tu-regie-avis-carte" data-testid="temoignage">
                <p className="tu-regie-avis-carte__meta">
                  <strong>{a.prenom}</strong>
                  {' · '}
                  {a.soiree.client}
                  {' · '}
                  {date(a.soiree.date)}
                </p>
                <ul className="tu-regie-avis-carte__aime" aria-label={t('aime')}>
                  {a.positifs.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
