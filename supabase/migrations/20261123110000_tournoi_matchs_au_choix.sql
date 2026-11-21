-- Tournoi du gobelet (2026-11-21) : la régie choisit combien de matchs lancer, de 1 à 64 (tout un
-- tour de 64es). Reprise de 20261123090000_tournoi_gobelet.sql, seules ces bornes changent.

alter table public.matchs_tournoi drop constraint matchs_tournoi_poste_check;
alter table public.matchs_tournoi
  add constraint matchs_tournoi_poste_check check (poste between 1 and 64);

create or replace function public.poser_tableau(p_manche uuid, p_premier_tour jsonb, p_gobelets integer)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_manche public.manches;
  v_cases integer;
  v_tours integer := 1;
  v_joueurs integer;
  v_valides integer;
begin
  select * into v_manche from public.manches m where m.id = p_manche for update;
  if not found or not public.anime(v_manche.evenement_id) then
    raise exception 'manche inconnue' using errcode = 'insufficient_privilege';
  end if;
  if v_manche.jeu <> 'cup' or v_manche.options ->> 'format' is distinct from 'tournoi' then
    raise exception 'pas un tournoi' using errcode = 'PT409';
  end if;
  if v_manche.statut <> 'en_cours' then
    raise exception 'tournoi non lancé' using errcode = 'PT409';
  end if;
  if exists (
    select 1 from public.matchs_tournoi t where t.manche_id = p_manche and t.sequence is not null
  ) then
    raise exception 'tableau déjà joué' using errcode = 'PT409';
  end if;
  if p_gobelets is null or p_gobelets not between 1 and 64 then
    raise exception 'gobelets invalides' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_premier_tour) is distinct from 'array' then
    raise exception 'tableau invalide' using errcode = 'check_violation';
  end if;

  v_cases := jsonb_array_length(p_premier_tour);
  if v_cases not in (1, 2, 4, 8, 16, 32, 64, 128) then
    raise exception 'tableau invalide' using errcode = 'check_violation';
  end if;
  while (1 << (v_tours - 1)) < v_cases loop
    v_tours := v_tours + 1;
  end loop;

  -- Chaque place une fois, chaque joueur une fois, et le plus petit tableau qui les contient.
  if (select count(distinct l.rang) from public.lignes_tableau(p_premier_tour) l where l.rang between 0 and v_cases - 1)
       <> v_cases
     or exists (select 1 from public.lignes_tableau(p_premier_tour) l where l.a is null) then
    raise exception 'tableau invalide' using errcode = 'check_violation';
  end if;
  select count(*), count(distinct p.id) into v_joueurs, v_valides from (
    select l.a as id from public.lignes_tableau(p_premier_tour) l
    union all
    select l.b from public.lignes_tableau(p_premier_tour) l where l.b is not null
  ) p;
  if v_joueurs <> v_valides or v_joueurs <= v_cases or v_joueurs > v_cases * 2 then
    raise exception 'tableau invalide' using errcode = 'check_violation';
  end if;
  select count(*) into v_valides
  from public.joueurs j
  where j.evenement_id = v_manche.evenement_id
    and j.equipe_id is not null
    and j.id in (
      select l.a from public.lignes_tableau(p_premier_tour) l
      union
      select l.b from public.lignes_tableau(p_premier_tour) l where l.b is not null
    );
  if v_valides <> v_joueurs then
    raise exception 'joueur hors de la soirée' using errcode = 'check_violation';
  end if;

  delete from public.matchs_tournoi t where t.manche_id = p_manche;

  insert into public.matchs_tournoi (
    evenement_id, manche_id, tour, rang,
    joueur_a, prenom_a, equipe_a, joueur_b, prenom_b, equipe_b, gagnant
  )
  select
    v_manche.evenement_id, p_manche, 1, l.rang,
    ja.id, ja.prenom, ea.numero, jb.id, jb.prenom, eb.numero,
    case when l.b is null then 0 end
  from public.lignes_tableau(p_premier_tour) l
  join public.joueurs ja on ja.id = l.a
  join public.equipes ea on ea.id = ja.equipe_id
  left join public.joueurs jb on jb.id = l.b
  left join public.equipes eb on eb.id = jb.equipe_id;

  insert into public.matchs_tournoi (evenement_id, manche_id, tour, rang)
  select v_manche.evenement_id, p_manche, t, r
  from generate_series(2, v_tours) t
  cross join lateral generate_series(0, (v_cases >> (t - 1)) - 1) r;

  -- Les exemptés montent au deuxième tour. Deux passes : deux exemptés peuvent s'y retrouver, et
  -- un UPDATE … FROM n'applique qu'une ligne source par ligne visée.
  update public.matchs_tournoi s set
    joueur_a = e.joueur_a, prenom_a = e.prenom_a, equipe_a = e.equipe_a
  from public.matchs_tournoi e
  where e.manche_id = p_manche and e.tour = 1 and e.prenom_b is null and e.rang % 2 = 0
    and s.manche_id = p_manche and s.tour = 2 and s.rang = e.rang / 2;
  update public.matchs_tournoi s set
    joueur_b = e.joueur_a, prenom_b = e.prenom_a, equipe_b = e.equipe_a
  from public.matchs_tournoi e
  where e.manche_id = p_manche and e.tour = 1 and e.prenom_b is null and e.rang % 2 = 1
    and s.manche_id = p_manche and s.tour = 2 and s.rang = e.rang / 2;

  update public.manches m set
    options = m.options || jsonb_build_object('gobelets', p_gobelets, 'joueurs', v_joueurs)
  where m.id = p_manche;

  return v_joueurs;
