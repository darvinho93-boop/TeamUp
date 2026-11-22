-- Karaoké du Blind test (2026-11-23) : les paroles d'une musique de la bibliothèque, calées au
-- back-office. Une liste de lignes `{ t_ms, texte }`, dans l'ordre de la chanson.
--
-- Mêmes droits que le reste de la ligne `musiques` : lues par les animateurs (la régie et l'écran
-- commun), écrites par un admin. Aucune fonction joueur ne les lit : un téléphone ne les reçoit
-- jamais. L'étape `karaoke` du pilotage est un texte libre : rien d'autre ne change en base.

create function public.paroles_bien_formees(p_paroles jsonb) returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_ligne jsonb;
  v_avant bigint := -1;
  v_t bigint;
  v_texte text;
begin
  if p_paroles is null then
    return true;
  end if;
  if jsonb_typeof(p_paroles) <> 'array'
    or jsonb_array_length(p_paroles) not between 1 and 400
  then
    return false;
  end if;
  for v_ligne in select * from jsonb_array_elements(p_paroles) loop
    if jsonb_typeof(v_ligne) <> 'object'
      or jsonb_typeof(v_ligne -> 't_ms') is distinct from 'number'
      or jsonb_typeof(v_ligne -> 'texte') is distinct from 'string'
      or (v_ligne ->> 't_ms') !~ '^[0-9]{1,8}$'
    then
      return false;
    end if;
    v_t := (v_ligne ->> 't_ms')::bigint;
    v_texte := v_ligne ->> 'texte';
    -- Des instants strictement croissants, une ligne non vide qui tient à l'écran.
    if v_t <= v_avant or btrim(v_texte) = '' or char_length(v_texte) > 120 then
      return false;
    end if;
    v_avant := v_t;
  end loop;
  return true;
end;
$$;

revoke execute on function public.paroles_bien_formees(jsonb) from public, anon;
grant execute on function public.paroles_bien_formees(jsonb) to authenticated, service_role;

alter table public.musiques
  add column paroles jsonb
    constraint musiques_paroles_forme check (public.paroles_bien_formees(paroles));

comment on column public.musiques.paroles is
  'Karaoké du Blind test : [{ t_ms, texte }], instants croissants depuis le début du fichier.';
