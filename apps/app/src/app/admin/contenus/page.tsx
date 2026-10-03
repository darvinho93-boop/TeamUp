import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  ETIQUETTES,
  estJeuContenu,
  JEUX_CONTENUS,
  languesCompletes,
  libelleContenu,
  type Etiquette,
} from '@/lib/contenus';
import { LANGUES } from '@/lib/partie';
import { exigerAdmin } from '@/serveur/supabase-animateur';

export async function generateMetadata() {
  return { title: (await getTranslations('admin.contenus'))('titre') };
}

/** Les banques, un jeu à la fois, filtrables par étiquette. */
export default async function Contenus({ searchParams }: PageProps<'/admin/contenus'>) {
  const { supabase } = await exigerAdmin();
  const t = await getTranslations('admin.contenus');
  const tJeux = await getTranslations('jeux');
  const tEtiquettes = await getTranslations('admin.etiquettes');
  const { jeu: jeuBrut, etiquette: etiquetteBrute } = await searchParams;
  const jeu = estJeuContenu(jeuBrut) ? jeuBrut : 'list2';
  const etiquette = (ETIQUETTES as readonly unknown[]).includes(etiquetteBrute)
    ? (etiquetteBrute as Etiquette)
    : null;

  let requete = supabase
    .from('contenus')
    .select(
      'id, jeu, etiquette, actif, contenus_traductions(langue, valeur), contenus_secrets(langue, valeur)',
    )
    .eq('jeu', jeu)
    .order('actif', { ascending: false })
    .order('cree_le', { ascending: false });
  if (etiquette) requete = requete.eq('etiquette', etiquette);
  const { data: contenus } = await requete;

  const lien = (params: { jeu?: string; etiquette?: string | null }) => {
    const p = new URLSearchParams({ jeu: params.jeu ?? jeu });
    const e = params.etiquette === undefined ? etiquette : params.etiquette;
    if (e) p.set('etiquette', e);
    return `/admin/contenus?${p}`;
  };

  return (
    <>
      <h1 className="tu-regie__title">{t('titre')}</h1>
      <nav aria-label={t('jeux')}>
        <ul className="tu-admin-tabs">
          {JEUX_CONTENUS.map((j) => (
            <li key={j}>
              <Link
                href={lien({ jeu: j })}
                className="tu-regie__nav-link"
                aria-current={j === jeu ? 'page' : undefined}
              >
                {tJeux(j)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label={t('etiquette')}>
        <ul className="tu-admin-tabs">
          {[null, ...ETIQUETTES].map((e) => (
            <li key={e ?? 'toutes'}>
              <Link
                href={lien({ etiquette: e })}
                className="tu-regie__nav-link"
                aria-current={e === etiquette ? 'page' : undefined}
              >
                {e ? tEtiquettes(e) : t('toutes')}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div>
        <Link href={`/admin/contenus/nouveau?jeu=${jeu}`} className="tu-btn tu-btn--primary">
          {t('nouveau', { jeu: tJeux(jeu) })}
        </Link>
      </div>

      {(contenus ?? []).length === 0 ? (
        <p className="tu-regie__muted">{t('aucun')}</p>
      ) : (
        <ul className="tu-regie-list">
          {(contenus ?? []).map((c) => {
            const completes = languesCompletes(c);
            return (
              <li key={c.id} className="tu-regie-item" data-testid="contenu">
                <div className="tu-regie-item__main">
                  <span className="tu-regie-item__title">
                    {libelleContenu(jeu, c.contenus_traductions, c.contenus_secrets, 'fr')}
                  </span>
                  <span className="tu-regie-item__meta">
                    {tEtiquettes(c.etiquette)}
                    {!c.actif && ` · ${t('inactif')}`}
                  </span>
                  <ul className="tu-admin-pastilles" aria-label={t('langues')}>
                    {LANGUES.map((l) => (
                      <li
                        key={l}
                        className={`tu-admin-pastille${completes.includes(l) ? ' tu-admin-pastille--presente' : ''}`}
                      >
                        {l.toUpperCase()}
                        <span className="tu-visually-hidden">
                          {completes.includes(l) ? ` ${t('traduit')}` : ` ${t('manquant')}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="tu-regie-item__actions">
                  <Link href={`/admin/contenus/${c.id}`} className="tu-btn tu-btn--ghost">
                    {t('modifier')}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
