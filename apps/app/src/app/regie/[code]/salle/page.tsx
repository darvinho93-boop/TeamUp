import { getTranslations } from 'next-intl/server';
import { evenementDeLaRegie } from '@/serveur/regie';
import { FormulaireInvite } from '@/regie/FormulaireInvite';
import { ModeMembres } from '@/regie/ModeMembres';
import { RafraichirAuto } from '@/regie/RafraichirAuto';
import { SalleEquipes } from '@/regie/SalleEquipes';
import { SignalSalle } from '@/regie/SignalSalle';

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
  const [
    { data: equipes },
    { data: joueurs },
    { data: groupes },
    { data: repartition },
    { data: pilotage },
  ] = await Promise.all([
    supabase
      .from('equipes')
      .select('id, numero, nom')
      .eq('evenement_id', evenement.id)
      .order('numero'),
    supabase
      .from('joueurs')
      .select('id, prenom, langue, capitaine, equipe_id, vu_le, sans_telephone, peut_ajouter')
      .eq('evenement_id', evenement.id)
      .order('rejoint_le'),
    supabase.from('groupes').select('id, nom').eq('evenement_id', evenement.id).order('ordre'),
    supabase
      .from('equipes_groupes')
      .select('equipe_id, groupe_id, effectif')
      .eq('evenement_id', evenement.id),
    supabase.from('pilotage').select('membres_mode').eq('evenement_id', evenement.id).maybeSingle(),
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
  // Un invité sans téléphone n'est jamais « connecté » : son `vu_le` est l'heure de l'ajout.
  const enLigne = (j: { vu_le: string; sans_telephone: boolean | null }) =>
    !j.sans_telephone && maintenant - new Date(j.vu_le).getTime() < CONNECTE_MS;
  const connectes = (joueurs ?? []).filter(enLigne).length;
  return (
    <SignalSalle evenementId={evenement.id}>
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
      <ModeMembres
        code={evenement.code}
        mode={pilotage?.membres_mode === 'carrousel' ? 'carrousel' : 'tous'}
      />
      <FormulaireInvite code={evenement.code} groupes={groupes ?? []} />
      <SalleEquipes
        code={evenement.code}
        equipes={(equipes ?? []).map((e) => ({ ...e, groupes: detailGroupes(e.id) }))}
        joueurs={(joueurs ?? []).map((j) => ({
          id: j.id,
          prenom: j.prenom,
          capitaine: j.capitaine,
          equipe_id: j.equipe_id,
          enLigne: enLigne(j),
          sansTelephone: j.sans_telephone === true,
          peutAjouter: j.peut_ajouter,
        }))}
      />
    </SignalSalle>
  );
}
