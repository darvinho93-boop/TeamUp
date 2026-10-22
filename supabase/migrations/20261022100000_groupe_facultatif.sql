-- « Je préfère ne pas répondre » au choix du groupe, au choix de l'animateur (2026-10-22).
--
-- Par défaut, comme au lot 11, l'invité peut ne pas dire de quel groupe il est. L'animateur peut
-- le lui retirer à la préparation : l'arrivée exige alors un groupe, quand la soirée en a. La
-- garde est en base (`rejoindre_evenement`), pas seulement dans l'écran du téléphone.

alter table public.evenements
  add column groupe_facultatif boolean not null default true;

comment on column public.evenements.groupe_facultatif is
  'Faux : à l''arrivée, l''invité doit choisir un groupe (si la soirée en a). Écrit à la préparation.';

-- Reprise de 20261005090000_groupes_a_melanger.sql, le réglage en plus.
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
    ),
    'groupe_facultatif', e.groupe_facultatif
  )
  from public.evenements e
  where e.code = upper(p_code)
    and e.statut in ('preparation', 'repetition', 'en_cours')
    and (e.code_expire_le is null or e.code_expire_le > now());
$$;

-- Reprise de 20261017110000_capitaines_et_noms.sql (même signature), la garde en plus.
create or replace function public.rejoindre_evenement(
  p_code text,
  p_prenom text,
  p_langue public.langue,
  p_jeton_hash text,
  p_groupe uuid default null,
  p_volontaire boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evenement public.evenements;
begin
  select * into v_evenement
  from public.evenements e
  where e.code = upper(p_code)
    and e.statut in ('preparation', 'repetition', 'en_cours')
    and (e.code_expire_le is null or e.code_expire_le > now());

  if not found then
    raise exception 'code inconnu ou expiré' using errcode = 'no_data_found';
  end if;

  if p_jeton_hash is null then
    raise exception 'session obligatoire' using errcode = 'check_violation';
  end if;

  if p_groupe is null and not v_evenement.groupe_facultatif and exists (
    select 1 from public.groupes g where g.evenement_id = v_evenement.id
  ) then
    raise exception 'groupe obligatoire' using errcode = 'check_violation';
  end if;

  return public.placer_joueur(v_evenement, p_prenom, p_langue, p_jeton_hash, p_groupe, p_volontaire);
end;
$$;
