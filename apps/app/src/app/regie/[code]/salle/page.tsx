import { getTranslations } from 'next-intl/server';
import { cx, teamModifier } from '@teamup/ui/react';
import { evenementDeLaRegie } from '@/serveur/regie';
import { RafraichirAuto } from '@/regie/RafraichirAuto';
import { ChoixEquipe } from '@/regie/ChoixEquipe';
import { designerCapitaine } from './actions';

export async function generateMetadata() {
  return { title: (await getTranslations('regie.nav'))('salle') };
}

/** Un joueur vu il y a moins de 30 s (son téléphone relit l'état toutes les 4 s) est connecté. */
const CONNECTE_MS = 30_000;

/** L'heure du rendu serveur : la page se relit toutes les 5 s (RafraichirAuto). */
function instantDuRendu(): number {
  return Date.now();
}

export default async function Salle({ params }: PageProps<'/regie/[code]/salle'>) {
  const { supabase, evenement } = await evenementDeLaRegie((await params).code);
  const t = await getTranslations('regie.salle');
  const [{ data: equipes }, { data: joueurs }, { data: groupes }, { data: repartition }] =
    await Promise.all([
      supabase
        .from('equipes')
        .select('id, numero, nom')
        .eq('evenement_id', evenement.id)
        .order('numero'),
      supabase
        .from('joueurs')
        .select('id, prenom, langue, capitaine, equipe_id, vu_le')
        .eq('evenement_id', evenement.id)
        .order('rejoint_le'),
      supabase.from('groupes').select('id, nom').eq('evenement_id', evenement.id).order('ordre'),
      supabase
        .from('equipes_groupes')
        .select('equipe_id, groupe_id, effectif')
        .eq('evenement_id', evenement.id),
    ]);
  // Répartition comptée à l'arrivée (lot 11) : un déplacement à la régie ne la change pas,
  // on ne sait pas de quel groupe est le joueur, et c'est voulu.
  const detailGroupes = (equipeId: string) =>
    (groupes ?? [])
      .map((g) => {
        const compte = (repartition ?? []).find(
          (r) => r.equipe_id === equipeId && r.groupe_id === g.id,
        );
        return `${g.nom} ${compte?.effectif ?? 0}`;
      })
      .join(' · ');
  const maintenant = instantDuRendu();
  const connectes = (joueurs ?? []).filter(
    (j) => maintenant - new Date(j.vu_le).getTime() < CONNECTE_MS,
  ).length;
  const sansEquipe = (joueurs ?? []).filter((j) => !j.equipe_id);
  const colonnes = [
    ...(equipes ?? []).map((e) => ({
      ...e,
      membres: (joueurs ?? []).filter((j) => j.equipe_id === e.id),
    })),
  ];

  const ligne = (j: NonNullable<typeof joueurs>[number]) => {
    const enLigne = maintenant - new Date(j.vu_le).getTime() < CONNECTE_MS;
    return (
      <li key={j.id} className="tu-regie-player">
        <span className="tu-regie-player__name">
          {j.prenom}
          {j.capitaine && ` · ${t('capitaine')}`}
        </span>
        <span className={cx('tu-regie-player__state', enLigne && 'tu-regie-player__state--on')}>
          {enLigne ? t('connecte') : t('horsLigne')}
        </span>
        <ChoixEquipe
          code={evenement.code}
          joueurId={j.id}
          equipeId={j.equipe_id}
          equipes={(equipes ?? []).map((e) => ({ id: e.id, nom: e.nom }))}
          libelle={t('deplacer', { prenom: j.prenom })}
        />
        {j.equipe_id && !j.capitaine && (
          <form action={designerCapitaine.bind(null, evenement.code, j.id)}>
            <button type="submit" className="tu-btn tu-btn--ghost">
              {t('nommerCapitaine')}
            </button>
          </form>
        )}
      </li>
    );
  };

  return (
    <>
      <RafraichirAuto intervalleMs={5000} />
      <div className="tu-cluster">
        <h1 className="tu-regie__title">{t('titre')}</h1>
        <a
          className="tu-btn tu-btn--accent"
          href={`/ecran/${evenement.code}`}
          target="_blank"
          rel="noopener"
        >
          {t('ouvrirEcran')}
        </a>
      </div>
      <p className="tu-regie__muted" role="status">
        {t('compte', { joueurs: (joueurs ?? []).length, connectes })}
      </p>
      <div className="tu-regie-teams">
        {colonnes.map((e) => (
          <section key={e.id} className={cx('tu-regie-team', teamModifier(e.numero))}>
            <h2 className="tu-regie__section-title">
              {e.nom} · {e.membres.length}
            </h2>
            {(groupes ?? []).length > 0 && (
              <p className="tu-regie__muted" data-testid="groupes">
                {t('groupes', { detail: detailGroupes(e.id) })}
              </p>
            )}
            <ul className="tu-regie-list">{e.membres.map(ligne)}</ul>
          </section>
        ))}
        {sansEquipe.length > 0 && (
          <section className="tu-regie-team">
            <h2 className="tu-regie__section-title">{t('sansEquipe')}</h2>
            <ul className="tu-regie-list">{sansEquipe.map(ligne)}</ul>
          </section>
        )}
      </div>
    </>
  );
}
