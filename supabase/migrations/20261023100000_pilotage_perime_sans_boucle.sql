-- « Pilotage périmé » sans boucle (audit du 2026-10-23).
--
-- `enregistrer_etape` refusait une écriture partie d'un état périmé (double appui, deux fenêtres
-- de régie) avec le code `serialization_failure` (40001). PostgREST 14, en ligne comme en local,
-- réessaie de lui-même toute transaction qui échoue ainsi : la version restant périmée, il
-- réessayait sans fin, la requête de la régie ne revenait jamais et une connexion restait prise.
-- Le refus passe au code `PT409`, que PostgREST ne réessaie pas et renvoie en 409. Le message ne
-- change pas : la régie le reconnaît toujours (« périmé »).
--
-- Reprise à l'identique de 20260925090000_quiz_et_mime.sql, ce code mis à part.

create or replace function public.enregistrer_etape(
  p_evenement uuid,
  p_version timestamptz,
  p_pilotage jsonb,
  p_passage jsonb default null,
  p_manche jsonb default null,
  p_scores jsonb default '[]'::jsonb
) returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version timestamptz;
  v_chrono text := coalesce(p_pilotage ->> 'chrono', 'garder');
  v_score jsonb;
begin
  update public.pilotage p set
    scene = (p_pilotage ->> 'scene')::public.scene,
    manche_id = (p_pilotage ->> 'manche_id')::uuid,
    passage_id = (p_pilotage ->> 'passage_id')::uuid,
    etape = p_pilotage ->> 'etape',
    indices = coalesce((p_pilotage ->> 'indices')::smallint, 0),
    chrono_duree_s = case
      when v_chrono = 'demarrer' then (p_pilotage ->> 'chrono_duree_s')::integer
      when v_chrono = 'arreter' then null
      else p.chrono_duree_s end,
    chrono_depart = case
      when v_chrono = 'demarrer' then now()
      when v_chrono = 'arreter' then null
      else p.chrono_depart end,
    maj_le = clock_timestamp()
  where p.evenement_id = p_evenement and p.maj_le = p_version
  returning p.maj_le into v_version;

  if v_version is null then
    raise exception 'pilotage périmé' using errcode = 'PT409';
  end if;

  if p_passage is not null then
    update public.passages pa set
      statut = (p_passage ->> 'statut')::public.statut_passage,
      resultat = coalesce(p_passage -> 'resultat', pa.resultat),
      points = case when p_passage ? 'points' then (p_passage ->> 'points')::integer else pa.points end,
      commence_le = case
        when p_passage ->> 'statut' = 'en_cours' then coalesce(pa.commence_le, now())
        else pa.commence_le end,
      termine_le = case when p_passage ->> 'statut' = 'termine' then now() else null end
    where pa.id = (p_passage ->> 'id')::uuid and pa.evenement_id = p_evenement;
  end if;

  if p_manche is not null then
    update public.manches m set
      statut = (p_manche ->> 'statut')::public.statut_manche,
      options = m.options || coalesce(p_manche -> 'options', '{}'::jsonb),
      commence_le = case
        when p_manche ->> 'statut' = 'en_cours' then coalesce(m.commence_le, now())
        else m.commence_le end,
      termine_le = case when p_manche ->> 'statut' = 'terminee' then now() else m.termine_le end
    where m.id = (p_manche ->> 'id')::uuid and m.evenement_id = p_evenement;
  end if;

  for v_score in select * from jsonb_array_elements(p_scores) loop
    insert into public.scores (evenement_id, equipe_id, manche_id, points, motif, saisi_par)
    values (
      p_evenement,
      (v_score ->> 'equipe_id')::uuid,
      (v_score ->> 'manche_id')::uuid,
      (v_score ->> 'points')::integer,
      v_score ->> 'motif',
      (select auth.uid())
    );
  end loop;

  return v_version;
end;
$$;
