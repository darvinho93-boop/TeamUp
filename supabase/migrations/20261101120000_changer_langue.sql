-- Le joueur change de langue en cours de soirée, depuis son téléphone (2026-11-01).
--
-- La langue est gardée sur le joueur (lot 5) : les contenus de son téléphone (quiz, points
-- communs de son équipe) sortent dans cette langue. Seules les langues de la soirée sont
-- permises. Un invité sans téléphone n'a pas de session, donc pas d'accès ici.
create function public.changer_langue(p_jeton_hash text, p_langue public.langue) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_joueur public.joueurs;
  v_langues public.langue[];
begin
  select * into v_joueur from public.joueurs j where j.jeton_hash = p_jeton_hash;
  if not found then
    raise exception 'session inconnue' using errcode = 'no_data_found';
  end if;
  select e.langues into v_langues from public.evenements e where e.id = v_joueur.evenement_id;
  if p_langue <> all (v_langues) then
    raise exception 'langue non proposée pour cet événement' using errcode = 'check_violation';
  end if;
  update public.joueurs set langue = p_langue where id = v_joueur.id;
  return jsonb_build_object('langue', p_langue);
end;
$$;

revoke execute on function public.changer_langue(text, public.langue) from public, anon, authenticated;
grant execute on function public.changer_langue(text, public.langue) to service_role;
