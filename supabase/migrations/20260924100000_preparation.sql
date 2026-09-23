-- Préparation du programme depuis la régie (lot 6).
--
-- Réordonner deux manches échange leurs numéros d'ordre, uniques par événement : la contrainte
-- devient différable, pour que l'échange se vérifie en fin de transaction et pas entre les deux
-- mises à jour.

alter table public.manches drop constraint manches_evenement_id_ordre_key;
alter table public.manches
  add constraint manches_evenement_id_ordre_key unique (evenement_id, ordre)
  deferrable initially immediate;

-- Échange l'ordre de deux manches du même événement. Security invoker : la RLS des manches
-- s'applique, un animateur ne réordonne que ses propres programmes.
create function public.echanger_manches(p_a uuid, p_b uuid) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_a public.manches;
  v_b public.manches;
begin
  select * into v_a from public.manches where id = p_a;
  select * into v_b from public.manches where id = p_b;
  if v_a.id is null or v_b.id is null or v_a.evenement_id <> v_b.evenement_id then
    raise exception 'manches introuvables' using errcode = 'no_data_found';
  end if;

  set constraints public.manches_evenement_id_ordre_key deferred;
  update public.manches set ordre = v_b.ordre where id = v_a.id;
  update public.manches set ordre = v_a.ordre where id = v_b.id;
end;
$$;

revoke execute on function public.echanger_manches(uuid, uuid) from public, anon;
grant execute on function public.echanger_manches(uuid, uuid) to authenticated;
