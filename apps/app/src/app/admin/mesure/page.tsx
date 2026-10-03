import { getFormatter, getTranslations } from 'next-intl/server';
import { formatDuree } from '@teamup/game';
import { mesureParJeu, tauxConnexion } from '@/lib/mesure';
import { exigerAdmin } from '@/serveur/supabase-animateur';

export async function generateMetadata() {
  return { title: (await getTranslations('admin.mesure'))('titre') };
}

/**
 * Mesure de l'app (cahier des charges § 7) : durée réelle par jeu face à la prévue, sur toutes
 * les manches terminées ; taux de connexion des invités sur les soirées qui l'ont renseigné.
 * La conversion en devis de la vitrine se lit dans Vercel Web Analytics.
 */
export default async function Mesure() {
  const { supabase } = await exigerAdmin();
  const t = await getTranslations('admin.mesure');
  const tJeux = await getTranslations('jeux');
  const format = await getFormatter();
  const [{ data: manches }, { data: evenements }] = await Promise.all([
    supabase
      .from('manches')
      .select('jeu, options, commence_le, termine_le, passages(count)')
      .eq('statut', 'terminee'),
    supabase
      .from('evenements')
      .select('invites_attendus, joueurs(count)')
      .not('invites_attendus', 'is', null),
  ]);

  const mesures = mesureParJeu(
    (manches ?? []).map((m) => ({
      jeu: m.jeu,
      options: (m.options ?? {}) as Record<string, unknown>,
      passages: m.passages[0]?.count ?? 0,
      commence_le: m.commence_le,
      termine_le: m.termine_le,
    })),
  );
  const taux = (evenements ?? []).flatMap((e) => {
    const x = tauxConnexion(e.joueurs[0]?.count ?? 0, e.invites_attendus);
    return x === null ? [] : [x];
  });
  const tauxMoyen = taux.length ? taux.reduce((a, b) => a + b, 0) / taux.length : null;
  const pourcent = (x: number, signe = false) =>
    format.number(x, {
      style: 'percent',
      maximumFractionDigits: 0,
      ...(signe ? { signDisplay: 'exceptZero' as const } : {}),
    });

  return (
    <>
      <h1 className="tu-regie__title">{t('titre')}</h1>

      <section className="tu-regie__section" aria-labelledby="durees">
        <h2 id="durees" className="tu-regie__section-title">
          {t('durees')}
        </h2>
        {mesures.length === 0 ? (
          <p className="tu-regie__muted">{t('aucune')}</p>
        ) : (
          <div className="tu-admin-table-wrap">
            <table className="tu-table tu-admin-table">
              <thead>
                <tr>
                  <th scope="col">{t('jeu')}</th>
                  <th scope="col" className="tu-table__num">
                    {t('manches')}
                  </th>
                  <th scope="col" className="tu-table__num">
                    {t('prevu')}
                  </th>
                  <th scope="col" className="tu-table__num">
                    {t('reel')}
                  </th>
                  <th scope="col" className="tu-table__num">
                    {t('ecart')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {mesures.map((m) => (
                  <tr key={m.jeu} data-testid={`mesure-${m.jeu}`}>
                    <td>{tJeux(m.jeu)}</td>
                    <td className="tu-table__num">{m.manches}</td>
                    <td className="tu-table__num">{formatDuree(m.prevuMoyenS)}</td>
                    <td className="tu-table__num">{formatDuree(m.reelMoyenS)}</td>
                    <td className="tu-table__num">{pourcent(m.ecart, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="tu-regie__muted">{t('aideDurees')}</p>
      </section>

      <section className="tu-regie__section" aria-labelledby="connexion">
        <h2 id="connexion" className="tu-regie__section-title">
          {t('connexion')}
        </h2>
        <p className="tu-regie-item__title" data-testid="taux-moyen">
          {tauxMoyen === null
            ? t('connexionAucune')
            : t('connexionMoyenne', { taux: pourcent(tauxMoyen), soirees: taux.length })}
        </p>
      </section>

      <section className="tu-regie__section" aria-labelledby="vitrine">
        <h2 id="vitrine" className="tu-regie__section-title">
          {t('vitrine')}
        </h2>
        <p className="tu-regie__muted">{t('vitrineAide')}</p>
      </section>
    </>
  );
}
