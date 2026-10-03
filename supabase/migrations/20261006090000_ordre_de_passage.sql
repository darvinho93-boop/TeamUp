-- Tirage au sort de l'ordre de passage, en direct (lot 13).
--
-- Points communs et Mime se jouent une équipe à la fois. La régie tire l'ordre devant la salle :
-- les passages de la manche sont renumérotés en une transaction. Leur ordre étant unique par
-- manche, la contrainte devient différable, comme celle des manches au lot 6.

alter table public.passages drop constraint passages_manche_id_ordre_key;
alter table public.passages
  add constraint passages_manche_id_ordre_key unique (manche_id, ordre)
  deferrable initially immediate;

-- Renumérote les passages d'une manche à venir dans l'ordre donné, puis note sur la manche que
-- son ordre a été tiré (l'écran l'affiche à l'intro). Security invoker : la RLS s'applique, un
-- animateur ne réordonne que ses propres soirées.
create function public.ordonner_passages(p_manche uuid, p_passages uuid[]) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_manche public.manches;
begin
  select * into v_manche from public.manches where id = p_manche for update;
  if v_manche.id is null then
    raise exception 'manche introuvable' using errcode = 'no_data_found';
  end if;

  if v_manche.statut <> 'a_venir' or exists (
    select 1 from public.passages pa where pa.manche_id = p_manche and pa.statut <> 'a_venir'
  ) then
    raise exception 'manche déjà commencée' using errcode = 'check_violation';
  end if;

  -- Exactement les passages de la manche, chacun une fois.
  if coalesce(array_length(p_passages, 1), 0) <> (
       select count(*) from public.passages pa where pa.manche_id = p_manche)
     or (select count(distinct x) from unnest(p_passages) x) <> array_length(p_passages, 1)
     or exists (
       select 1 from unnest(p_passages) x
       where not exists (select 1 from public.passages pa where pa.id = x and pa.manche_id = p_manche)
     ) then
    raise exception 'liste de passages invalide' using errcode = 'check_violation';
  end if;

  set constraints public.passages_manche_id_ordre_key deferred;
  update public.passages pa
  set ordre = t.rang
  from unnest(p_passages) with ordinality as t(id, rang)
  where pa.id = t.id;

  update public.manches
  set options = options || jsonb_build_object('ordre_tire', true)
  where id = p_manche;
end;
$$;

revoke execute on function public.ordonner_passages(uuid, uuid[]) from public, anon;
grant execute on function public.ordonner_passages(uuid, uuid[]) to authenticated;
