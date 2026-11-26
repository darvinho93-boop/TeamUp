-- Karaoké du Blind test, suite (2026-11-26) : une ligne de paroles peut porter sa version en
-- lettres latines, affichée sous l'écriture tamoule pour qui ne la lit pas. Une clé facultative
-- `latin` dans chaque ligne : `{ t_ms, texte, latin? }`. Mêmes règles que le texte : une chaîne
-- non vide de 120 caractères au plus. Rien d'autre ne change (droits, colonne, contrainte).

create or replace function public.paroles_bien_formees(p_paroles jsonb) returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_ligne jsonb;
  v_avant bigint := -1;
  v_t bigint;
  v_texte text;
  v_latin text;
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
      or (v_ligne ? 'latin' and jsonb_typeof(v_ligne -> 'latin') is distinct from 'string')
    then
      return false;
    end if;
    v_t := (v_ligne ->> 't_ms')::bigint;
    v_texte := v_ligne ->> 'texte';
    v_latin := v_ligne ->> 'latin';
    -- Des instants strictement croissants, une ligne non vide qui tient à l'écran.
    if v_t <= v_avant or btrim(v_texte) = '' or char_length(v_texte) > 120 then
      return false;
    end if;
    if v_latin is not null and (btrim(v_latin) = '' or char_length(v_latin) > 120) then
      return false;
    end if;
    v_avant := v_t;
  end loop;
  return true;
end;
$$;

comment on column public.musiques.paroles is
  'Karaoké du Blind test : [{ t_ms, texte, latin? }], instants croissants depuis le début du '
  'fichier ; latin = la ligne en lettres latines, affichée dessous.';
