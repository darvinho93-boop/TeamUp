-- Relecture d'un téléphone allégée (essai de charge en ligne du 2026-10-31).
--
-- À 100 téléphones, chaque touche de régie fait relire l'état aux 100 en même temps. En mode
-- téléphone du quiz, `quiz_du_joueur` appelait `quiz_joueurs(manche)`, qui calcule l'élimination
-- de tous les joueurs de la soirée pour n'en garder qu'un : 100 × 100 calculs par rafale, qui
-- saturaient le processeur de la base (relectures jusqu'à 6 s, écran à une seconde de la régie).
-- `etat_joueur` joignait aussi la vue `classement`, que Postgres agrège sur toutes les équipes de
-- la base avant de garder celle du joueur.
--
-- Mêmes règles qu'avant, pour le seul joueur qui relit : `quiz_joueurs` reste la référence pour
-- l'écran, la régie et la validation des survivants.

-- Élimination d'un joueur à une manche du quiz : null s'il n'y participe pas (pas d'équipe, pas
-- de téléphone, ou arrivé après la première question), sinon vrai s'il a manqué une question
-- comptée. Mêmes conditions que `quiz_joueurs`.
create function public.quiz_elimination(p_manche uuid, p_joueur public.joueurs)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  with debut as (
    select min(pa.commence_le) as le from public.passages pa where pa.manche_id = p_manche
  ),
  comptees as (
    select pa.id, (
      select (s.valeur ->> 'bonne')::smallint
      from public.contenus_secrets s
      where s.contenu_id = pa.contenu_id
      order by (s.langue = 'fr') desc
      limit 1
    ) as bonne
    from public.passages pa
    where pa.manche_id = p_manche
      and pa.statut = 'termine'
      and not coalesce((pa.resultat ->> 'annulee')::boolean, false)
  )
  select exists (
    select 1 from comptees q
    where not exists (
      select 1 from public.reponses_quiz r
      where r.passage_id = q.id and r.joueur_id = p_joueur.id and r.choix = q.bonne
    )
  )
  from public.manches m
  cross join debut
  where m.id = p_manche
    and m.evenement_id = p_joueur.evenement_id
    and p_joueur.equipe_id is not null
    and p_joueur.jeton_hash is not null
    and (debut.le is null or p_joueur.rejoint_le <= debut.le);
$$;

revoke execute on function public.quiz_elimination(uuid, public.joueurs)
  from public, anon, authenticated;
grant execute on function public.quiz_elimination(uuid, public.joueurs) to service_role;

create or replace function public.quiz_du_joueur(p_joueur public.joueurs) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_pilotage public.pilotage;
  v_manche public.manches;
  v_passage public.passages;
  v_elimine boolean;
  v_participant boolean;
  v_question jsonb;
  v_revelee boolean;
begin
  select * into v_pilotage from public.pilotage pi where pi.evenement_id = p_joueur.evenement_id;
  select * into v_manche from public.manches m where m.id = v_pilotage.manche_id;
  if v_manche.jeu is distinct from 'qcm2'
    or coalesce(v_manche.options ->> 'mode', 'croix') not in ('telephone', 'jetons')
    or v_pilotage.scene <> 'jeu'
  then
    return null;
  end if;

  if v_manche.options ->> 'mode' = 'jetons' then
    return public.quiz_jetons_du_joueur(p_joueur, v_pilotage, v_manche);
  end if;

  select * into v_passage from public.passages pa where pa.id = v_pilotage.passage_id;
  v_elimine := public.quiz_elimination(v_manche.id, p_joueur);
  v_participant := v_elimine is not null;

  v_revelee := v_pilotage.etape = 'reponse' and v_passage.statut = 'termine';
  if v_pilotage.etape in ('question', 'reponse') then
    select t.valeur into v_question
    from public.contenus_traductions t
    where t.contenu_id = v_passage.contenu_id
    order by (t.langue = p_joueur.langue) desc, (t.langue = 'fr') desc
    limit 1;
  end if;

  return jsonb_build_object(
    'mode', 'telephone',
    'serveur_ms', floor(extract(epoch from clock_timestamp()) * 1000),
    'etape', v_pilotage.etape,
    'passage_id', v_pilotage.passage_id,
    'numero', v_passage.ordre,
    'total', (select count(*) from public.passages pa where pa.manche_id = v_manche.id),
    'chrono_depart_ms', floor(extract(epoch from v_pilotage.chrono_depart) * 1000),
    'chrono_duree_s', v_pilotage.chrono_duree_s,
    'question', v_question,
    'ma_reponse', (
      select r.choix from public.reponses_quiz r
      where r.passage_id = v_pilotage.passage_id and r.joueur_id = p_joueur.id
    ),
    'bonne', case when v_revelee then (
      select (s.valeur ->> 'bonne')::smallint
      from public.contenus_secrets s
      where s.contenu_id = v_passage.contenu_id
      order by (s.langue = 'fr') desc
      limit 1
    ) end,
    'participant', v_participant,
    'elimine', coalesce(v_elimine, false)
  );
end;
$$;

-- Les points de la seule équipe du joueur, au lieu de la vue `classement`.
create or replace function public.etat_joueur(p_jeton_hash text) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'joueur', jsonb_build_object(
      'id', j.id,
      'prenom', j.prenom,
      'langue', j.langue,
      'capitaine', j.capitaine,
      'peut_ajouter', j.peut_ajouter
    ),
    'evenement', jsonb_build_object(
      'id', e.id,
      'code', e.code,
      'statut', e.statut,
      'langues', e.langues,
      'photos_closes', e.photos_closes_le is not null
    ),
    'equipe', case when eq.id is null then null else jsonb_build_object(
      'id', eq.id,
      'numero', eq.numero,
      'nom', eq.nom,
      'nom_fige', eq.nom_fige,
      'points', (
        select coalesce(sum(s.points), 0)::integer from public.scores s where s.equipe_id = eq.id
      )
    ) end,
    'manche', (
      select jsonb_build_object('jeu', m.jeu, 'ordre', m.ordre, 'options', m.options)
      from public.manches m
      where m.evenement_id = e.id and m.statut = 'en_cours'
      order by m.ordre
      limit 1
    ),
    'prochaine', (
      select jsonb_build_object('jeu', m.jeu, 'ordre', m.ordre)
      from public.manches m
      where m.evenement_id = e.id and m.statut = 'a_venir'
      order by m.ordre
      limit 1
    ),
    'quiz', public.quiz_du_joueur(j),
    'photos', public.photos_du_joueur(j)
  )
  from public.joueurs j
  join public.evenements e on e.id = j.evenement_id
  left join public.equipes eq on eq.id = j.equipe_id
  where j.jeton_hash = p_jeton_hash;
$$;
