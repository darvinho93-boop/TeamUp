-- Équipes mélangées par groupe d'origine (lot 11).
--
-- À un mariage, les invités arrivent « côté mariée » ou « côté marié » ; en entreprise, par
-- service. L'animateur nomme ces groupes à la préparation ; chaque invité dit le sien à
-- l'arrivée, et l'équipe se tire au hasard parmi celles qui en comptent le moins.
--
-- Tranché le 2026-10-03 : le groupe ne sert qu'à ce tirage, ensuite on n'en a plus besoin.
-- Il n'est donc jamais rangé sur le joueur : seul un compteur par équipe et par groupe le
-- garde, pour équilibrer les arrivées suivantes et montrer la répartition à la régie.

-- ---------------------------------------------------------------------------
-- Les groupes de la soirée
-- ---------------------------------------------------------------------------

create table public.groupes (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenements (id) on delete cascade,
  ordre smallint not null check (ordre between 1 and 6),
  nom text not null check (char_length(btrim(nom)) between 1 and 40),
  unique (evenement_id, ordre),
  unique (id, evenement_id)
);

alter table public.groupes enable row level security;

create policy "animateur lit les groupes de ses événements" on public.groupes
  for select to authenticated
  using (public.anime(evenement_id));

create policy "animateur écrit les groupes de ses événements" on public.groupes
  for all to authenticated
  using (public.anime(evenement_id))
  with check (public.anime(evenement_id));

-- ---------------------------------------------------------------------------
-- La répartition : combien de chaque groupe dans chaque équipe, rien de plus
-- ---------------------------------------------------------------------------

create table public.equipes_groupes (
  evenement_id uuid not null,
  equipe_id uuid not null,
  groupe_id uuid not null,
  effectif integer not null default 0 check (effectif >= 0),
  primary key (equipe_id, groupe_id),
  foreign key (equipe_id, evenement_id)
    references public.equipes (id, evenement_id) on delete cascade,
  foreign key (groupe_id, evenement_id)
    references public.groupes (id, evenement_id) on delete cascade
);

comment on table public.equipes_groupes is
  'Effectif de chaque groupe d''origine par équipe, compté à l''arrivée. Aucun lien vers un '
  'joueur : le groupe d''un invité n''est gardé nulle part (tranché le 2026-10-03).';

alter table public.equipes_groupes enable row level security;

-- Lecture seule pour la régie ; seule l'arrivée (security definer) écrit.
create policy "animateur lit la répartition de ses événements" on public.equipes_groupes
  for select to authenticated
  using (public.anime(evenement_id));

-- ---------------------------------------------------------------------------
-- Ce qu'un inconnu sait d'un code : ses langues, et maintenant ses groupes
-- ---------------------------------------------------------------------------

create or replace function public.evenement_public(p_code text) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', e.code,
    'langues', e.langues,
    'statut', e.statut,
    'groupes', coalesce(
      (select jsonb_agg(jsonb_build_object('id', g.id, 'nom', g.nom) order by g.ordre)
       from public.groupes g where g.evenement_id = e.id),
      '[]'::jsonb
    )
  )
  from public.evenements e
  where e.code = upper(p_code)
    and e.statut in ('preparation', 'repetition', 'en_cours')
    and (e.code_expire_le is null or e.code_expire_le > now());
$$;

-- ---------------------------------------------------------------------------
-- L'arrivée, avec un groupe facultatif
-- ---------------------------------------------------------------------------

drop function public.rejoindre_evenement(text, text, public.langue, text);

create function public.rejoindre_evenement(
  p_code text,
  p_prenom text,
  p_langue public.langue,
  p_jeton_hash text,
  p_groupe uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evenement public.evenements;
  v_joueur public.joueurs;
  v_equipe public.equipes;
begin
  select * into v_evenement
  from public.evenements e
  where e.code = upper(p_code)
    and e.statut in ('preparation', 'repetition', 'en_cours')
    and (e.code_expire_le is null or e.code_expire_le > now());

  if not found then
    raise exception 'code inconnu ou expiré' using errcode = 'no_data_found';
  end if;

  if p_langue <> all (v_evenement.langues) then
    raise exception 'langue non proposée pour cet événement' using errcode = 'check_violation';
  end if;

  if p_groupe is not null and not exists (
    select 1 from public.groupes g where g.id = p_groupe and g.evenement_id = v_evenement.id
  ) then
    raise exception 'groupe inconnu' using errcode = 'check_violation';
  end if;

  -- Une arrivée à la fois par événement, jusqu'à la fin de la transaction : les effectifs lus
  -- voient toujours les arrivées précédentes.
  perform pg_advisory_xact_lock(hashtextextended(v_evenement.id::text, 0));

  if (select count(*) from public.joueurs j where j.evenement_id = v_evenement.id) >= 150 then
    raise exception 'événement complet' using errcode = 'check_violation';
  end if;

  if p_groupe is null then
    -- Comme au lot 5 : la moins remplie, le plus petit numéro en cas d'égalité.
    select eq.* into v_equipe
    from public.equipes eq
    left join public.joueurs j on j.equipe_id = eq.id
    where eq.evenement_id = v_evenement.id
    group by eq.id
    order by count(j.id), eq.numero
    limit 1;
  else
    -- Celle qui compte le moins de ce groupe, puis le moins de joueurs, au hasard ensuite.
    select eq.* into v_equipe
    from public.equipes eq
    left join public.equipes_groupes eg on eg.equipe_id = eq.id and eg.groupe_id = p_groupe
    where eq.evenement_id = v_evenement.id
    order by
      coalesce(eg.effectif, 0),
      (select count(*) from public.joueurs j where j.equipe_id = eq.id),
      random()
    limit 1;

    if v_equipe.id is not null then
      insert into public.equipes_groupes (evenement_id, equipe_id, groupe_id, effectif)
      values (v_evenement.id, v_equipe.id, p_groupe, 1)
      on conflict (equipe_id, groupe_id) do update set effectif = public.equipes_groupes.effectif + 1;
    end if;
  end if;

  insert into public.joueurs (evenement_id, equipe_id, prenom, langue, jeton_hash)
  values (v_evenement.id, v_equipe.id, btrim(p_prenom), p_langue, p_jeton_hash)
  returning * into v_joueur;

  return jsonb_build_object(
    'joueur_id', v_joueur.id,
    'evenement_id', v_evenement.id,
    'code', v_evenement.code,
    'prenom', v_joueur.prenom,
    'langue', v_joueur.langue,
    'equipe', case when v_equipe.id is null then null else jsonb_build_object(
      'id', v_equipe.id,
      'numero', v_equipe.numero,
      'nom', v_equipe.nom
    ) end
  );
end;
$$;

-- Comme au lot 3 : seul le serveur de l'app appelle l'arrivée.
revoke execute on function
  public.rejoindre_evenement(text, text, public.langue, text, uuid)
  from public, anon, authenticated;

grant execute on function
  public.rejoindre_evenement(text, text, public.langue, text, uuid)
  to service_role;
