import { getLocale, getTranslations } from 'next-intl/server';
import { exigerAdmin } from '@/serveur/supabase-animateur';
import { BasculeMusique } from '@/admin/BasculeMusique';
import { FormulaireMusique } from '@/admin/FormulaireMusique';
import { tailleLisible } from '@/lib/musiques';

export async function generateMetadata() {
  return { title: (await getTranslations('admin.musiques'))('titre') };
}

/** Une heure pour écouter depuis cette page : elle se recharge à chaque visite. */
const ECOUTE_S = 60 * 60;

/**
 * La bibliothèque de musiques (2026-11-15) : des MP3 joués sous les chronos du quiz et de la
 * Surenchère, cochés à la préparation de chaque soirée.
 */
export default async function Musiques() {
  const { supabase } = await exigerAdmin();
  const t = await getTranslations('admin.musiques');
  const langue = await getLocale();
  const { data } = await supabase
    .from('musiques')
    .select('id, titre, artiste, chemin, taille, actif')
    .order('actif', { ascending: false })
    .order('titre');
  const musiques = data ?? [];
  const { data: signees } = musiques.length
    ? await supabase.storage.from('musiques').createSignedUrls(
        musiques.map((m) => m.chemin),
        ECOUTE_S,
      )
    : { data: [] };
  const ecoute = new Map((signees ?? []).map((s) => [s.path, s.signedUrl]));

  return (
    <>
      <h1 className="tu-regie__title">{t('titre')}</h1>
      <p className="tu-regie__muted">{t('intro')}</p>
      <section className="tu-regie__section" aria-labelledby="bibliotheque">
        <h2 id="bibliotheque" className="tu-regie__section-title">
          {t('liste', { n: musiques.length })}
        </h2>
        {musiques.length === 0 ? (
          <p className="tu-regie__muted">{t('aucune')}</p>
        ) : (
          <ul className="tu-regie-list">
            {musiques.map((m) => {
              const url = ecoute.get(m.chemin);
              return (
                <li key={m.id} className="tu-regie-item" data-testid="musique">
                  <div className="tu-regie-item__main">
                    <span className="tu-regie-item__title">
                      {m.artiste ? `${m.titre} — ${m.artiste}` : m.titre}
                    </span>
                    <span className="tu-regie-item__meta">
                      {tailleLisible(m.taille, langue)} · {m.actif ? t('active') : t('inactive')}
                    </span>
                    {url && (
                      // Une musique à écouter avant de la cocher : rien à sous-titrer.
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <audio
                        className="tu-regie-ecoute"
                        controls
                        preload="none"
                        src={url}
                        aria-label={t('ecouter', { titre: m.titre })}
                      />
                    )}
                  </div>
                  <div className="tu-regie-item__actions">
                    <BasculeMusique id={m.id} titre={m.titre} actif={m.actif} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="tu-regie__section" aria-labelledby="ajouter">
        <h2 id="ajouter" className="tu-regie__section-title">
          {t('ajouter')}
        </h2>
        <FormulaireMusique />
      </section>
    </>
  );
}
