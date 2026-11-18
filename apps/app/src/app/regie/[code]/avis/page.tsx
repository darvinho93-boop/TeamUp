import { getFormatter, getTranslations } from 'next-intl/server';
import { syntheseAvis, type AvisLu } from '@/lib/avis';
import { libelleLangue } from '@/lib/langue-navigateur';
import { RafraichirAuto } from '@/regie/RafraichirAuto';
import { evenementDeLaRegie } from '@/serveur/regie';

export async function generateMetadata() {
  return { title: (await getTranslations('regie.nav'))('avis') };
}

/**
 * Les avis des joueurs sur la soirée (2026-11-18) : ce qu'ils ont aimé, ce qui leur a moins plu.
 * Anonymes, sauf quand le joueur accepte d'être cité. Sous la session de l'animateur : la RLS
 * limite à ses événements (l'admin les voit tous). Relue toutes les 10 s pendant la soirée.
 */
export default async function Avis({ params }: PageProps<'/regie/[code]/avis'>) {
  const { supabase, evenement } = await evenementDeLaRegie((await params).code);
  const t = await getTranslations('regie.avis');
  const format = await getFormatter();
  const [{ data: lus }, { count: avecTelephone }, { data: pilotage }] = await Promise.all([
    supabase
      .from('avis_joueurs')
      .select('id, positifs, negatif, rien_a_redire, citable, prenom, langue, modifie_le')
      .eq('evenement_id', evenement.id)
      .order('modifie_le', { ascending: false }),
    supabase
      .from('joueurs')
      .select('id', { count: 'exact', head: true })
      .eq('evenement_id', evenement.id)
      .eq('sans_telephone', false),
    supabase.from('pilotage').select('avis_ouverts').eq('evenement_id', evenement.id).single(),
  ]);
  const avis: AvisLu[] = lus ?? [];
  const synthese = syntheseAvis(avis, avecTelephone ?? 0);
  const pourcent = (x: number) => format.number(x, { style: 'percent', maximumFractionDigits: 0 });

  return (
    <>
      <RafraichirAuto intervalleMs={10_000} />
      <h1 className="tu-regie__title">{t('titre')}</h1>

      <section className="tu-regie__section" aria-labelledby="synthese">
        <h2 id="synthese" className="tu-regie__section-title">
          {t('synthese')}
        </h2>
        <p data-testid="avis-synthese">
          {t('recus', { n: synthese.recus, joueurs: avecTelephone ?? 0 })}
          {synthese.taux !== null && ` (${pourcent(synthese.taux)})`}
          {' · '}
          {t('rienARedire', { n: synthese.rienARedire })}
          {' · '}
          {t('citables', { n: synthese.citables })}
        </p>
        <p className="tu-regie__muted">{pilotage?.avis_ouverts ? t('ouverts') : t('fermes')}</p>
        <div>
          <a href={`/regie/${evenement.code}/export/avis.csv`} download className="tu-regie__lien">
            {t('export')}
          </a>
        </div>
      </section>

      <section className="tu-regie__section" aria-labelledby="liste">
        <h2 id="liste" className="tu-regie__section-title">
          {t('liste')}
        </h2>
        {avis.length === 0 ? (
          <p className="tu-regie__muted">{t('aucun')}</p>
        ) : (
          <ol className="tu-regie-avis-liste">
            {avis.map((a) => (
              <li key={a.id} className="tu-regie-avis-carte" data-testid="avis">
                <p className="tu-regie-avis-carte__meta">
                  {format.dateTime(new Date(a.modifie_le), { timeStyle: 'short' })}
                  {' · '}
                  {libelleLangue(a.langue)}
                  {a.prenom && (
                    <>
                      {' · '}
                      <strong data-testid="avis-prenom">
                        {t('citable', { prenom: a.prenom })}
                      </strong>
                    </>
                  )}
                </p>
                <ul className="tu-regie-avis-carte__aime" aria-label={t('aime')}>
                  {a.positifs.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
                <ul className="tu-regie-avis-carte__moins" aria-label={t('moins')}>
                  <li>{a.rien_a_redire ? t('rien') : a.negatif}</li>
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
