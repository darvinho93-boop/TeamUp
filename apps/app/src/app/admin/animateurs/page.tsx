import { getTranslations } from 'next-intl/server';
import { exigerAdmin } from '@/serveur/supabase-animateur';
import { BasculeAnimateur } from '@/admin/BasculeAnimateur';
import { FormulaireAnimateur } from '@/admin/FormulaireAnimateur';

export async function generateMetadata() {
  return { title: (await getTranslations('admin.animateurs'))('titre') };
}

/** Les comptes Team Up! : création avec mot de passe provisoire, désactivation. */
export default async function Animateurs() {
  const { supabase, animateur: moi } = await exigerAdmin();
  const t = await getTranslations('admin.animateurs');
  const { data: comptes } = await supabase.rpc('annuaire_animateurs');

  return (
    <>
      <h1 className="tu-regie__title">{t('titre')}</h1>
      <section className="tu-regie__section" aria-labelledby="comptes">
        <h2 id="comptes" className="tu-regie__section-title">
          {t('liste')}
        </h2>
        <ul className="tu-regie-list">
          {(comptes ?? []).map((c) => (
            <li key={c.id} className="tu-regie-item" data-testid="animateur">
              <div className="tu-regie-item__main">
                <span className="tu-regie-item__title">
                  {c.nom}
                  {c.id === moi.id && ` (${t('vous')})`}
                </span>
                <span className="tu-regie-item__meta">
                  {c.email} · {t(`roles.${c.role}`)} · {c.actif ? t('actif') : t('inactif')}
                </span>
              </div>
              {c.id !== moi.id && (
                <div className="tu-regie-item__actions">
                  <BasculeAnimateur id={c.id} nom={c.nom} actif={c.actif} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="tu-regie__section" aria-labelledby="nouveau">
        <h2 id="nouveau" className="tu-regie__section-title">
          {t('nouveau')}
        </h2>
        <FormulaireAnimateur />
      </section>
    </>
  );
}
