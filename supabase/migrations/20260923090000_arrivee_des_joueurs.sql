-- L'arrivée des joueurs (lot 5).
--
-- Trois changements par rapport au lot 3 :
-- - on peut savoir, avant de rejoindre, si un code est valide et quelles langues il propose ;
-- - l'arrivée attribue l'équipe la moins remplie (décision du 2026-09-23 : la régie pourra
--   déplacer un joueur ensuite), sous un verrou par événement, pour que 150 arrivées
--   simultanées ne dépassent pas le plafond ni ne déséquilibrent les équipes ;
-- - l'écran d'attente connaît le prochain jeu, et chaque lecture de l'état marque le joueur
--   comme vu, ce qui servira à la régie pour suivre les connexions.

-- Ce qu'un inconnu a le droit de savoir d'un code : s'il ouvre une partie, et dans quelles langues.
create function public.evenement_public(p_code text) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('code', e.code, 'langues', e.langues, 'statut', e.statut)
  from public.evenements e
  where e.code = upper(p_code)
    and e.statut in ('preparation', 'repetition', 'en_cours')
    and (e.code_expire_le is null or e.code_expire_le > now());
$$;

create or replace function public.rejoindre_evenement(
  p_code text,
  p_prenom text,
  p_langue public.langue,
  p_jeton_hash text
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

  -- Une arrivée à la fois par événement, jusqu'à la fin de la transaction : le compte des
  -- joueurs et le choix de l'équipe voient toujours les arrivées précédentes.
  perform pg_advisory_xact_lock(hashtextextended(v_evenement.id::text, 0));

  if (select count(*) from public.joueurs j where j.evenement_id = v_evenement.id) >= 150 then
    raise exception 'événement complet' using errcode = 'check_violation';
  end if;

  -- L'équipe la moins remplie, le plus petit numéro en cas d'égalité. Aucune si l'événement
  -- n'a pas encore d'équipes : la régie les créera et répartira.
  select eq.* into v_equipe
  from public.equipes eq
  left join public.joueurs j on j.equipe_id = eq.id
  where eq.evenement_id = v_evenement.id
  group by eq.id
  order by count(j.id), eq.numero
  limit 1;

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

-- Même contenu qu'au lot 3, plus la prochaine manche. Toujours aucun secret.
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
      'capitaine', j.capitaine
    ),
    'evenement', jsonb_build_object(
      'code', e.code,
      'statut', e.statut,
      'langues', e.langues,
      'photos_closes', e.photos_closes_le is not null
    ),
    'equipe', case when eq.id is null then null else jsonb_build_object(
      'id', eq.id,
      'numero', eq.numero,
      'nom', eq.nom,
      'points', coalesce(c.points, 0)
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
    )
  )
  from public.joueurs j
  join public.evenements e on e.id = j.evenement_id
  left join public.equipes eq on eq.id = j.equipe_id
  left join public.classement c on c.equipe_id = eq.id
  where j.jeton_hash = p_jeton_hash;
$$;

-- Lecture de l'état par le téléphone : marque le joueur comme vu au passage.
create function public.pouls_joueur(p_jeton_hash text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.joueurs set vu_le = now() where jeton_hash = p_jeton_hash;
  return public.etat_joueur(p_jeton_hash);
end;
$$;

-- ---------------------------------------------------------------------------
-- Verrous : comme au lot 3, seul le serveur de l'app appelle ces fonctions.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.evenement_public(text),
  public.pouls_joueur(text)
  from public, anon, authenticated;

grant execute on function
  public.evenement_public(text),
  public.pouls_joueur(text)
  to service_role;