end;
$$;

create or replace function public.ouvrir_sequence(
  p_manche uuid,
  p_version timestamptz,
  p_numero integer,
  p_matchs uuid[],
  p_gobelets integer,
  p_pilotage jsonb
) returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_manche public.manches;
  v_tour smallint;
begin
  select * into v_manche from public.manches m where m.id = p_manche for update;
  if not found or not public.anime(v_manche.evenement_id) then
    raise exception 'manche inconnue' using errcode = 'insufficient_privilege';
  end if;
  if p_gobelets is null or p_gobelets not between 1 and 64 then
    raise exception 'gobelets invalides' using errcode = 'check_violation';
  end if;
  if coalesce(cardinality(p_matchs), 0) not between 1 and p_gobelets then
    raise exception 'séquence invalide' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from public.matchs_tournoi t
    where t.manche_id = p_manche and t.sequence is not null and t.gagnant is null
  ) then
    raise exception 'résultats manquants' using errcode = 'PT409';
  end if;
  -- Un double appui arrive avec un numéro déjà pris.
  if p_numero <> 1 + coalesce((
    select max(t.sequence) from public.matchs_tournoi t where t.manche_id = p_manche
  ), 0) then
    raise exception 'pilotage périmé' using errcode = 'PT409';
  end if;

  select min(t.tour) into v_tour
  from public.matchs_tournoi t
  where t.manche_id = p_manche and t.gagnant is null;

  if (
    select count(*) from public.matchs_tournoi t
    where t.manche_id = p_manche
      and t.id = any (p_matchs)
      and t.tour = v_tour
      and t.gagnant is null
      and t.sequence is null
      and t.prenom_a is not null
      and t.prenom_b is not null
  ) <> cardinality(p_matchs) or cardinality(p_matchs) <> (
    select count(distinct x) from unnest(p_matchs) x
  ) then
    raise exception 'séquence invalide' using errcode = 'check_violation';
  end if;

  update public.matchs_tournoi t set sequence = p_numero, poste = o.poste
  from unnest(p_matchs) with ordinality as o(id, poste)
  where t.id = o.id;

  update public.manches m set options = m.options || jsonb_build_object('gobelets', p_gobelets)
  where m.id = p_manche;

  return public.enregistrer_etape(v_manche.evenement_id, p_version, p_pilotage);
end;
$$;
