import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { exigerAnimateur } from '@/serveur/supabase-animateur';
import { EnTete } from '@/regie/EnTete';
import { FormulaireEvenement } from '@/regie/FormulaireEvenement';

export async function generateMetadata() {
  return { title: (await getTranslations('regie.evenements'))('titre') };
}

/** Mes événements, à venir et passés ; et la création d'un nouveau. */
export default async function Evenements() {
  const { supabase, animateur } = await exigerAnimateur();
  const t = await getTranslations('regie.evenements');
  const format = await getFormatter();
  const { data: evenements } = await supabase
    .from('evenements')
    .select('id, code, client_nom, date_evenement, statut, creneau_minutes')
    .order('date_evenement');

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const aVenir = (evenements ?? []).filter((e) => e.date_evenement >= aujourdhui);
  const passes = (evenements ?? []).filter((e) => e.date_evenement < aujourdhui).reverse();

  const liste = (lignes: typeof aVenir) =>
    lignes.length === 0 ? (
      <p className="tu-regie__muted">{t('aucun')}</p>
    ) : (
      <ul className="tu-regie-list">
        {lignes.map((e) => (
          <li key={e.id} className="tu-regie-item">
            <div className="tu-regie-item__main">
              <span className="tu-regie-item__title">{e.client_nom}</span>
              <span className="tu-regie-item__meta">
                {format.dateTime(new Date(e.date_evenement), { dateStyle: 'full' })} ·{' '}
                {t('creneau', { minutes: e.creneau_minutes })} · {t(`statut.${e.statut}`)}
              </span>
            </div>
            <div className="tu-regie-item__actions">
              <span className="tu-regie__code">{e.code}</span>
              <Link className="tu-btn tu-btn--primary" href={`/regie/${e.code}/preparation`}>
                {t('ouvrir')}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    );

  return (
    <>
      <EnTete />
      <main className="tu-regie__main">
        <h1 className="tu-regie__title">{t('bonjour', { nom: animateur.nom })}</h1>
        <section className="tu-regie__section" aria-labelledby="a-venir">
          <h2 id="a-venir" className="tu-regie__section-title">
            {t('aVenir')}
          </h2>
          {liste(aVenir)}
        </section>
        <section className="tu-regie__section" aria-labelledby="nouveau">
          <h2 id="nouveau" className="tu-regie__section-title">
            {t('nouveau')}
          </h2>
          <FormulaireEvenement />
        </section>
        {passes.length > 0 && (
          <section className="tu-regie__section" aria-labelledby="passes">
            <h2 id="passes" className="tu-regie__section-title">
              {t('passes')}
            </h2>
            {liste(passes)}
          </section>
        )}
      </main>
    </>
  );
}
